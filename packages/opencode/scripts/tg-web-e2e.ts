// WBS-6.6 · AC-021 (TEST-TG-UI) — Telegram-Web rendered-UX tier (ADR-0013 tier 3, EXP-009).
//
// Proves the piece the userbot (protocol) and served-model (round-trip) tiers cannot: that a
// bot reply RENDERS correctly in a real Telegram client. It exercises marid-telegram's REAL
// MarkdownV2 formatter (telegramify-markdown) end-to-end — the exact code path behind the
// ADR-0008 "raw **bold** reached the chat literally" defect cluster — against production
// web.telegram.org.
//
// SHAPE (why two runtimes): Playwright's browser launch HANGS under Bun, so the browser half
// lives in a Node child (tg-web-driver.mjs). This Bun half owns the deterministic backend:
//   real marid serve  +  a fake LLM emitting fixed markdown (bold/inline-code/fenced block
//   with a per-run nonce)  +  real runGateway  +  REAL Bot API → production Telegram.
// The Node driver, logged in as the operator's OWN web account (persisted by tg-web-login.mjs),
// sends a trigger into the bot chat and reads the RENDERED DOM back, asserting real <strong>/
// <code>/<pre> markup (not literal `**…**`).
//
// PRODUCTION vs the AC's literal "test DC": AC-021/EXP-009 name the test DC (?test=1), but the
// entire live PH-6 harness (AC-019/020) and the operator's login are on PRODUCTION Telegram;
// operator-confirmed to match that precedent (recorded in docs/experiments/exp-009-report.md).
//
// LIVE + NON-GATING (ADR-0013): needs network + real creds + a logged-in web profile, so it
// runs via `bun run`, never `bun test`. INV-002: no bot token / session is ever printed.
//
// Prereqs (one-time): `node scripts/tg-web-login.mjs` (writes TELEGRAM_OPERATOR_ID +
// TELEGRAM_BOT_USERNAME to .env, persists .pw-telegram/). Then:
//   cd packages/opencode && bun run scripts/tg-web-e2e.ts

import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { createTokenStore } from "@marid/gateway"
import { instanceMaridDir, start, stop, type LaunchResolver } from "@marid/instance"
import { createBotApi, runGateway } from "@marid/telegram"
import { testProviderConfig } from "../test/lib/test-provider"

// --- env (repo-root .env, same loader as the userbot/model harnesses) --------------------
const ENV_PATH = new URL("../../../.env", import.meta.url)
for (const line of (await fs.readFile(ENV_PATH, "utf8").catch(() => "")).split("\n")) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const eq = t.indexOf("=")
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
}
const botToken = process.env.TELEGRAM_TEST_BOT_TOKEN ?? ""
const operatorId = Number(process.env.TELEGRAM_OPERATOR_ID)
const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? ""
if (!botToken || !operatorId || !botUsername) {
  console.error(
    "Missing TELEGRAM_TEST_BOT_TOKEN / TELEGRAM_OPERATOR_ID / TELEGRAM_BOT_USERNAME in .env.\n" +
      "Run the one-time login first:  node scripts/tg-web-login.mjs",
  )
  process.exit(1)
}

