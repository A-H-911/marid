// EXP-007 — mint TELEGRAM_TEST_SESSION (one-time), for either:
//   • a REAL dedicated throwaway account (production DC) — the working userbot path,
//     since the login code is delivered IN-APP to your existing official session
//     (Telegram restricts SMS-code login to official apps), OR
//   • a test-DC synthetic account (currently blocked server-side — see the runbook).
//
// Mode is auto-detected from the phone number: 99966XYYYY -> test DC; anything else
// -> production DC. Override with TG_TESTSERVERS=true|false.
//
// Run in a real terminal (interactive) — GramJS is Node-first, so prefer Node:
//   cd packages/marid-telegram
//   node scripts/tg-test-login.mjs
// Env overrides (all optional): TELEGRAM_PHONE, TG_TEST_CODE, TG_TEST_2FA, TG_TEST_NAME.
//
// The session string is written straight into the repo-root .env as
// TELEGRAM_TEST_SESSION (never printed — INV-002). A real-account session is a real
// login: guard it like a password.

import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions/index.js"
import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { readFileSync, writeFileSync } from "node:fs"

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

function upsertEnv(key, value) {
  const text = (() => {
    try {
      return readFileSync(ENV_PATH, "utf8")
    } catch {
      return ""
    }
  })()
  const lines = text.split("\n")
  const i = lines.findIndex((l) => l.trim().startsWith(`${key}=`))
  if (i === -1) lines.push(`${key}=${value}`)
  else lines[i] = `${key}=${value}`
  writeFileSync(ENV_PATH, lines.join("\n"))
}

loadRootEnv()

const apiId = Number(process.env.TELEGRAM_API_ID)
const apiHash = process.env.TELEGRAM_API_HASH
if (!apiId || !apiHash) {
  console.error("Missing TELEGRAM_API_ID / TELEGRAM_API_HASH in " + ENV_PATH.pathname + " (Step 1).")
  process.exit(1)
}

const rl = input.isTTY ? readline.createInterface({ input, output }) : null
const ask = async (q, fallback) => {
  if (!rl) return fallback
  const answer = (await rl.question(q)).trim()
  return answer || fallback
}

const phone = process.env.TELEGRAM_PHONE || (await ask("Phone (+country code for a real account): ", "9996621234"))
const digits = phone.replace(/\D/g, "")
const isTest = process.env.TG_TESTSERVERS ? process.env.TG_TESTSERVERS === "true" : digits.startsWith("99966")
console.log(`Logging in (${isTest ? "TEST DC" : "PRODUCTION DC"}) as ${phone}…`)
if (!isTest) console.log("→ the login code will arrive IN YOUR TELEGRAM APP (not SMS). Make sure this number is already signed into an official Telegram client.")

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 3,
  testServers: isTest,
})

const run = async () => {
  await client.start({
    phoneNumber: async () => phone,
    phoneCode: async () =>
      process.env.TG_TEST_CODE || (await ask(isTest ? "Login code [22222]: " : "Login code (check your Telegram app): ", isTest ? "22222" : "")),
    password: async () => process.env.TG_TEST_2FA || (await ask("2FA password [none]: ", "")),
    firstAndLastNames: async () => [process.env.TG_TEST_NAME || "MaridTest", ""],
    onError: (err) => {
      throw err
    },
  })
  upsertEnv("TELEGRAM_TEST_SESSION", client.session.save())
  console.log(`OK — TELEGRAM_TEST_SESSION written to ${ENV_PATH.pathname} (value hidden, INV-002).`)
  await client.disconnect()
  if (rl) rl.close()
  process.exit(0)
}

run().catch((err) => {
  console.error("login failed:", err?.errorMessage || err?.message || String(err))
  if (rl) rl.close()
  process.exit(1)
})
