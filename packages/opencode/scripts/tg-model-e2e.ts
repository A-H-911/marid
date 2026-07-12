// WBS-6.6 · TEST-TG live MODEL tiers — the pieces the model-free slash harness can't reach.
//
// tg-userbot-e2e.ts proves the deny-by-default slash round-trip WITHOUT a model (deterministic,
// free). This harness adds the two tiers that need a real model turn, driven by a real LLM over
// the real gateway + real MTProto:
//
//   • AC-017 (evidence) — a live TEXT turn: the userbot messages the bot, the real model runs,
//     and its reply round-trips back to Telegram. (Markdown RENDERING is the AC-021 web tier;
//     inline keyboards / outbound file parts can't fire on the served run — the zero-tools
//     ceiling documented in telegram.test.ts — so this strengthens AC-017, it does NOT complete it.)
//   • AC-019 (Met) — live BIDIRECTIONAL mirroring + the negative control the AC names:
//       mirror-in  : the Telegram-originated turn is visible on the Web (admin) surface.
//       invisible  : an UNATTACHED web session's turn does NOT reach the channel (view-via-binding).
//       mirror-out : after the operator ATTACHES it, the web turn mirrors into Telegram — and the
//                    attach is picked up MID-STREAM via the WBS-6.5c self-bindings re-subscribe.
//
// LIVE + NON-GATING (ADR-0013): needs network + real creds + a paid model, so it runs via
// `bun run`, never `bun test`. INV-002: no secret (session, bot token, LLM key) is ever printed.
//
// Run (creds in the repo-root .env — TELEGRAM_* per telegram-userbot-e2e-setup.md, plus
// OPENROUTER_API_KEY):
//   cd packages/opencode && bun run scripts/tg-model-e2e.ts

import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { createTokenStore } from "@marid/auth"
import { instanceMaridDir, start, stop, type LaunchResolver } from "@marid/instance"
import { createBotApi, runGateway } from "@marid/telegram"
import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions/index.js"
import { NewMessage } from "telegram/events/index.js"

// --- config / env (repo-root .env, same loader as the slash harness) ---------------------
const ENV_PATH = new URL("../../../.env", import.meta.url)
for (const line of (await fs.readFile(ENV_PATH, "utf8").catch(() => "")).split("\n")) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const eq = t.indexOf("=")
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
}
const apiId = Number(process.env.TELEGRAM_API_ID)
const apiHash = process.env.TELEGRAM_API_HASH ?? ""
const session = process.env.TELEGRAM_TEST_SESSION ?? ""
const botToken = process.env.TELEGRAM_TEST_BOT_TOKEN ?? ""
const llmKey = process.env.OPENROUTER_API_KEY ?? ""
for (const [name, v] of [
  ["TELEGRAM_API_ID", apiId],
  ["TELEGRAM_API_HASH", apiHash],
  ["TELEGRAM_TEST_SESSION", session],
  ["TELEGRAM_TEST_BOT_TOKEN", botToken],
  ["OPENROUTER_API_KEY", llmKey],
] as const) {
  if (!v) {
    console.error(`Missing ${name} in ${ENV_PATH.pathname}. See docs/execution/telegram-userbot-e2e-setup.md.`)
    process.exit(1)
  }
}

const AGENT = "build"
// A live reasoning model runs before it answers, so a turn is slow AND variable — give it room.
const MODEL_TIMEOUT = 180_000
const CHANNEL_TOKEN = "tg-model" // the attach body binds a session to THIS channel token's name
const ok = (m: string) => console.log(`  ✅ ${m}`)
const step = (m: string) => console.log(`\n▶ ${m}`)
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// GLM 5.2 via OpenRouter as an OpenAI-compatible provider. Local model key is slash-free
// (`glm52`) so the ref `openrouter/glm52` parses cleanly; the real API id (which contains a
// slash) rides `id`. Key is injected at runtime only — never written to a tracked file.
function glmProviderConfig(apiKey: string) {
  return {
    formatter: false,
    lsp: false,
    provider: {
      openrouter: {
        name: "OpenRouter",
        id: "openrouter",
        env: [],
        npm: "@ai-sdk/openai-compatible",
        models: {
          glm52: {
            id: "z-ai/glm-5.2",
            name: "GLM 5.2",
            attachment: false,
            reasoning: false,
            temperature: true,
            tool_call: true,
            release_date: "2026-06-16",
            limit: { context: 128_000, output: 8_000 },
            cost: { input: 0, output: 0 },
            options: {},
          },
        },
        options: { apiKey, baseURL: "https://openrouter.ai/api/v1" },
      },
    },
    model: "openrouter/glm52",
  }
}

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
    OPENCODE_DISABLE_MODELS_FETCH: "1", // the model is defined statically in config
    OPENCODE_AUTH_CONTENT: "{}",
    OPENCODE_DB: "opencode.db",
    OPENCODE_CONFIG_CONTENT: JSON.stringify(glmProviderConfig(llmKey)),
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

