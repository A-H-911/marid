---
status: Draft
version: v1.0
updated: 2026-07-10
owner: operator (STK-001)
---

# Telegram test‑DC setup — operator runbook (for EXP‑007 / EXP‑009)

**Purpose.** The two automated real‑client Telegram test tiers —
[EXP‑007](../research/hypothesis-register.md) (GramJS userbot) and
[EXP‑009](../research/hypothesis-register.md) (Telegram‑Web + Playwright), tiers 2–3 of
[ADR‑0013](../adrs/adr-0013-telegram-test-strategy.md) — drive a **real Telegram client against
Telegram's test datacenter (test DC)**, so they need three operator‑provisioned credentials that the
agent **cannot** create or commit ([INV‑002](../requirements/invariant-register.md): secrets never
committed / never logged). This runbook is the one‑time setup. The **deterministic fake‑server E2E stays
the blocking PR gate regardless** — these tiers run local‑pre‑PR + GitHub‑on‑demand, never gating.

> Why a test DC (not production): the test environment uses **synthetic phone numbers with a fixed login
> code — no SMS, no real account, zero ban risk** — which is what makes an *automated* real‑protocol login
> possible at all. It is a completely separate instance (separate users, chats, bots) from production.

## What you provision (three secrets)

| Env var | What it is | Where it comes from | Used by |
|---|---|---|---|
| `TELEGRAM_API_ID` | Numeric app id (account‑level) | my.telegram.org → **API development tools** | EXP‑007 (GramJS), EXP‑009 |
| `TELEGRAM_API_HASH` | App hash (account‑level, secret) | same panel | EXP‑007, EXP‑009 |
| `TELEGRAM_TEST_BOT_TOKEN` | The bot the tests talk to, created **in the test env** | @BotFather **on the test DC** | `marid-telegram` under test |
| `TELEGRAM_TEST_SESSION` | Serialized userbot auth (GramJS `StringSession`) | produced once by the login step below | EXP‑007 (avoids re‑login each run) |

All four are **secrets**: local = a git‑ignored `.env` (never staged); CI = **GitHub Actions repository
secrets**, injected as env for the on‑demand `workflow_dispatch` job only. Never echo them in logs — the
gateway already `redact()`s the bot token ([media.ts](../../packages/marid-telegram/src/redact.ts));
the userbot session string is equally sensitive (it is a full login).

## Step 1 — API id / hash (once)

1. Sign in at **https://my.telegram.org** with your phone (this uses your real account only to *mint app
   credentials*; the tests themselves never touch it).
2. Open **API development tools**, create an app (any name/short‑name), copy **`api_id`** and **`api_hash`**.
3. The same panel lists the **test‑DC IP addresses / ports** (TCP transport) and the HTTPS/WebSocket URIs —
   note them; GramJS's `testServers` option uses these. (Test DC 2 is the usual default.)

`api_id`/`api_hash` are account‑level and identical for production and test DCs — only the *connection*
targets the test DC.

## Step 2 — the synthetic test login (GramJS userbot)

Telegram reserves phone numbers for each test DC (authoritative:
**https://core.telegram.org/api/auth#test-accounts**):

- **Number:** `99966XYYYY` — where **X = the test‑DC number (1–3)** and **YYYY = any 4 digits**.
  Example on DC 2: `+9996 6 2 1234`.
- **Login code:** always **the DC number repeated five times** — e.g. DC 2 → **`22222`** (no SMS).

Log in **once** with a GramJS `StringSession` connected to the test DC, print the session string, and store
it as `TELEGRAM_TEST_SESSION` so subsequent runs are non‑interactive:

```ts
// one-time: scripts/tg-test-login.ts  (run on Node if GramJS is Bun-incompatible — EXP-007 caveat)
import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions"
const client = new TelegramClient(new StringSession(""), Number(API_ID), API_HASH, { testServers: true })
await client.start({
  phoneNumber: async () => "9996621234",   // DC 2 synthetic number
  phoneCode:   async () => "22222",          // fixed code for DC 2
  onError: console.error,
})
console.log(client.session.save())           // -> paste into TELEGRAM_TEST_SESSION (secret)
```

> **Known caveat (EXP‑007):** test‑DC login has documented `PHONE_CODE_INVALID` intermittency
> (GramJS #70/#169/#734), and GramJS's repo is ~18mo stale. If login proves intractable, the fake‑server
> E2E remains the sole deterministic tier and the userbot is documented best‑effort — that is the EXP‑007
> FAIL branch, not a blocker.

## Step 3 — a bot in the test environment

BotFather lives on production, but the bot the tests target must exist **in the test env**:

1. Connect a client to the **test DC** (Telegram Desktop supports a test‑environment toggle; or a throwaway
   test‑DC session), open **@BotFather**, `/newbot`, copy the token → `TELEGRAM_TEST_BOT_TOKEN`.
2. Point `marid-telegram` at the **Bot‑API test mode** by using the `/test` path segment:
   `https://api.telegram.org/bot<token>/test/METHOD` (the gateway needs a `baseUrl`/`/test` switch — WBS‑6.2).

## Step 4 — how each experiment consumes them

- **EXP‑007 (GramJS userbot, TEST‑TG‑E2E):** connects with `testServers:true` + `TELEGRAM_TEST_SESSION`,
  messages the test bot: `/start` → assert reply → tap an inline button → send + receive a file. Runs
  locally every pre‑PR and on GitHub via `workflow_dispatch`/label (non‑gating).
- **EXP‑009 (Telegram‑Web + Playwright, TEST‑TG‑UI):** headless Playwright on **`web.telegram.org/?test=1`**,
  logs in with the same synthetic number + `22222`, sends a prompt, asserts the **rendered** MarkdownV2 +
  a media message. Same local‑pre‑PR + on‑demand cadence; bounded retry for GUI flakiness.

## Guardrails

- **INV‑002:** none of the four secrets is ever committed or logged. Provide via `.env` (git‑ignored) and
  GitHub Actions secrets only. The userbot **session string is a full login** — treat it like the token.
- **Not a gate:** EXP‑007/009 never block a PR; the fake‑server E2E is the deterministic gate. This keeps
  live‑Telegram flakiness out of the merge path (ADR‑0013).
- **Native mobile (EXP‑010)** is a separate, manual/occasional tier — different setup (Android emulator +
  persisted test login), not covered here.
