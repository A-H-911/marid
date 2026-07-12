import { describe, expect } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { createTokenStore } from "@marid/gateway"
import { instanceMaridDir, start, stop, type LaunchResolver } from "@marid/instance"
import { createBotApi, runGateway } from "@marid/telegram"
import { TestLLMServer } from "../lib/llm-server"
import { testProviderConfig } from "../lib/test-provider"
import { it } from "../lib/effect"

// TEST-TG (WBS-4.1..4.5, KPI-002): the Telegram round trip + policy-denial path,
// scripted against a REAL authenticated `marid serve` (driven by a fake LLM) with a
// LOCAL FAKE Telegram Bot API server — no live Telegram, no live model. Heavy (a
// real server boot + prompt runs); gated to the 3-OS marid-telegram CI job via
// MARID_TELEGRAM=1 so it stays out of the PR unit job.
//
// The approve-exactly-once claim semantics are covered deterministically in the
// marid-telegram unit suite (permission.test); here we prove the INV-001-critical
// live paths: a stranger is ignored, an operator gets a streamed reply, and a
// policy-gated tool surfaces a keyboard whose Deny blocks the tool at the server.
const RUN = process.env.MARID_TELEGRAM === "1"
const suite = RUN ? describe : describe.skip

const OPERATOR = 111
const STRANGER = 999
// The built-in primary agent (declares the full toolset to the model, so a scripted
// bash tool call actually fires). The restricted-custom-agent binding is proven
// separately in the marid-auth channel-binding unit suite; here we exercise the live
// permission round trip, gating bash to "ask" via top-level config.
const AGENT = "build"

const maridEntry = path.resolve(import.meta.dir, "../../src/marid.ts")
const launch: LaunchResolver = () => ({
  command: process.execPath,
  args: ["run", "--conditions=browser", maridEntry, "serve", "--port", "0"],
})

// Instance config: the fake LLM provider + a restricted channel agent whose `bash`
// permission is "ask" (so a bash tool call surfaces a permission prompt).
function configContent(llmUrl: string): string {
  return JSON.stringify({
    ...testProviderConfig(llmUrl),
    model: "test/test-model", // default model so a prompt without an explicit model runs
    permission: { bash: "ask" }, // a bash tool call surfaces a permission prompt (inline keyboard)
  })
}

function overlay(fakeHome: string, llmUrl: string): Record<string, string> {
  return {
    HOME: fakeHome,
    USERPROFILE: fakeHome,
    OPENCODE_TEST_HOME: fakeHome,
    OPENCODE_PURE: "1",
    OPENCODE_DISABLE_AUTOUPDATE: "1",
    OPENCODE_DISABLE_AUTOCOMPACT: "1",
    OPENCODE_DISABLE_MODELS_FETCH: "1",
    OPENCODE_AUTH_CONTENT: "{}",
    OPENCODE_DB: "opencode.db",
    OPENCODE_CONFIG_CONTENT: configContent(llmUrl),
  }
}

interface FakeUpdate {
  update_id: number
  message?: {
    message_id: number
    from: { id: number; is_bot: boolean }
    chat: { id: number; type: string }
    text?: string
    document?: { file_id: string; file_name?: string; mime_type?: string }
  }
  callback_query?: { id: string; from: { id: number; is_bot: boolean }; data: string }
}
type Sent = { chat_id: number; text: string; reply_markup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } }

