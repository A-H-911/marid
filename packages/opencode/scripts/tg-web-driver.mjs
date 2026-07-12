// WBS-6.6 · AC-021 (TEST-TG-UI) — the Playwright half of the Telegram-Web render tier.
//
// RUNS UNDER NODE (Playwright's browser launch hangs under Bun). This is a dumb browser-I/O
// RPC: the Bun orchestrator (tg-web-e2e.ts) owns the marid serve + gateway + fake LLM and
// spawns this to (1) send a trigger message into the bot chat AS THE OPERATOR'S OWN web
// account, and (2) read back the RENDERED DOM of the bot's reply — asserting the reply is
// real HTML markup (<strong>, <code>/<pre>), not literal `**text**`. It prints ONE line of
// JSON to stdout: { ok, checks, html } (or { ok:false, error }).
//
// Inputs via env (set by the orchestrator):
//   BOT_USERNAME   — the bot to open (no leading @)
//   TRIGGER_TEXT   — what we type into the composer (any text; the fake LLM ignores it)
//   EXPECT_NONCE   — unique token the reply MUST contain, so we match THIS run's reply
//   USER_DATA_DIR  — the persisted .pw-telegram profile (must already be logged in)
//   HEADFUL        — "1" to watch it run (debug); default headless
//
// Reuses the persistent profile from tg-web-login.mjs; never logs in here.

import { chromium } from "playwright"

const BOT_USERNAME = process.env.BOT_USERNAME
const TRIGGER_TEXT = process.env.TRIGGER_TEXT ?? "render check"
const EXPECT_NONCE = process.env.EXPECT_NONCE
const MEDIA_NONCE = process.env.MEDIA_NONCE // optional: caption of a bot photo to confirm renders
const USER_DATA_DIR = process.env.USER_DATA_DIR
const HEADFUL = process.env.HEADFUL === "1"

const out = (obj) => process.stdout.write(JSON.stringify(obj) + "\n")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  if (!BOT_USERNAME || !EXPECT_NONCE || !USER_DATA_DIR) {
    out({ ok: false, error: "missing BOT_USERNAME / EXPECT_NONCE / USER_DATA_DIR env" })
    process.exit(2)
  }

  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, { headless: !HEADFUL })
  const page = ctx.pages()[0] ?? (await ctx.newPage())

  // Open the bot chat directly. webk deep-links a peer via the hash (#@username).
  await page.goto(`https://web.telegram.org/k/#@${BOT_USERNAME}`)

  // Confirm we are logged in (persisted session). No user_auth → the profile is stale.
  const authed = await page
    .waitForFunction(() => !!window.localStorage.getItem("user_auth"), { timeout: 30_000 })
    .then(() => true)
    .catch(() => false)
  if (!authed) {
    out({ ok: false, error: "not logged in (no localStorage.user_auth) — re-run tg-web-login.mjs" })
    await ctx.close()
    process.exit(3)
  }

  // The message composer is a contenteditable div (`.input-message-input`). webk keeps SEVERAL
  // in the DOM (one per chat view); clicking `.last()` hits Playwright's pointer-interception
  // check because the *visible* one overlays it. Focus the visible composer via JS (offsetParent
  // ≠ null), then send real key events — the reliable pattern for webk's contenteditable.
  await page.waitForSelector(".input-message-input", { timeout: 30_000 })
  await sleep(1500)
  const focused = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".input-message-input")]
    const el = els.find((e) => e.offsetParent !== null) || els[els.length - 1]
    if (!el) return false
    el.focus()
    return document.activeElement === el
  })
  if (!focused) {
    out({ ok: false, error: "could not focus the message composer (.input-message-input)" })
    await ctx.close()
    process.exit(5)
  }
  await page.keyboard.type(TRIGGER_TEXT, { delay: 15 })
  await sleep(300)
  await page.keyboard.press("Enter")

  // Wait for the bot reply bubble that carries our nonce, then read its rendered HTML.
  // We match by TEXT (the nonce) rather than brittle class names, then inspect the markup.
  const deadline = Date.now() + 90_000
  let found = null
  while (Date.now() < deadline) {
    found = await page.evaluate((nonce) => {
      // Incoming (bot) message bodies. webk uses `.message` for the text node inside a bubble;
      // fall back to any element containing the nonce if the class drifts.
      const nodes = Array.from(document.querySelectorAll(".message, .text-content, .bubble"))
      for (const n of nodes) {
        if ((n.textContent ?? "").includes(nonce)) {
          return { html: n.innerHTML, text: n.textContent ?? "" }
        }
      }
      return null
    }, EXPECT_NONCE)
    if (found) break
    await sleep(1000)
  }

  if (!found) {
    out({ ok: false, error: `reply with nonce ${EXPECT_NONCE} did not render within 90s` })
    await ctx.close()
    process.exit(4)
  }

  // The core AC-021 assertion: the formatter produced real markup, not literal markdown.
  const html = found.html
  const checks = {
    bold: /<(strong|b)\b/i.test(html), // **bold** → <strong>
    code: /<code\b/i.test(html), // `inline` → <code>
    pre: /<pre\b/i.test(html), // fenced block → <pre>
    noLiteralStars: !found.text.includes(`**${EXPECT_NONCE}**`), // raw `**…**` must NOT survive
  }

  // Media half of AC-021: a bot-sent photo (caption = MEDIA_NONCE) must render as an actual
  // <img>, not just caption text. Match by an <img> whose nearby text carries the caption
  // nonce (robust to class-name drift). Only checked when the orchestrator sent a photo.
  if (MEDIA_NONCE) {
    const mdeadline = Date.now() + 30_000
    let media = false
    while (Date.now() < mdeadline) {
      media = await page.evaluate((n) => {
        for (const img of Array.from(document.querySelectorAll("img"))) {
          let el = img
          for (let i = 0; i < 6 && el; i++) {
            if ((el.textContent ?? "").includes(n)) return true
            el = el.parentElement
          }
        }
        return false
      }, MEDIA_NONCE)
      if (media) break
      await sleep(1000)
    }
    checks.media = media
  }

  const core = checks.bold && checks.code && checks.noLiteralStars
  const mediaOk = MEDIA_NONCE ? checks.media : true
  out({ ok: core && mediaOk, checks, html })

  await ctx.close()
  process.exit(0)
}

main().catch((e) => {
  out({ ok: false, error: e instanceof Error ? e.message : String(e) })
  process.exit(1)
})
