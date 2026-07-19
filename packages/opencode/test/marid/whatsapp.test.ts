import { describe, expect } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { createTokenStore } from "@marid/gateway"
import { instanceMaridDir, start, stop, type LaunchResolver } from "@marid/instance"
import { createWahaClient, runGateway } from "@marid/whatsapp"
import { TestLLMServer } from "../lib/llm-server"
import { testProviderConfig } from "../lib/test-provider"
import { it } from "../lib/effect"

// TEST-WA (WBS-7.5, AC-023, ADR-0014 tier 2): the WhatsApp round trip, scripted against a
// REAL authenticated `marid serve` (driven by a fake LLM) with a LOCAL FAKE WAHA server —
// no live WhatsApp, no live model, NO real account, NO ban risk. This is the deterministic
// BLOCKING PR gate. Heavy (a real server boot + prompt runs); gated to the 3-OS
// marid-whatsapp CI job via MARID_WHATSAPP=1 so it stays out of the PR unit job.
//
// The fake sits at the WAHA WEBSOCKET+HTTP boundary (ADR-0014), not above the narrow
// interface — so the real waha.ts transport (frame parse, HTTP body serialization) is
// exercised, and INV-001 is asserted at REAL-REQUEST level (RISK-025: the Telegram leak
// was invisible to function-level tests). Outbound bodies are validated against the pinned
// OpenAPI fixture, so a fake that drifts from the real contract FAILS rather than passing
// a fiction (the W2 fix from the plan).
//
// Deterministic claim/parse semantics live in the marid-whatsapp unit suite
// (approval/permission/waha .test.ts); here we prove the live paths.
const RUN = process.env.MARID_WHATSAPP === "1"
const suite = RUN ? describe : describe.skip

const OPERATOR = "111111@c.us"
const STRANGER = "999999@c.us"
const AGENT = "build"
const SESSION = "default"

const maridEntry = path.resolve(import.meta.dir, "../../src/marid.ts")
const launch: LaunchResolver = () => ({
  command: process.execPath,
  args: ["run", "--conditions=browser", maridEntry, "serve", "--port", "0"],
})

