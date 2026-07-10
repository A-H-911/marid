---
status: Draft
version: v1.2
updated: 2026-07-10
owner: operator (STK-001)
---

# Telegram test‑DC setup — operator runbook (for EXP‑007 / EXP‑009)

**Purpose.** The two automated real‑client Telegram test tiers —
[EXP‑007](../research/hypothesis-register.md) (GramJS userbot) and
[EXP‑009](../research/hypothesis-register.md) (Telegram‑Web + Playwright), tiers 2–3 of
[ADR‑0013](../adrs/adr-0013-telegram-test-strategy.md) — drive a **real Telegram client against
Telegram's test datacenter (test DC)**, so they need **four** operator‑provisioned credentials that the
agent **cannot** create or commit ([INV‑002](../requirements/invariant-register.md): secrets never
committed / never logged). This runbook is the one‑time setup. The **deterministic fake‑server E2E stays
the blocking PR gate regardless** — these tiers run local‑pre‑PR + GitHub‑on‑demand, never gating.

**Who does what:** Steps 1–3 are **operator** actions (mint credentials into `.env`); Step 4 is **agent**
build work (the EXP‑007/009 harness that *consumes* `.env`) — the operator does not run Step 4, only fills
`.env` first.

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

### Where to put them — `.env` at the repo root

There is one env file: **`<repo-root>/.env`** (i.e. `opencode/.env`), already git‑ignored
([`.gitignore`](../../.gitignore) line 5) and auto‑loaded by Bun. It does not exist until you create it —
copy the committed template and fill it in:

```bash
cp .env.example .env      # from the repo root; .env is ignored, .env.example is the committed template
```

`.env.example` lists every variable with comments. Fill the four `TELEGRAM_*` values below as you mint them.

## Step 1 — API id / hash (once)

1. Sign in at **https://my.telegram.org** with your phone (this uses your real account only to *mint app
   credentials*; the tests themselves never touch it).
2. Open **API development tools** → **Create new application**. Create **exactly one** app — the fields are
   cosmetic:

   | Field | Value |
   |---|---|
   | App title | `Marid Test Client` (any readable name) |
   | Short name | `maridtest` (5–32 alphanumeric) |
   | URL | *leave blank* (optional, unused for an MTProto client) |
   | Platform | **Other** (or Desktop) — does not restrict usage |
   | Description | `Automated E2E test client (test DC) for Marid channels` (optional) |

3. Copy **`api_id`** (numeric) and **`api_hash`** immediately — the hash is shown once. → `TELEGRAM_API_ID` /
   `TELEGRAM_API_HASH`.
4. The same panel lists the **test‑DC IP addresses / ports** (TCP transport) and the HTTPS/WebSocket URIs —
   note them; GramJS's `testServers` option uses these. (Test DC 2 is the usual default.)

> **One app is enough.** `api_id`/`api_hash` are **account‑level and identical for production and test DCs** —
> both EXP‑007 and EXP‑009 reuse this single pair; only the *connection* targets the test DC. Do not create a
> second app.

## Step 2 — the synthetic test login (GramJS userbot)

Telegram reserves phone numbers for each test DC (authoritative:
**https://core.telegram.org/api/auth#test-accounts**):

- **Number:** `99966XYYYY` — where **X = the test‑DC number (1–3)** and **YYYY = any 4 digits**.
  Example on DC 2: `+9996 6 2 1234`.
- **Login code:** always **the DC number repeated five times** — e.g. DC 2 → **`22222`** (no SMS).

Log in **once** to mint the `StringSession`. A ready script is committed at
[`packages/marid-telegram/scripts/tg-test-login.mjs`](../../packages/marid-telegram/scripts/tg-test-login.mjs)
(GramJS `telegram`, a test‑only devDependency — DEP‑014). With `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` already
in `.env`, run:

```bash
cd packages/marid-telegram
bun scripts/tg-test-login.mjs
# If GramJS misbehaves under Bun, use Node (loads .env explicitly):
#   node --env-file=../../.env scripts/tg-test-login.mjs
```

Press **Enter** at each prompt to accept the test defaults:

| Prompt | Default | Meaning |
|---|---|---|
| Test phone | `9996621234` | synthetic DC‑2 number (`99966` + DC id `2` + `1234`) |
| Login code | `22222` | fixed code = DC id ×5, no SMS |
| 2FA password | *(blank)* | a fresh synthetic account has none |
| First name | `MaridTest` | only asked on first login (= account signup) |

It prints the session string between `==== TELEGRAM_TEST_SESSION ====` markers — **paste that line into
`.env`** as `TELEGRAM_TEST_SESSION=…`. Later runs are then non‑interactive.

> **Known caveat (EXP‑007):** test‑DC login has documented `PHONE_CODE_INVALID` intermittency
> (GramJS #70/#169/#734), and GramJS's repo is ~18mo stale — **just re‑run** if it hits. If login proves
> genuinely intractable, the fake‑server E2E remains the sole deterministic tier and the userbot is
> documented best‑effort — that is the EXP‑007 FAIL branch, not a blocker.

## Step 3 — a bot in the test environment

The Bot **test environment is completely separate** from production (per
**https://core.telegram.org/bots/features#dedicated-test-environment**): *"you will need to create a new
user account and a new bot with @BotFather"* **while logged into the test server**. A production bot token
does **not** carry over.

1. **Open the test server** in a Telegram app and create a throwaway account there:
   - **Telegram Desktop:** ☰ **Settings** → **Shift + Alt + Right‑click** on **"Add Account"** → select
     **"Test Server"**.
   - **iOS:** tap the **Settings** icon **10×** → **Accounts** → **Login to another account** → **Test**.
   - **macOS:** click the **Settings** icon **10×** to open the Debug Menu → **⌘ + click "Add Account"**.
   - Sign that test account in with a synthetic number + fixed code (same rule as Step 2 — e.g.
     `+9996621234` / `22222` for DC 2).
2. In that test‑server session open **@BotFather**, `/newbot`, copy the token → `TELEGRAM_TEST_BOT_TOKEN`.
3. Call the bot in test mode via the **`/test` path segment** (verified format):
   `https://api.telegram.org/bot<token>/test/METHOD_NAME`. `marid-telegram` needs a `baseUrl`/`/test`
   switch to target it (WBS‑6.2).

## Step 4 — how each experiment consumes them (agent‑built; no operator action)

Once Steps 1–3 have filled `.env`, the credential setup is **done**. The harnesses below are built by the
agent (WBS‑6.6) and *read* those four values — the operator does not run them by hand here.

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