const AGENT = "build"
const CHANNEL_TOKEN = "tg-web"
const USER_DATA_DIR = new URL("../.pw-telegram/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const ok = (m: string) => console.log(`  ✅ ${m}`)
const step = (m: string) => console.log(`\n▶ ${m}`)
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// A unique-per-run token so the driver matches THIS run's reply, never stale chat history.
const nonce = `MARID${Date.now().toString(36).toUpperCase()}`
// Caption for the media half of AC-021 (a bot-sent photo). Distinct from `nonce`.
const mediaNonce = `MARIDMEDIA${Date.now().toString(36).toUpperCase()}`
// A stable public image Telegram's servers can fetch by URL (marid's onFile outbound path
// sends an instance-local URL Telegram can't reach — documented ceiling at gateway.ts:111 —
// so the LIVE media-render assertion uses bot.sendPhoto with a public URL, exercising marid's
// real Bot API send path; the mime→sendPhoto/onFile decision is unit-covered separately).
const PUBLIC_IMAGE = "https://telegram.org/img/t_logo.png"

// The reply the fake LLM emits: exercises bold + inline code + a fenced block. The nonce is
// the LAST element (in the bold), so when the driver sees it the code+fence are already there.
const REPLY_MD = [
  "AC-021 render check.",
  "Inline: `code_span_ok`",
  "Block:",
  "```",
  "fenced_line_ok",
  "```",
  `Bold: **${nonce}**`,
].join("\n")

// --- inline fake LLM: an OpenAI-compatible /v1/chat/completions SSE endpoint --------------
// Mirrors test/lib/llm-server.ts's chunk shape. Always answers the main turn with REPLY_MD;
// answers opencode's title-generation call with a short title (never streamed to Telegram).
function sse(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`
}
function chunk(delta: Record<string, unknown>, finish?: string): unknown {
  return {
    id: "chatcmpl-e2e",
    object: "chat.completion.chunk",
    choices: [{ index: 0, delta, ...(finish ? { finish_reason: finish } : {}) }],
  }
}
function streamText(text: string): Response {
  const body =
    sse(chunk({ role: "assistant" })) + sse(chunk({ content: text })) + sse(chunk({}, "stop")) + "data: [DONE]\n\n"
  return new Response(body, { headers: { "content-type": "text/event-stream" } })
}
const fakeLlm = Bun.serve({
  port: 0,
  idleTimeout: 120,
  async fetch(req) {
    const url = new URL(req.url)
    if (!url.pathname.endsWith("/chat/completions")) return new Response("not found", { status: 404 })
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    if (JSON.stringify(body).includes("Generate a title")) return streamText("AC-021 render check")
    return streamText(REPLY_MD)
  },
})
const llmUrl = `http://127.0.0.1:${fakeLlm.port}/v1`
// Same fake-provider config the sibling telegram.test.ts uses; add a default model so a prompt
// without an explicit model runs against it.
const configContent = JSON.stringify({ ...testProviderConfig(llmUrl), model: "test/test-model" })

const maridEntry = path.resolve(import.meta.dir, "../src/marid.ts")
const launch: LaunchResolver = () => ({
  command: process.execPath,
  args: ["run", "--conditions=browser", maridEntry, "serve", "--port", "0"],
})
function overlay(fakeHome: string): Record<string, string> {
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
    OPENCODE_CONFIG_CONTENT: configContent,
  }
}

const botApiRaw = async (method: string, params?: Record<string, unknown>) => {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params ?? {}),
  }).then((x) => x.json() as Promise<{ ok: boolean; result?: unknown; description?: string }>)
  if (!r.ok) throw new Error(`Bot API ${method} failed: ${r.description}`)
  return r.result
}

// Spawn the Node Playwright driver; return its single JSON verdict line.
type Verdict = { ok: boolean; checks?: Record<string, boolean>; html?: string; error?: string }
function runDriver(): Promise<Verdict> {
  return new Promise((resolve, reject) => {
    const driver = path.resolve(import.meta.dir, "tg-web-driver.mjs")
    const child = spawn("node", [driver], {
      env: {
        ...process.env,
        BOT_USERNAME: botUsername,
        // The trigger MUST NOT contain the nonce — else the driver would match the operator's
        // own outgoing bubble instead of the bot's reply. The fake LLM ignores the trigger text.
        TRIGGER_TEXT: "render check please",
        EXPECT_NONCE: nonce,
        MEDIA_NONCE: mediaNonce,
        USER_DATA_DIR,
      },
      stdio: ["ignore", "pipe", "inherit"],
    })
    let stdout = ""
    child.stdout.on("data", (d) => (stdout += d.toString()))
    child.on("error", reject)
    child.on("close", () => {
      const line = stdout.trim().split("\n").filter(Boolean).pop() ?? ""
      if (!line) return reject(new Error("driver produced no output"))
      try {
        resolve(JSON.parse(line) as Verdict)
      } catch {
        reject(new Error(`driver output not JSON: ${line}`))
      }
    })
  })
}

