// EXP-007 — GramJS userbot ↔ real bot, live round-trip on the production DC.
//
// De-risks the AUTOMATED real-client test tier (ADR-0013 tier 2, TEST-TG-E2E):
// a GramJS userbot logged in with the real throwaway account (TELEGRAM_TEST_SESSION)
// drives a real Bot-API bot (TELEGRAM_TEST_BOT_TOKEN) over real MTProto:
//   1. /start           -> assert the bot's reply + inline keyboard
//   2. tap inline button -> assert the callback is answered + acknowledged
//   3. send a document   -> assert the bot echoes it back (receive a file)
//
// The bot side here is a MINIMAL STUB (raw Bot API), NOT the production Marid
// gateway — the real gateway behavior is WBS-6.2/6.6 (not built yet). EXP-007
// proves the userbot HARNESS mechanism works end-to-end; it is bot-agnostic.
//
// Live + non-gating by design (ADR-0013): needs network + real creds, so it is a
// Node .mjs script (GramJS-on-Bun unverified), NOT part of the deterministic
// `bun test` gate. Run in a terminal:
//   cd packages/marid-telegram && node scripts/exp-007-userbot-e2e.mjs
//
// INV-002: the session string and bot token are NEVER printed; the temp payload
// lives in the OS temp dir (not the repo) and is deleted on exit.

import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions/index.js"
import { NewMessage } from "telegram/events/index.js"
import { readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// --- config -----------------------------------------------------------------
const ENV_PATH = new URL("../../../.env", import.meta.url)
for (const line of (() => { try { return readFileSync(ENV_PATH, "utf8") } catch { return "" } })().split("\n")) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const eq = t.indexOf("=")
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
}

const apiId = Number(process.env.TELEGRAM_API_ID)
const apiHash = process.env.TELEGRAM_API_HASH
const session = process.env.TELEGRAM_TEST_SESSION
const botToken = process.env.TELEGRAM_TEST_BOT_TOKEN
for (const [name, v] of [["TELEGRAM_API_ID", apiId], ["TELEGRAM_API_HASH", apiHash], ["TELEGRAM_TEST_SESSION", session], ["TELEGRAM_TEST_BOT_TOKEN", botToken]]) {
  if (!v) { console.error(`Missing ${name} in ${ENV_PATH.pathname}. See docs/execution/telegram-userbot-e2e-setup.md.`); process.exit(1) }
}

const STEP_TIMEOUT = 20000
const ok = (m) => console.log(`  ✅ ${m}`)
const step = (m) => console.log(`\n▶ ${m}`)

// --- bot side (raw Bot API stub) --------------------------------------------
const BOT = `https://api.telegram.org/bot${botToken}`
const api = async (method, params) => {
  const r = await fetch(`${BOT}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params ?? {}),
  }).then((x) => x.json())
  if (!r.ok) throw new Error(`Bot API ${method} failed: ${r.description}`)
  return r.result
}

let polling = false
const startBotStub = async () => {
  await api("deleteWebhook", { drop_pending_updates: true }) // getUpdates 409s if a webhook was ever set
  const me = await api("getMe")
  polling = true
  let offset = 0
  const loop = async () => {
    while (polling) {
      const updates = await api("getUpdates", { offset, timeout: 2 }).catch(() => [])
      for (const u of updates) {
        offset = u.update_id + 1
        const msg = u.message
        if (msg?.text?.startsWith("/start")) {
          await api("sendMessage", {
            chat_id: msg.chat.id,
            text: "Marid test bot online. Tap to continue.",
            reply_markup: { inline_keyboard: [[{ text: "Continue", callback_data: "go" }]] },
          })
        } else if (u.callback_query) {
          await api("answerCallbackQuery", { callback_query_id: u.callback_query.id, text: "Tapped ✓" })
          await api("sendMessage", { chat_id: u.callback_query.message.chat.id, text: "Button acknowledged." })
        } else if (msg?.document) {
          await api("sendMessage", { chat_id: msg.chat.id, text: `Got your file: ${msg.document.file_name}` })
          await api("sendDocument", { chat_id: msg.chat.id, document: msg.document.file_id }) // echo by file_id — no multipart
        }
      }
    }
  }
  loop().catch((e) => console.error("bot loop error:", e.message))
  return { id: me.id, username: me.username }
}

// --- userbot side (GramJS) --------------------------------------------------
const inbox = []
const waiters = []
const onBotMessage = (msg) => {
  inbox.push(msg)
  for (const w of [...waiters]) if (w.test(msg)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg) }
}
const waitFor = (test, label) => {
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
let payloadPath = null

const run = async () => {
  step("Start bot stub (Bot API) and confirm it is live before the userbot acts")
  const bot = await startBotStub()
  ok(`bot stub live: @${bot.username} (id ${bot.id})`)

  step("Connect userbot with the real-account session (production DC)")
  await client.connect()
  if (!(await client.checkAuthorization())) throw new Error("userbot session is not authorized — re-mint TELEGRAM_TEST_SESSION")
  ok("userbot authorized") // never print the account identity/session

  const botId = bot.id.toString()
  client.addEventHandler((event) => {
    const msg = event.message
    if (msg && msg.senderId?.toString() === botId) onBotMessage(msg)
  }, new NewMessage({}))

  step("1/3 · /start → assert reply + inline keyboard")
  await client.sendMessage(bot.username, { message: "/start" })
  const reply = await waitFor((m) => (m.message || "").includes("Marid test bot online"), "/start reply")
  if (!reply.replyMarkup) throw new Error("reply carried no inline keyboard")
  ok("received reply text + inline keyboard")

  step("2/3 · tap inline button → assert callback answered + acknowledged")
  const answer = await reply.click({ i: 0 })
  ok(`callback answered by bot: "${answer?.message || "(answer received)"}"`)
  await waitFor((m) => (m.message || "").includes("Button acknowledged"), "callback acknowledgement")
  ok("received post-tap acknowledgement message")

  step("3/3 · send a document → assert the bot echoes a file back (receive)")
  payloadPath = join(tmpdir(), `exp-007-payload-${bot.id}.txt`)
  writeFileSync(payloadPath, `EXP-007 payload — real-protocol file round-trip.\n`)
  await client.sendFile(bot.username, { file: payloadPath, forceDocument: true, caption: "exp-007 upload" })
  await waitFor((m) => (m.message || "").includes("Got your file"), "file-received ack")
  ok("bot acknowledged the uploaded document")
  const echoed = await waitFor((m) => !!m.document, "echoed document")
  ok(`received a document back (${echoed.document.size} bytes) — file round-trip complete`)

  console.log("\n══════════════════════════════════════════════════════")
  console.log(" EXP-007 PASS — userbot ↔ bot real-protocol round-trip:")
  console.log("   reply+keyboard ✓   inline-button callback ✓   file both ways ✓")
  console.log("══════════════════════════════════════════════════════")
}

const teardown = async () => {
  polling = false
  await client.disconnect().catch(() => {})
  if (payloadPath) rmSync(payloadPath, { force: true })
}

run()
  .then(async () => { await teardown(); process.exit(0) })
  .catch(async (err) => { console.error("\n❌ EXP-007 FAIL:", err?.errorMessage || err?.message || String(err)); await teardown(); process.exit(1) })
