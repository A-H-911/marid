// WBS-6.6 · TEST-TG-E2E — GramJS userbot ↔ the REAL Marid Telegram gateway (live, non-gating).
//
// EXP-007 proved the userbot HARNESS against a bot STUB; this wires it against the REAL gateway.
// It reuses the PROVEN programmatic wiring from test/marid/telegram.test.ts (a real `marid serve`
// via @marid/instance, a channel token via createTokenStore(instanceMaridDir), and runGateway with
// the REAL Bot API) — only the fake bot + fake `deliverMessage` are replaced by real Telegram + a
// real GramJS userbot. Assertions are MODEL-FREE (whitelisted/denied slash commands reply without
// prompting a model), so no provider/LLM is needed and the round-trip is deterministic.
//
// What this proves: a real Telegram client, over real MTProto, drives the real gateway's
// deny-by-default slash routing (AC-020 slash-command tier). Text/file turns (which need a model)
// are a follow-up once a provider is configured — the mechanism is identical (the gateway path is
// the same; only the reply source differs).
//
// LIVE + NON-GATING (ADR-0013): needs network + real creds, so it runs via `bun run`, NOT `bun test`
// — it never blocks a PR. INV-002: the session string and bot token are NEVER printed.
//
// Run (creds in the repo-root .env — see docs/execution/telegram-userbot-e2e-setup.md):
//   cd packages/opencode && bun run scripts/tg-userbot-e2e.ts
//
// CAVEAT (operator-verified): GramJS-on-Bun is unverified (DEP-014). Imports load under Bun; if the
// live MTProto connection misbehaves under Bun, run the gateway (bun) and userbot (node) as two
// processes — the gateway wiring is unchanged; only the userbot side moves to node.

import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { createTokenStore } from "@marid/gateway"
import { instanceMaridDir, start, stop, type LaunchResolver } from "@marid/instance"
import { createBotApi, runGateway } from "@marid/telegram"
import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions/index.js"
import { NewMessage } from "telegram/events/index.js"
import { testProviderConfig } from "../test/lib/test-provider"

// --- config / env (repo-root .env, same loader as EXP-007) ------------------------------
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
for (const [name, v] of [["TELEGRAM_API_ID", apiId], ["TELEGRAM_API_HASH", apiHash], ["TELEGRAM_TEST_SESSION", session], ["TELEGRAM_TEST_BOT_TOKEN", botToken]] as const) {
  if (!v) {
    console.error(`Missing ${name} in ${ENV_PATH.pathname}. See docs/execution/telegram-userbot-e2e-setup.md.`)
    process.exit(1)
  }
}

const AGENT = "build" // a built-in agent; slash commands never actually prompt it
const STEP_TIMEOUT = 25_000
const ok = (m: string) => console.log(`  ✅ ${m}`)
const step = (m: string) => console.log(`\n▶ ${m}`)

// The instance launch: a real `marid serve` on an OS-assigned port (mirrors telegram.test.ts).
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
    // A provider is configured so serve boots exactly as in the passing E2E; the URL is never hit
    // (slash commands don't prompt), and MODELS_FETCH is disabled so a dead URL is inert.
    OPENCODE_CONFIG_CONTENT: JSON.stringify({ ...testProviderConfig("http://127.0.0.1:1"), model: "test/test-model" }),
  }
}

// --- raw Bot API (createBotApi has no getMe/deleteWebhook) --------------------------------
const botApiRaw = async (method: string, params?: Record<string, unknown>) => {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params ?? {}),
  }).then((x) => x.json() as Promise<{ ok: boolean; result?: unknown; description?: string }>)
  if (!r.ok) throw new Error(`Bot API ${method} failed: ${r.description}`)
  return r.result
}