async function main() {
  step("Point the bot at getUpdates (drop any webhook so the gateway long-poll doesn't 409)")
  await botApiRaw("deleteWebhook", { drop_pending_updates: true })
  ok(`bot @${botUsername} · operator id ${operatorId} · nonce ${nonce}`)

  step("Launch the REAL stack: marid serve + channel token + runGateway (fake LLM, real Bot API)")
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "tg-web-"))
  const dir = path.join(root, "inst")
  const fakeHome = path.join(root, "home")
  await fs.mkdir(fakeHome, { recursive: true })
  const store = createTokenStore(instanceMaridDir(dir))
  const chanToken = await store.create(CHANNEL_TOKEN, "channel:telegram", AGENT).then((r) => r.secret)
  const record = await start("inst", dir, launch, { env: overlay(fakeHome), timeoutMs: 60_000 })
  const baseUrl = `http://127.0.0.1:${record.port}`
  const chanSdk = createOpencodeClient({ baseUrl, headers: { authorization: `Bearer ${chanToken}` } })
  const bot = createBotApi({ token: botToken })
  const controller = new AbortController()
  const gateway = runGateway({
    sdk: chanSdk,
    bot,
    allow: new Set([operatorId]),
    agent: AGENT,
    defaultChatId: operatorId,
    dedupFile: path.join(root, "dedup.json"),
    now: () => Date.now(),
    sleep,
    timers: { set: (cb, ms) => (((t) => () => clearTimeout(t))(setTimeout(cb, ms))) },
    cadenceMs: 0,
    pollTimeoutSec: 1,
    log: () => {}, // never surface the bot token
    signal: controller.signal,
  })
  ok(`gateway attached to instance on port ${record.port}`)

  const teardown = async () => {
    controller.abort()
    await gateway.catch(() => {})
    await stop(dir).catch(() => {})
    await fs.rm(root, { recursive: true, force: true }).catch(() => {})
    fakeLlm.stop(true)
  }

  try {
    step("Send a bot photo (marid Bot API, public URL) for the AC-021 media-render half")
    await bot.sendPhoto(operatorId, PUBLIC_IMAGE, `media ${mediaNonce}`)
    ok("photo dispatched to the operator's chat")

    step("Drive Telegram Web (Playwright, operator's own account): send trigger, read rendered reply")
    const v = await runDriver()
    if (v.error) throw new Error(v.error)
    console.log(`  driver checks: ${JSON.stringify(v.checks)}`)
    if (!v.checks?.bold) throw new Error("bold did not render as <strong> (MarkdownV2 formatter regression?)")
    if (!v.checks?.code) throw new Error("inline code did not render as <code>")
    if (!v.checks?.noLiteralStars) throw new Error(`literal **${nonce}** reached the chat — telegramify NOT applied (ADR-0008 defect-1 regression)`)
    if (!v.checks?.pre) console.log("  ⚠ fenced block did not render as <pre> (non-fatal; bold+code are the core assertion)")
    ok("bot reply RENDERED as real markup in web.telegram.org (<strong> + <code>) — AC-021 markdown fidelity")
    if (!v.checks?.media) throw new Error("bot photo did not render as an <img> in the web client (AC-021 media half)")
    ok("bot photo RENDERED as an image bubble in web.telegram.org — AC-021 media fidelity")

    console.log("\n════════════════════════")
    console.log(" TEST-TG-UI PASS — real marid MarkdownV2 formatter + Bot API → real Bot API → web.telegram.org:")
    console.log(`   bold <strong> ✓   inline <code> ✓   no literal markdown ✓${v.checks?.pre ? "   fenced <pre> ✓" : ""}   media <img> ✓`)
    console.log("════════════════════════")
  } finally {
    await teardown()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: { message?: string }) => {
    console.error("\n❌ TEST-TG-UI FAIL:", err?.message ?? String(err))
    fakeLlm.stop(true)
    process.exit(1)
  })