// --- userbot inbox ------------------------------------------------------------------------
type BotMsg = { message?: string }
const inbox: BotMsg[] = []
const waiters: Array<{ test: (m: BotMsg) => boolean; resolve: (m: BotMsg) => void }> = []
const onBotMessage = (msg: BotMsg) => {
  inbox.push(msg)
  for (const w of [...waiters]) if (w.test(msg)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg) }
}
const waitFor = (test: (m: BotMsg) => boolean, label: string, timeoutMs = MODEL_TIMEOUT): Promise<BotMsg> => {
  const existing = inbox.find(test)
  if (existing) return Promise.resolve(existing)
  return new Promise((resolve, reject) => {
    const w = { test, resolve }
    waiters.push(w)
    setTimeout(() => {
      const i = waiters.indexOf(w)
      if (i >= 0) { waiters.splice(i, 1); reject(new Error(`timeout waiting for: ${label}`)) }
    }, timeoutMs)
  })
}

const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 })

// Collect every text part across a session's history — the Web (admin) view of a turn.
type Part = { type?: string; text?: string }
type Msg = { parts?: Part[]; info?: { parts?: Part[] } }
async function sessionText(sdk: ReturnType<typeof createOpencodeClient>, sessionID: string): Promise<string> {
  const msgs = (await sdk.session.messages({ sessionID }, { throwOnError: true }).then((r) => r.data)) as Msg[]
  return msgs
    .flatMap((m) => m.parts ?? m.info?.parts ?? [])
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n")
}

// Poll the admin's whole-instance view (admin is NOT owns∪bound-isolated) for a session whose
// history matches — i.e. a Telegram turn now visible on the Web surface.
async function waitForAdminSessionWith(
  sdk: ReturnType<typeof createOpencodeClient>,
  re: RegExp,
  timeoutMs: number,
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const sessions = (await sdk.session.list({}, { throwOnError: true }).then((r) => r.data)) as Array<{ id: string }>
    for (const s of sessions) if (re.test(await sessionText(sdk, s.id).catch(() => ""))) return s.id
    await sleep(1500)
  }
  return undefined
}