// --- userbot inbox (EXP-007 pattern) -----------------------------------------------------
type BotMsg = { message?: string; senderId?: { toString(): string } }
const inbox: BotMsg[] = []
const waiters: Array<{ test: (m: BotMsg) => boolean; resolve: (m: BotMsg) => void }> = []
const onBotMessage = (msg: BotMsg) => {
  inbox.push(msg)
  for (const w of [...waiters]) if (w.test(msg)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg) }
}
const waitFor = (test: (m: BotMsg) => boolean, label: string): Promise<BotMsg> => {
  const existing = inbox.find(test)
  if (existing) return Promise.resolve(existing)
  return new Promise((resolve, reject) => {
    const w = { test, resolve }
    waiters.push(w)
    setTimeout(() => {
      const i = waiters.indexOf(w)
      if (i >= 0) { waiters.splice(i, 1); reject(new Error(`timeout waiting for: ${label}`)) }
    }, STEP_TIMEOUT)
  })
}

const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 })

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

  step("Launch the REAL gateway stack (marid serve + channel token + runGateway, real Bot API)")
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "tg-userbot-"))
  const dir = path.join(root, "inst")
  const fakeHome = path.join(root, "home")
  await fs.mkdir(fakeHome, { recursive: true })
  const token = await createTokenStore(instanceMaridDir(dir)).create("userbot-e2e", "channel:telegram", AGENT).then((r) => r.secret)
  const record = await start("inst", dir, launch, { env: overlay(fakeHome), timeoutMs: 60_000 })
  const sdk = createOpencodeClient({ baseUrl: `http://127.0.0.1:${record.port}`, headers: { authorization: `Bearer ${token}` } })
  const bot = createBotApi({ token: botToken })
  const controller = new AbortController()
  const gateway = runGateway({
    sdk,
    bot,
    allow: new Set([userbotId]), // only the userbot (as the operator) is served
    agent: AGENT,
    dedupFile: path.join(root, "dedup.json"),
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    timers: { set: (cb, ms) => (((t) => () => clearTimeout(t))(setTimeout(cb, ms))) },
    cadenceMs: 0,
    pollTimeoutSec: 1,
    log: () => {}, // never surface the bot token
    signal: controller.signal,
  })
  ok(`gateway attached to instance on port ${record.port}`)

  // Route the bot's replies to the inbox.
  client.addEventHandler((event: { message?: BotMsg }) => {
    const msg = event.message
    if (msg && msg.senderId?.toString() === botMe.id.toString()) onBotMessage(msg)
  }, new NewMessage({}))

  const teardown = async () => {
    controller.abort()
    await gateway.catch(() => {})
    await stop(dir).catch(() => {})
    await fs.rm(root, { recursive: true, force: true }).catch(() => {})
    await client.disconnect().catch(() => {})
  }

  try {
    step("1/3 · /help → the gateway replies with the command list (whitelisted, model-free)")
    await client.sendMessage(botMe.username, { message: "/help" })
    await waitFor((m) => (m.message ?? "").includes("Commands:"), "/help reply")
    ok("received the /help command list")

    step("2/3 · /frobnicate → deny-by-default: an unknown slash is refused, never prompted")
    await client.sendMessage(botMe.username, { message: "/frobnicate" })
    await waitFor((m) => (m.message ?? "").toLowerCase().includes("unknown command"), "unknown-command reply")
    ok("unknown slash command refused (deny-by-default)")

    step("3/3 · /new → the whitelisted new-session command runs")
    await client.sendMessage(botMe.username, { message: "/new" })
    await waitFor((m) => (m.message ?? "").includes("Started a new session"), "/new reply")
    ok("new-session command acknowledged")

    console.log("\n════════════════════════")
    console.log(" TEST-TG-E2E PASS — userbot ↔ REAL gateway, real-protocol slash round-trip:")
    console.log("   /help ✓   unknown-refused ✓   /new ✓")
    console.log("════════════════════════")
  } finally {
    await teardown()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ TEST-TG-E2E FAIL:", err?.errorMessage ?? err?.message ?? String(err))
    process.exit(1)
  })