function configContent(llmUrl: string): string {
  return JSON.stringify({
    ...testProviderConfig(llmUrl),
    model: "test/test-model",
    permission: { bash: "ask" }, // a bash tool call surfaces a token-text permission prompt
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

// The pinned WAHA contract (GATE-0). Loaded once; the fake validates every outbound body
// against the real required-field set, so drift from the real image fails the gate.
let CONTRACT: { paths: Record<string, any>; components: { schemas: Record<string, any> } }
async function contract() {
  if (!CONTRACT) {
    CONTRACT = JSON.parse(await fs.readFile(path.join(import.meta.dir, "fixtures", "waha-openapi.json"), "utf8"))
  }
  return CONTRACT
}

// Assert `body` satisfies the required fields of a pinned request schema. Coarse on
// purpose — it pins the CONTRACT SHAPE (the thing that rots), not every value.
function assertRequired(schema: any, body: Record<string, unknown>, label: string) {
  for (const req of (schema?.required ?? []) as string[]) {
    if (!(req in body)) throw new Error(`WAHA ${label}: missing required field "${req}" (contract drift)`)
  }
}

interface SentText {
  chatId: string
  text: string
}
interface SentEdit {
  chatId: string
  messageId: string
  text: string
}
interface SentMedia {
  route: string
  chatId: string
  mimetype: string
}

// A local fake WAHA server: HTTP for outbound (validated + recorded), a WebSocket for
// inbound injection. Mirrors fakeTelegram() in telegram.test.ts, at the WAHA boundary.
async function fakeWaha() {
  const c = await contract()
  const schemas = c.components.schemas
  const sentText: SentText[] = []
  const sentEdit: SentEdit[] = []
  const sentMedia: SentMedia[] = []
  const presence: Array<{ chatId?: string; presence: string }> = []
  const sockets = new Set<{ send(data: string): void }>()
  let seq = 0

  const server = Bun.serve({
    port: 0,
    idleTimeout: 120,
    fetch(req, srv) {
      const url = new URL(req.url)
      if (url.pathname === "/ws") {
        // The inbound transport: the WAHA client dials this out (OQ-004).
        if (srv.upgrade(req)) return undefined
        return new Response("expected websocket", { status: 426 })
      }
      return handleHttp(req, url)
    },
    websocket: {
      open(ws) {
        sockets.add(ws as unknown as { send(data: string): void })
      },
      close(ws) {
        sockets.delete(ws as unknown as { send(data: string): void })
      },
      message() {},
    },
  })

  async function handleHttp(req: Request, url: URL): Promise<Response> {
    const pathname = url.pathname
    if (pathname === "/api/version") {
      // The tier/engine assertion rides the wire (WAHAEnvironment), not a doc citation.
      return Response.json({ version: "2026.7.1", engine: "NOWEB", tier: "CORE" })
    }
    // Inbound media download: WAHA serves bytes from its own host.
    if (pathname.includes("/api/files/")) return new Response("FAKE_INBOUND_MEDIA_BYTES")

    const body = (await req.json().catch(() => ({}))) as Record<string, any>

    if (pathname === "/api/sendText") {
      assertRequired(schemas.MessageTextRequest, body, "sendText")
      const id = `true_${body.chatId}_${++seq}`
      sentText.push({ chatId: body.chatId, text: body.text })
      return Response.json({ id })
    }
    if (pathname === "/api/sendImage" || pathname === "/api/sendFile") {
      const schema = pathname.endsWith("Image") ? schemas.MessageImageRequest : schemas.MessageFileRequest
      assertRequired(schema, body, pathname)
      sentMedia.push({ route: pathname, chatId: body.chatId, mimetype: body.file?.mimetype })
      return Response.json({ id: `true_${body.chatId}_${++seq}` })
    }
    if (req.method === "PUT" && /\/messages\//.test(pathname)) {
      assertRequired(schemas.EditMessageRequest, body, "editMessage")
      const parts = pathname.split("/") // /api/{session}/chats/{chatId}/messages/{messageId}
      sentEdit.push({ chatId: decodeURIComponent(parts[4]!), messageId: parts[6]!, text: body.text })
      return Response.json({})
    }
    if (/\/presence$/.test(pathname)) {
      assertRequired(schemas.WAHASessionPresence, body, "presence")
      presence.push({ chatId: body.chatId, presence: body.presence })
      return Response.json({})
    }
    return Response.json({})
  }

  return {
    url: `http://127.0.0.1:${server.port}`,
    stop: () => server.stop(true),
    // Inject an inbound WhatsApp message as a real WAHA `message` WS frame.
    deliverMessage: (from: string, id: string, text: string) => {
      const frame = JSON.stringify({ event: "message", payload: { id, from, body: text, fromMe: false, hasMedia: false } })
      for (const ws of sockets) ws.send(frame)
    },
    deliverMedia: (from: string, id: string, media: { url: string; mimetype: string; filename?: string }) => {
      const frame = JSON.stringify({
        event: "message",
        payload: { id, from, body: "", fromMe: false, hasMedia: true, media },
      })
      for (const ws of sockets) ws.send(frame)
    },
    sentText,
    sentEdit,
    sentMedia,
    presence,
    socketCount: () => sockets.size,
  }
}

const wait = (ms: number) => Effect.promise(() => new Promise((r) => setTimeout(r, ms)))
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

function setup(llm: TestLLMServer["Service"], agent: string = AGENT) {
  return Effect.gen(function* () {
    const logs: string[] = []
    const root = yield* Effect.promise(() => fs.mkdtemp(path.join(os.tmpdir(), "marid-wa-")))
    const dir = path.join(root, "inst")
    const fakeHome = path.join(root, "home")
    yield* Effect.promise(() => fs.mkdir(fakeHome, { recursive: true }))
    const token = yield* Effect.promise(() =>
      createTokenStore(instanceMaridDir(dir))
        .create("wa", "channel:whatsapp", agent)
        .then((r) => r.secret),
    )
    const record = yield* Effect.promise(() =>
      start("inst", dir, launch, { env: overlay(fakeHome, llm.url), timeoutMs: 60_000 }),
    )
    const waha = yield* Effect.promise(() => fakeWaha())
    const controller = new AbortController()
    const sdk = createOpencodeClient({
      baseUrl: `http://127.0.0.1:${record.port}`,
      headers: { authorization: `Bearer ${token}` },
    })
    const client = createWahaClient({
      baseUrl: waha.url,
      session: SESSION,
      signal: controller.signal,
      log: (line) => logs.push(line),
    })
    const gateway = runGateway({
      sdk,
      client,
      allow: new Set([OPERATOR]),
      agent,
      session: SESSION,
      defaultJid: OPERATOR,
      dedupFile: path.join(root, "dedup.json"),
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      timers: { set: (cb, ms) => (((t) => () => clearTimeout(t))(setTimeout(cb, ms))) },
      cadenceMs: 0, // fast edits so progressive streaming is observable within the test window
      permissionTimeoutMs: 30_000,
      approvalTtlMs: 300_000,
      log: (line) => logs.push(line),
      signal: controller.signal,
    })
    yield* Effect.addFinalizer(() =>
      Effect.promise(async () => {
        controller.abort()
        await gateway.catch(() => {})
        waha.stop()
        await stop(dir).catch(() => {})
        await fs.rm(root, { recursive: true, force: true }).catch(() => {})
      }),
    )
    return { waha, url: `http://127.0.0.1:${record.port}`, headers: { authorization: `Bearer ${token}` }, logs }
  })
}

suite("TEST-WA: WhatsApp round trip + INV-001 + streaming (live, no account)", () => {
  // AC-018: stranger ignored (INV-001 at real-request level), operator gets a streamed
  // reply, outbound-only WS is dialled. The stranger path is the RISK-025-class assertion:
  // a real inbound frame from a non-allowlisted JID must produce ZERO outbound.
  it.live(
    "AC-018: a stranger is ignored; the operator gets a streamed reply",
    () =>
      Effect.gen(function* () {
        const llm = yield* TestLLMServer
        const { waha } = yield* setup(llm)
        // The gateway dials the WAHA WS out — no inbound port on Marid (OQ-004).
        const connected = yield* Effect.promise(() => waitFor(() => waha.socketCount() > 0, 30_000))
        expect(connected).toBe(true)

        // INV-001: a non-allowlisted sender gets no reply at all.
        waha.deliverMessage(STRANGER, "s1", "let me in")
        yield* wait(1500)
        expect(waha.sentText.filter((m) => m.chatId === STRANGER)).toHaveLength(0)

        // AC-018: the operator's question streams back a complete reply. 60s (× TIMING_SCALE)
        // absorbs the cold first-boot (compile + first instance launch + LLM round trip legitimately
        // ~32s on a cold 2-core runner — the documented marid-telegram flake); a real hang still
        // fails well under the 300s outer timeout.
        yield* llm.text("hello operator, here is your streamed answer")
        waha.deliverMessage(OPERATOR, "o1", "hi agent")
        const got = yield* Effect.promise(() => waitFor(() => waha.sentText.some((m) => m.chatId === OPERATOR), 60_000))
        expect(got).toBe(true)
        const finalText = [
          ...waha.sentText.filter((m) => m.chatId === OPERATOR).map((m) => m.text),
          ...waha.sentEdit.filter((m) => m.chatId === OPERATOR).map((m) => m.text),
        ].join(" ")
        expect(finalText).toContain("streamed answer")
        // Streaming-sim: presence("typing") was signalled during generation.
        expect(waha.presence.some((p) => p.presence === "typing")).toBe(true)
      }).pipe(Effect.provide(TestLLMServer.layer)),
    300_000,
  )

  // AC-018 media half: an inbound media frame is downloaded (through the real waha.ts
  // transport) and landed as a file part in the session prompt.
  it.live(
    "AC-018: an inbound media message is downloaded and lands as a file part",
    () =>
      Effect.gen(function* () {
        const llm = yield* TestLLMServer
        const { waha, logs } = yield* setup(llm)
        yield* Effect.promise(() => waitFor(() => waha.socketCount() > 0, 15_000))
        yield* llm.text("received your file")

        waha.deliverMedia(OPERATOR, "o2", { url: `${waha.url}/api/files/x.png`, mimetype: "image/png", filename: "x.png" })
        const landed = yield* Effect.promise(() =>
          waitFor(() => logs.some((l) => /attached \d+ inbound file part/.test(l)), 60_000),
        )
        expect(landed).toBe(true)
      }).pipe(Effect.provide(TestLLMServer.layer)),
    300_000,
  )

  // AC-022: a live bash tool call (gated to "ask") surfaces a token-text permission prompt,
  // and APPROVE <token> lets the tool run. Proves the sync-route-restores-tools path AND the
  // token approval end to end against a real server.
  it.live(
    "AC-022: a live tool call surfaces APPROVE <token>, and the token authorizes it",
    () =>
      Effect.gen(function* () {
        const llm = yield* TestLLMServer
        const { waha } = yield* setup(llm)
        yield* Effect.promise(() => waitFor(() => waha.socketCount() > 0, 15_000))
        yield* llm.tool("bash", { command: "echo hi" })

        waha.deliverMessage(OPERATOR, "o3", "please run echo hi")
        const gotPrompt = yield* Effect.promise(() =>
          waitFor(() => waha.sentText.some((m) => /APPROVE [0-9a-f]{8}/.test(m.text)), 60_000),
        )
        expect(gotPrompt).toBe(true)

        // Redeem the exact token the operator would see.
        const prompt = waha.sentText.find((m) => /APPROVE [0-9a-f]{8}/.test(m.text))!
        const token = /APPROVE ([0-9a-f]{8})/.exec(prompt.text)![1]
        const before = waha.sentText.length
        waha.deliverMessage(OPERATOR, "o4", `APPROVE ${token}`)
        // The approval is consumed (an ack is sent) and the tool proceeds — a fresh outbound
        // follows the approval. We assert the approval produced a server-side effect by the
        // acknowledgement text, not by the tool's stdout (the fake LLM ends the turn).
        const acked = yield* Effect.promise(() =>
          waitFor(() => waha.sentText.length > before && waha.sentText.some((m) => /Approved\./.test(m.text)), 60_000),
        )
        expect(acked).toBe(true)
      }).pipe(Effect.provide(TestLLMServer.layer)),
    300_000,
  )
})
