// WBS-6.6 · AC-021 (TEST-TG-UI) — one-time headed login bootstrap for the Telegram-Web
// Playwright tier. Telegram Web /k/ keeps its session in localStorage + IndexedDB, which a
// Playwright `storageState` snapshot does NOT capture — so we persist the WHOLE browser
// profile via `launchPersistentContext(userDataDir)`. Run this ONCE (headed); scan the QR
// with your phone; the session then persists in `.pw-telegram/` (git-ignored) and every
// later `tg-web-driver.mjs` run reuses it headless.
//
// It also records your bot's @username (getMe) into .env. The operator's numeric user id is
// captured separately by tg-web-probe.mjs (webk keeps the user id in IndexedDB, not
// localStorage — a getUpdates probe is the robust way to read it).
//
// RUNS UNDER NODE, NOT BUN: Playwright's browser launch hangs under Bun (driver expects
// Node). INV-002: no bot token / session string is ever printed. Run:
//   cd packages/opencode && node scripts/tg-web-login.mjs

import fs from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const ENV_PATH = fileURLToPath(new URL("../../../.env", import.meta.url))
const USER_DATA_DIR = fileURLToPath(new URL("../.pw-telegram/", import.meta.url))
const WEBK = "https://web.telegram.org/k/"

// Load .env exactly like the userbot/model harnesses (repo-root, KEY=VALUE, # comments).
async function loadEnv() {
  const raw = await fs.readFile(ENV_PATH, "utf8").catch(() => "")
  const env = {}
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
  }
  return env
}

// Upsert KEY=value into the repo-root .env (in place; preserves other lines/comments).
async function upsertEnv(key, value) {
  const raw = await fs.readFile(ENV_PATH, "utf8").catch(() => "")
  const lines = raw.length ? raw.split("\n") : []
  const idx = lines.findIndex((l) => l.trim().startsWith(`${key}=`))
  if (idx === -1) lines.push(`${key}=${value}`)
  else lines[idx] = `${key}=${value}`
  await fs.writeFile(ENV_PATH, lines.join("\n").replace(/\n*$/, "\n"))
}

async function getBotUsername(token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  const body = await res.json()
  if (!body.ok || !body.result?.username) throw new Error("getMe failed — is TELEGRAM_TEST_BOT_TOKEN valid?")
  return body.result.username
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const env = await loadEnv()
  const botToken = env.TELEGRAM_TEST_BOT_TOKEN
  if (!botToken) {
    console.error("Missing TELEGRAM_TEST_BOT_TOKEN in .env (see docs/execution/telegram-userbot-e2e-setup.md).")
    process.exit(1)
  }
  const botUsername = await getBotUsername(botToken)
  console.log(`\n▶ Bot resolved: @${botUsername}`)

  console.log(`▶ Launching headed Chromium (persistent profile: .pw-telegram/) …`)
  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, { headless: false })
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.goto(WEBK)

  console.log("\n  ┌─────────────────────────────────────────────────────────────────┐")
  console.log("  │  ACTION NEEDED: a Chromium window opened on web.telegram.org.     │")
  console.log("  │  1. Scan the QR with your phone: Telegram → Settings → Devices →  │")
  console.log("  │     Link Desktop Device → point camera at the window.            │")
  console.log("  │  2. CONFIRM the login on your phone if it prompts.               │")
  console.log("  │  Waiting up to 8 min for the chat list to appear …               │")
  console.log("  └─────────────────────────────────────────────────────────────────┘\n")

  // Reliable logged-in signal: webk registers the account (number_of_accounts ≥ 1) AND the
  // QR login page is gone. (dc<N>_auth_key alone is only the MTProto transport key, written
  // on connect BEFORE login — not a logged-in signal.)
  const deadline = Date.now() + 8 * 60_000
  let authed = false
  while (Date.now() < deadline) {
    authed = await page
      .evaluate(() => {
        const n = Number(window.localStorage.getItem("number_of_accounts") || "0")
        const onLoginPage = /Scan with Telegram|Log in by QR/i.test(document.body.innerText || "")
        return n >= 1 && !onLoginPage
      })
      .catch(() => false)
    if (authed) break
    await sleep(2000)
  }

  if (!authed) {
    console.error("\n❌ Did not detect a logged-in session (no registered account / still on the QR page). Re-run and complete the scan + phone confirmation.")
    await ctx.close()
    process.exit(1)
  }

  console.log(`\n  ✅ Logged in — chat list is up.`)
  await upsertEnv("TELEGRAM_BOT_USERNAME", botUsername)
  console.log(`  ✅ Wrote TELEGRAM_BOT_USERNAME to .env`)
  console.log(`  ✅ Session persisted in .pw-telegram/ — next: node scripts/tg-web-probe.mjs (captures your user id).\n`)

  // Give IndexedDB a moment to flush the profile to disk before we close.
  await sleep(1500)
  await ctx.close()
  console.log("Done. You can close any leftover window.")
}

main().catch((e) => {
  console.error("login bootstrap failed:", e instanceof Error ? e.message : e)
  process.exit(1)
})
