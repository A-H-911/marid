---
status: Draft
version: v2.0
updated: 2026-07-10
owner: operator (STK-001)
---

# Telegram userbot E2E setup — real‑account credentials (for EXP‑007 / EXP‑009)

**Purpose.** The automated real‑client Telegram test tiers —
[EXP‑007](../research/hypothesis-register.md) (a GramJS **userbot** that drives the Marid bot) and
[EXP‑009](../research/hypothesis-register.md) (Telegram‑Web + Playwright), tiers 2–3 of
[ADR‑0013](../adrs/adr-0013-telegram-test-strategy.md) — need four operator‑provisioned credentials the
agent **cannot** create or commit ([INV‑002](../requirements/invariant-register.md): secrets are never
committed / never logged). This is the one‑time setup. **The deterministic fake‑server E2E stays the
blocking PR gate regardless** — these tiers run local‑pre‑PR + GitHub‑on‑demand, never gating (ADR‑0013).

> **Status (2026‑07‑10): all four credentials provisioned and verified.** The original *test‑DC* plan is a
> dead end (Telegram now restricts SMS‑code login to official apps — see [Appendix A](#appendix-a--why-not-the-test-dc)),
> so this uses a **real dedicated throwaway account**, whose login code arrives **in‑app** and bypasses that
> restriction. Verified: the userbot session authenticates (real account), and `@marid_test_bot` responds.

**Who does what:** Steps 1–3 are **operator** actions (mint credentials into `.env`); Step 4 is **agent**
build work (the EXP‑007/009 harness that *consumes* `.env`).

## The four credentials

| Env var | What it is | Where it comes from | Used by |
|---|---|---|---|
| `TELEGRAM_API_ID` | Numeric app id (account‑level) | my.telegram.org → API development tools | EXP‑007, EXP‑009 |
| `TELEGRAM_API_HASH` | App hash (account‑level, secret) | same panel | EXP‑007, EXP‑009 |
| `TELEGRAM_TEST_SESSION` | Userbot login (GramJS `StringSession`) for the **real throwaway account** | Step 2 login script | EXP‑007 |
| `TELEGRAM_TEST_BOT_TOKEN` | The bot the userbot talks to (normal @BotFather bot) | Step 3 | `marid-telegram` under test |

All four are **secrets**: local = the git‑ignored `.env`; CI = **GitHub Actions repository secrets**,
injected only for the on‑demand `workflow_dispatch` job. The userbot session is a **real login — guard it
like a password**.

### Where they live — `.env` at the repo root

One file: **`<repo-root>/.env`** (`opencode/.env`), git‑ignored ([`.gitignore`](../../.gitignore) line 5),
auto‑loaded by Bun. Create it from the committed template:

```bash
cp .env.example .env      # .env is ignored; .env.example is the committed template
```

## Step 1 — API id / hash (once)

1. Sign in at **https://my.telegram.org** → **API development tools** → **Create new application**. Create
   **exactly one** app (fields are cosmetic: title `Marid Test Client`, short name `maridtest`, URL blank,
   platform **Other**).
2. Copy **`api_id`** and **`api_hash`** (the hash is shown once) → `TELEGRAM_API_ID` / `TELEGRAM_API_HASH`.

> One app is enough — `api_id`/`api_hash` are account‑level; do not create a second.

## Step 2 — mint the userbot session (real dedicated account)

The userbot tier works with a **real account** because the login code for a new third‑party session is
delivered **in‑app** (to an existing official session), bypassing the SMS restriction that breaks synthetic
test numbers.

**Ban‑risk guardrails (important):** use a **dedicated throwaway number, never your personal account**; keep
CI **non‑gating / occasional** (ADR‑0013 already mandates this); the session is a real login (INV‑002).

1. Get a **dedicated throwaway phone number** (cheap second SIM / virtual number that can receive one code).
2. **Sign it into an official Telegram app once** (phone or Desktop) — this is what makes the login code
   arrive **in‑app** rather than via (restricted) SMS.
3. With `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` in `.env`, run the login script **in a terminal**
   ([`packages/marid-telegram/scripts/tg-test-login.mjs`](../../packages/marid-telegram/scripts/tg-test-login.mjs),
   GramJS `telegram` — a test‑only devDependency, DEP‑014):
   ```bash
   cd packages/marid-telegram
   node scripts/tg-test-login.mjs
   # Phone: +<countrycode><number>   → auto-selects PRODUCTION DC
   # Login code: read it FROM YOUR TELEGRAM APP (not SMS) and type it
   # 2FA: enter it if the account has one
   ```
   On success it writes `TELEGRAM_TEST_SESSION` into `.env` (value hidden — INV‑002).

> **Failure mode to avoid:** run this *after* the number is signed into an official app. Otherwise the code
> goes via SMS and hits the same wall.

## Step 3 — the bot

A normal **@BotFather** bot on the production DC (no test‑server dance needed on the real‑account path):

1. @BotFather → `/newbot` → pick a name + a unique `…bot` username → copy the token → `TELEGRAM_TEST_BOT_TOKEN`.
2. **`/setprivacy` → your bot → Disable** — so the bot receives all messages in a chat (not only
   commands/@mentions), which keeps the userbot↔bot conversation reliable in tests.

## Step 4 — the harness (agent‑built; no operator action)

Once `.env` holds the four values, the setup is done. The agent builds these (WBS‑6.6); they *read* the
credentials — the operator does not run them by hand.

- **EXP‑007 (GramJS userbot, TEST‑TG‑E2E):** connects with `TELEGRAM_TEST_SESSION`, messages the test bot:
  `/start` → assert reply → tap an inline button → send + receive a file. Local‑pre‑PR + GitHub‑on‑demand
  (`workflow_dispatch`/label, non‑gating).
- **EXP‑009 (Telegram‑Web + Playwright, TEST‑TG‑UI):** headless Playwright on `web.telegram.org`, logs in
  with the same account, asserts **rendered** MarkdownV2 + a media message. Same cadence; bounded retry.

## Guardrails

- **INV‑002:** none of the four secrets is committed or logged — `.env` (git‑ignored) + GitHub Actions
  secrets only. The userbot session is a full login; treat it like the token.
- **Non‑gating:** EXP‑007/009 never block a PR — the fake‑server E2E is the deterministic gate (ADR‑0013).
- **Ban risk:** dedicated throwaway account, gentle/occasional automated traffic.

---

## Appendix A — Why not the test DC?

The original plan used Telegram's **test datacenter** (synthetic `99966XYYYY` numbers with a fixed
`dc_id`‑repeated code — no SMS, no real account, zero ban risk). **This is currently non‑functional, and it
is not a library issue** — verified 2026‑07‑10 by spiking two independent MTProto libraries against real api
credentials:

- **GramJS** (stale ~18mo): all three DCs, low‑level `sendCode`+`signIn`, explicit pin to
  `149.154.167.40:80/443`, **5‑ and 6‑digit** codes → `PHONE_CODE_INVALID` on every path; `sendCode` returns
  `SentCodeTypeSms`.
- **mtcute** (modern, `testMode:true`): **identical failure** — *"confirmation code sent via sms"* → *"code
  was invalid"*.

Because a *current* library reproduces it exactly and the code length isn't it, the cause is **server‑side**:
the synthetic numbers route through the **SMS path, which Telegram now restricts to official apps**
([bugs.telegram.org](https://bugs.telegram.org/c/4239/7); Telethon / @mtproto‑core docs confirm the code rule
but the delivery is blocked for third‑party clients). A third library (Telethon) is the same MTProto flow →
the same wall. The **real‑account path above is the resolution** (in‑app code delivery bypasses the SMS
restriction). This tier is non‑blocking by design — the fake‑server E2E is the gate throughout.