async function main() {
  step("Connect userbot (real account, production DC)")
  await client.connect()
  if (!(await client.checkAuthorization())) throw new Error("userbot session not authorized — re-mint TELEGRAM_TEST_SESSION")
  const userMe = await client.getMe()
  const userbotId = Number((userMe as { id: { toString(): string } }).id.toString())
  ok("userbot authorized") // never print identity/session

  step("Point the bot at getUpdates (drop any webhook so the gateway's long-poll doesn't 409)")
  await botApiRaw("deleteWebhook", { drop_pending_updates: true })
  const botMe = (await botApiRaw("getMe")) as { id: number; username: string }
  ok(`bot @${botMe.username} (id ${botMe.id})`)

  step("Launch the REAL stack: marid serve + channel token + admin token + runGateway (real GLM)")
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "tg-model-"))
  const dir = path.join(root, "inst")
  const fakeHome = path.join(root, "home")
  await fs.mkdir(fakeHome, { recursive: true })
  const store = createTokenStore(instanceMaridDir(dir))
  const chanToken = await store.create(CHANNEL_TOKEN, "channel:telegram", AGENT).then((r) => r.secret)
  const adminToken = await store.create("web-admin", "admin").then((r) => r.secret)
  const record = await start("inst", dir, launch, { env: overlay(fakeHome), timeoutMs: 60_000 })
  const baseUrl = `http://127.0.0.1:${record.port}`
  const chanSdk = createOpencodeClient({ baseUrl, headers: { authorization: `Bearer ${chanToken}` } })
  const adminSdk = createOpencodeClient({ baseUrl, headers: { authorization: `Bearer ${adminToken}` } })
  const bot = createBotApi({ token: botToken })
  const controller = new AbortController()
  // The channel token polls its OWN bindings so an operator attach re-subscribes the firehose
  // mid-stream (WBS-6.5c). Short cadence so the one-shot attach is picked up in seconds.
  const pollBindings = async () =>
    new Set(
      (await fetch(`${baseUrl}/marid/self-bindings`, { headers: { authorization: `Bearer ${chanToken}` } })
        .then((x) => x.json() as Promise<{ sessions?: string[] }>)
        .catch(() => ({ sessions: [] as string[] }))).sessions ?? [],
    )
  const gateway = runGateway({
    sdk: chanSdk,
    bot,
    allow: new Set([userbotId]),
    agent: AGENT,
    defaultChatId: userbotId, // a bound (web-originated) session with no chat renders here
    pollBindings,
    bindingPollMs: 2000,
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

  client.addEventHandler((event: { message?: { message?: string; senderId?: { toString(): string } } }) => {
    const msg = event.message
    if (msg && msg.senderId?.toString() === botMe.id.toString()) onBotMessage({ message: msg.message })
  }, new NewMessage({}))

  const teardown = async () => {
    controller.abort()
    await gateway.catch(() => {})
    await stop(dir).catch(() => {})
    await fs.rm(root, { recursive: true, force: true }).catch(() => {})
    await client.disconnect().catch(() => {})
  }

  try {
    // ── PART A — AC-017 live text turn + AC-019 mirror-IN ────────────────────────────────
    step("A · AC-017 — userbot sends a text turn; the real GLM reply round-trips to Telegram")
    await client.sendMessage(botMe.username, { message: "Reply with only the word PONG and nothing else." })
    await waitFor((m) => /pong/i.test(m.message ?? ""), "model reply containing PONG")
    ok("live model turn round-tripped Telegram → model → Telegram (AC-017 text evidence)")

    step("A · AC-019 mirror-in — the Telegram turn is visible on the Web (admin) surface")
    const seen = await waitForAdminSessionWith(adminSdk, /pong/i, 30_000)
    if (!seen) throw new Error("mirror-in: the Telegram turn never became visible on the admin surface")
    ok("Telegram turn mirrored to Web — admin sees the session + assistant reply")

    // ── PART B — AC-019 unattached-invisible negative control, then mirror-OUT ────────────
    step("B · AC-019 negative control — an UNATTACHED web session's turn must NOT reach the channel")
    const web = await adminSdk.session.create({ agent: AGENT, title: "web-mirror" }, { throwOnError: true }).then((r) => r.data)
    const mark = inbox.length
    await adminSdk.session.prompt(
      { sessionID: web.id, model: { providerID: "openrouter", modelID: "glm52" }, parts: [{ type: "text", text: "Reply with only the word ALPHA and nothing else." }] },
      { throwOnError: true },
    )
    await sleep(3000) // the web turn is complete; allow any (erroneous) mirror to land
    if (inbox.slice(mark).some((m) => /alpha/i.test(m.message ?? "")))
      throw new Error(
        "INV-001 LEAK: an UNATTACHED web session's turn reached the channel. /global/event is served UNFILTERED " +
          "to the channel token because the SDK's SSE request omits `Accept: text/event-stream`, so marid-auth's " +
          "isStream() gate skips the owns∪bound filter. Minimal deterministic repro + root cause: " +
          "scripts/global-event-isolation-repro.ts. This BLOCKS AC-019 (Met) and invalidates the mirror-out proof below.",
      )
    ok("unattached web session stayed invisible to the channel (view-via-binding, INV-001)")

    step("B · AC-019 mirror-out — operator ATTACHES the web session; its turn mirrors into Telegram")
    const attach = await fetch(`${baseUrl}/marid/attach`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({ token: CHANNEL_TOKEN, session: web.id }),
    }).then((x) => x.json() as Promise<{ attached?: boolean }>)
    if (!attach.attached) throw new Error("attach did not succeed")
    await sleep(6000) // let the self-bindings poll pick up the attach and re-subscribe the firehose
    const outMark = inbox.length
    await adminSdk.session.prompt(
      { sessionID: web.id, model: { providerID: "openrouter", modelID: "glm52" }, parts: [{ type: "text", text: "Reply with only the word BRAVO and nothing else." }] },
      { throwOnError: true },
    )
    await waitFor((m) => /bravo/i.test(m.message ?? ""), "attached web turn mirrored to Telegram")
    if (!inbox.slice(outMark).some((m) => /bravo/i.test(m.message ?? "")))
      throw new Error("mirror-out: the attached web turn did not reach Telegram")
    ok("attached web session mirrored into Telegram (mirror-out + WBS-6.5c attach re-subscribe)")

    console.log("\n════════════════════════")
    console.log(" TEST-TG live-model PASS — real GLM over the real gateway + real MTProto:")
    console.log("   AC-017 text round-trip ✓")
    console.log("   AC-019 mirror-in ✓   unattached-invisible ✓   mirror-out ✓")
    console.log("════════════════════════")
  } finally {
    await teardown()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: { errorMessage?: string; message?: string }) => {
    console.error("\n❌ TEST-TG live-model FAIL:", err?.errorMessage ?? err?.message ?? String(err))
    process.exit(1)
  })