// A local fake Telegram Bot API server. getUpdates drains a queue then returns [];
// send/edit/answer calls are recorded for assertions.
function fakeTelegram() {
  const queue: FakeUpdate[] = []
  const sent: Sent[] = []
  const edits: Array<{ chat_id: number; text: string }> = []
  let messageId = 5000
  const server = Bun.serve({
    port: 0,
    idleTimeout: 120,
    async fetch(req) {
      const pathname = new URL(req.url).pathname
      // Inbound file download: getFile resolves to `${base}/file/bot<token>/<path>`, which the
      // server may fetch when the file part lands. A GET (no JSON body) — serve raw bytes.
      if (pathname.includes("/file/")) return new Response("FAKE_INBOUND_FILE_BYTES", { status: 200 })
      const method = pathname.split("/").pop() ?? ""
      const body = (await req.json().catch(() => ({}))) as Record<string, any>
      if (method === "getUpdates") {
        const batch = queue.splice(0)
        if (batch.length === 0) await new Promise((r) => setTimeout(r, 30)) // avoid hot-spin
        return Response.json({ ok: true, result: batch })
      }
      if (method === "sendMessage") {
        const id = ++messageId
        sent.push({ chat_id: body.chat_id, text: body.text, reply_markup: body.reply_markup })
        return Response.json({ ok: true, result: { message_id: id, chat: { id: body.chat_id, type: "private" }, text: body.text } })
      }
      if (method === "editMessageText") {
        edits.push({ chat_id: body.chat_id, text: body.text })
        return Response.json({ ok: true, result: true })
      }
      if (method === "getFile") {
        // Resolve any inbound file_id to a stable download path (bot-api builds the URL from it).
        return Response.json({ ok: true, result: { file_id: body.file_id, file_path: `documents/${body.file_id}.bin` } })
      }
      return Response.json({ ok: true, result: true }) // sendChatAction, answerCallbackQuery, editMessageReplyMarkup, etc.
    },
  })
  return {
    url: `http://127.0.0.1:${server.port}`,
    stop: () => server.stop(true),
    deliverMessage: (from: number, updateId: number, text: string) =>
      queue.push({ update_id: updateId, message: { message_id: updateId, from: { id: from, is_bot: false }, chat: { id: from, type: "private" }, text } }),
    // Deliver an inbound DOCUMENT (attachment) so the gateway resolves + lands it as a file part.
    deliverDocument: (from: number, updateId: number, doc: { file_id: string; file_name?: string; mime_type?: string }) =>
      queue.push({ update_id: updateId, message: { message_id: updateId, from: { id: from, is_bot: false }, chat: { id: from, type: "private" }, document: doc } }),
    sent,
    edits,
  }
}

const wait = (ms: number) => Effect.promise(() => new Promise((r) => setTimeout(r, ms)))

// marid (P-CI-4): route the poll budget through OPENCODE_TIMING_SCALE (Windows=4, set by the
// marid-telegram job). This helper ignored it, so the 25s wait at :187 flaked on cold 2-core
// Windows CI where instance-boot + LLM + round trip legitimately took ~32s.
const TIMING_SCALE = Number(process.env.OPENCODE_TIMING_SCALE) || 1

async function waitFor(predicate: () => boolean, timeoutMs = 20_000): Promise<boolean> {
  const start = Date.now()
  const deadline = timeoutMs * TIMING_SCALE
  while (Date.now() - start < deadline) {
    if (predicate()) return true
    await new Promise((r) => setTimeout(r, 50))
  }
  return predicate()
}

// Launch a real marid instance + a channel token bound to AGENT + a fake Telegram,
// wire a gateway to both, and register teardown. Returns the fake + abort handle.
function setup(llm: TestLLMServer["Service"], agent: string = AGENT) {
  return Effect.gen(function* () {
    const logs: string[] = []
    const root = yield* Effect.promise(() => fs.mkdtemp(path.join(os.tmpdir(), "marid-tg-")))
    const dir = path.join(root, "inst")
    const fakeHome = path.join(root, "home")
    yield* Effect.promise(() => fs.mkdir(fakeHome, { recursive: true }))
    const token = yield* Effect.promise(() =>
      createTokenStore(instanceMaridDir(dir))
        .create("tg", "channel:telegram", agent)
        .then((r) => r.secret),
    )
    const record = yield* Effect.promise(() => start("inst", dir, launch, { env: overlay(fakeHome, llm.url), timeoutMs: 60_000 }))
    const tg = fakeTelegram()
    const controller = new AbortController()
    const sdk = createOpencodeClient({ baseUrl: `http://127.0.0.1:${record.port}`, headers: { authorization: `Bearer ${token}` } })
    const bot = createBotApi({ token: "fake-bot-token", baseUrl: tg.url })
    const gateway = runGateway({
      sdk,
      bot,
      allow: new Set([OPERATOR]),
      agent,
      dedupFile: path.join(root, "dedup.json"),
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      timers: { set: (cb, ms) => (((t) => () => clearTimeout(t))(setTimeout(cb, ms))) },
      cadenceMs: 0, // fast edits so progressive streaming is observable within the test window
      permissionTimeoutMs: 30_000,
      pollTimeoutSec: 1,
      log: (line) => logs.push(line),
      signal: controller.signal,
    })
    yield* Effect.addFinalizer(() =>
      Effect.promise(async () => {
        controller.abort()
        await gateway.catch(() => {})
        tg.stop()
        await stop(dir).catch(() => {})
        await fs.rm(root, { recursive: true, force: true }).catch(() => {})
      }),
    )
    return { tg, url: `http://127.0.0.1:${record.port}`, headers: { authorization: `Bearer ${token}` }, logs }
  })
}

