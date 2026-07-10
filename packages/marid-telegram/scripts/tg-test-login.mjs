// EXP-007 Step 2 — mint TELEGRAM_TEST_SESSION (one-time).
//
// Logs a GramJS userbot into Telegram's TEST DC using a synthetic phone number
// and the fixed test code, then prints a StringSession you paste into .env as
// TELEGRAM_TEST_SESSION. No SMS, no real account, zero ban risk.
//
// Run from packages/marid-telegram (where `telegram` is installed):
//   bun scripts/tg-test-login.mjs
// If GramJS misbehaves under Bun, use Node (loads .env explicitly):
//   node --env-file=../../.env scripts/tg-test-login.mjs
//
// Defaults are for TEST DC 2: number +9996621234, code 22222. Press Enter to
// accept them. (Synthetic number = 99966 X YYYY where X=DC id 1-3; code = DC id x5.)

import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions/index.js"
import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"

const apiId = Number(process.env.TELEGRAM_API_ID)
const apiHash = process.env.TELEGRAM_API_HASH
if (!apiId || !apiHash) {
  console.error("Missing TELEGRAM_API_ID / TELEGRAM_API_HASH. Fill them in .env first (Step 1).")
  process.exit(1)
}

const rl = readline.createInterface({ input, output })
const ask = async (q, fallback) => (await rl.question(q)).trim() || fallback

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 3,
  testServers: true, // <- connect to the TEST DC
})

await client.start({
  phoneNumber: async () => ask("Test phone [default 9996621234]: ", "9996621234"),
  phoneCode: async () => ask("Login code [default 22222]: ", "22222"),
  // A fresh synthetic account has no 2FA; leave blank.
  password: async () => ask("2FA password [default none]: ", ""),
  // First login on a new synthetic account = signup; any name is fine.
  firstAndLastNames: async () => [await ask("First name [default MaridTest]: ", "MaridTest"), ""],
  onError: (err) => console.error("login error:", err?.errorMessage || err),
})

const session = client.session.save()
console.log("\n================ TELEGRAM_TEST_SESSION ================")
console.log(session)
console.log("======================================================")
console.log("Paste the line above into .env as TELEGRAM_TEST_SESSION (treat it like a password).")

await client.disconnect()
await rl.close()
process.exit(0)
