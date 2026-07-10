// EXP-007 Step 2 — mint TELEGRAM_TEST_SESSION (one-time).
//
// Logs a GramJS userbot into Telegram's TEST DC using a synthetic phone number
// and the fixed test code, then writes a StringSession into the repo-root .env as
// TELEGRAM_TEST_SESSION. No SMS, no real account, zero ban risk.
//
// Non-interactive / env-driven (so it works piped, in CI, and without a TTY):
//   TG_TEST_PHONE  synthetic number   (default 9996621234 = test DC 2)
//   TG_TEST_CODE   fixed login code    (default 22222     = DC id x5)
//   TG_TEST_NAME   signup first name   (default MaridTest, first login only)
//   TG_TEST_2FA    2FA password        (default empty)
// Rule: the 3rd digit of the number is the DC id (1-3); the code is that digit x5.
//   DC 1 -> 9996611111 / 11111 · DC 2 -> 9996621234 / 22222 · DC 3 -> 9996631234 / 33333
//
// Run from packages/marid-telegram (GramJS is Node-first — prefer Node over Bun):
//   node scripts/tg-test-login.mjs
//   TG_TEST_PHONE=9996627777 node scripts/tg-test-login.mjs   # retry with a fresh number

import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions/index.js"
import { readFileSync, writeFileSync } from "node:fs"

// Repo-root .env, resolved relative to THIS file (CWD-independent).
const ENV_PATH = new URL("../../../.env", import.meta.url)

function loadRootEnv() {
  const text = (() => {
    try {
      return readFileSync(ENV_PATH, "utf8")
    } catch {
      return ""
    }
  })()
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = value
  }
}

// Upsert one KEY=value into the root .env (create the file/line if absent), so the
// session string is persisted WITHOUT ever being printed to a log (INV-002).
function upsertEnv(key, value) {
  const text = (() => {
    try {
      return readFileSync(ENV_PATH, "utf8")
    } catch {
      return ""
    }
  })()
  const line = `${key}=${value}`
  const lines = text.split("\n")
  const i = lines.findIndex((l) => l.trim().startsWith(`${key}=`))
  if (i === -1) lines.push(line)
  else lines[i] = line
  writeFileSync(ENV_PATH, lines.join("\n"))
}

loadRootEnv()

const apiId = Number(process.env.TELEGRAM_API_ID)
const apiHash = process.env.TELEGRAM_API_HASH
if (!apiId || !apiHash) {
  console.error("Missing TELEGRAM_API_ID / TELEGRAM_API_HASH in " + ENV_PATH.pathname + " (Step 1).")
  process.exit(1)
}

const phone = process.env.TG_TEST_PHONE || "9996621234"
const code = process.env.TG_TEST_CODE || "22222"
const name = process.env.TG_TEST_NAME || "MaridTest"
const password = process.env.TG_TEST_2FA || ""
console.log(`Logging in to test DC with phone ${phone}, code ${code} (name "${name}" if signup)…`)

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 3,
  testServers: true, // connect to the TEST DC
})

const run = async () => {
  await client.start({
    phoneNumber: async () => phone,
    phoneCode: async () => code,
    password: async () => password,
    firstAndLastNames: async () => [name, ""],
    onError: (err) => {
      throw err
    },
  })
  upsertEnv("TELEGRAM_TEST_SESSION", client.session.save())
  console.log(`OK — TELEGRAM_TEST_SESSION written to ${ENV_PATH.pathname} (value hidden, INV-002).`)
  await client.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error("login failed:", err?.errorMessage || err?.message || String(err))
  process.exit(1)
})