suite("TEST-TG: Telegram round trip + policy denial (live)", () => {
  it.live(
    "AC-010/AC-011: a stranger is ignored; the operator gets a streamed reply",
    () =>
      Effect.gen(function* () {
        const llm = yield* TestLLMServer
        const { tg } = yield* setup(llm)
        yield* wait(500) // let the gateway subscribe + start polling

        // AC-010: a non-allowlisted sender gets no reply.
        tg.deliverMessage(STRANGER, 1, "let me in")
        yield* wait(1500)
        expect(tg.sent.filter((m) => m.chat_id === STRANGER)).toHaveLength(0)

        // AC-011: the operator's question streams back a complete reply.
        yield* llm.text("hello operator, here is your streamed answer")
        tg.deliverMessage(OPERATOR, 2, "hi agent")
        const got = yield* Effect.promise(() => waitFor(() => tg.sent.some((m) => m.chat_id === OPERATOR), 25_000))
        expect(got).toBe(true)
        const finalText = [...tg.sent, ...tg.edits].filter((m) => m.chat_id === OPERATOR).map((m) => m.text).join(" ")
        expect(finalText).toContain("streamed answer")
      }).pipe(Effect.provide(TestLLMServer.layer)),
    300_000,
  )

  // AC-017 (files land INBOUND): a delivered document is resolved through the real bot-api
  // (getFile → fileDownloadUrl) into an SDK file part and handed to promptAsync — the defect-2
  // fix, end-to-end against a real `marid serve`. Asserted via the gateway's own log (the file
  // part reaching the session precedes the log line). Outbound file send is covered
  // deterministically in marid-telegram/test/gateway-integration.test.ts (the served fake LLM
  // cannot emit assistant file parts). Full media RENDERING is the live TEST-TG-UI tier.
  it.live(
    "AC-017: an inbound document is resolved and lands as a file part in the session prompt",
    () =>
      Effect.gen(function* () {
        const llm = yield* TestLLMServer
        const { tg, logs } = yield* setup(llm)
        yield* wait(500)
        yield* llm.text("received your file") // so the prompted turn completes cleanly

        tg.deliverDocument(OPERATOR, 3, { file_id: "doc_abc", file_name: "notes.txt", mime_type: "text/plain" })
        const landed = yield* Effect.promise(() =>
          waitFor(() => logs.some((l) => /attached \d+ inbound file part/.test(l)), 25_000),
        )
        expect(landed).toBe(true)
      }).pipe(Effect.provide(TestLLMServer.layer)),
    300_000,
  )

  // A LIVE tool call now surfaces the Approve/Deny inline keyboard end-to-end through the real
  // gateway. This was long IMPOSSIBLE: the gateway used `promptAsync`, whose forked turn resolves
  // ZERO tools (the forked turn outlives the request-scoped tool/agent/MCP context — root cause in
  // docs/execution/telegram-channel-tools.md). The gateway now drives the sync `session.prompt`
  // route (detached), which resolves tools in-request, so a bash tool call (gated to "ask") reaches
  // the operator as an inline keyboard. (Prior note here — "served run resolves ZERO tools" — is
  // superseded; that was the promptAsync route, not the sync route.) Callback handling + server
  // reply on Deny/Approve are proven deterministically in marid-telegram/gateway-integration.test.ts.
  it.live(
    "AC-012/AC-017: a live bash tool call surfaces an Approve/Deny inline keyboard (sync-route fix restores tools)",
    () =>
      Effect.gen(function* () {
        const llm = yield* TestLLMServer
        const { tg } = yield* setup(llm)
        yield* wait(500)
        yield* llm.tool("bash", { command: "echo hi" }) // fires ONLY if the served turn resolved tools
        tg.deliverMessage(OPERATOR, 20, "please run echo hi")
        const gotKeyboard = yield* Effect.promise(() =>
          waitFor(() => tg.sent.some((m) => (m.reply_markup?.inline_keyboard?.length ?? 0) > 0), 25_000),
        )
        expect(gotKeyboard).toBe(true)
      }).pipe(Effect.provide(TestLLMServer.layer)),
    300_000,
  )
})
