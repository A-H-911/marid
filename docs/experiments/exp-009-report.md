---
experiment: EXP-009
hypothesis: HYP-009
status: PASS (on the resolved production-web path; test-DC/?test=1 premise superseded, as EXP-007)
version: v1.0
updated: 2026-07-12
owner: operator (STK-001)
---

# EXP-009 — Telegram Web + Playwright rendered-UX spike

**Verdict: PASS. HYP-009 confirmed.** A headless Playwright browser, logged into a real Telegram Web
account, drives the bot end-to-end and asserts on the **rendered DOM** that a bot reply displays as real
markup — bold → `<strong>`, inline code → `<code>`, fenced block → `<pre>` — and that a bot-sent photo
renders as an `<img>`. Stable across 4 consecutive runs. This closes [AC-021](../validation/acceptance-criteria.md)
and de-risks [ADR-0013](../adrs/adr-0013-telegram-test-strategy.md) **tier 3** (TEST-TG-UI).

Validates [HYP-009](../research/hypothesis-register.md): *Telegram Web + Playwright headlessly validates
rendered Markdown/media on a real client, stable enough for the local + on-demand tier.*
**Non-gating by design** — the deterministic fake-server E2E (`telegram.test.ts`) stays the blocking PR gate;
this tier runs local-pre-PR.

## Result in one line

marid-telegram's **real** MarkdownV2 formatter (`telegramify-markdown`) → **real** Bot API → **production**
`web.telegram.org` → **real rendered DOM**, asserted by Playwright: `<strong>` + `<code>` + `<pre>` + `<img>`
all present, and no literal `**…**` survived. This is the exact regression the [ADR-0008](../adrs/adr-0008-telegram-gateway-fork.md) defect-1 cluster
was (raw `**bold**` reaching the chat literally) — now guarded live.

## What ran

Two-runtime harness (see **Bun vs Node** below), all local, non-gating:

- **Bun orchestrator** — `packages/opencode/scripts/tg-web-e2e.ts`: boots a real `marid serve` + a channel
  token bound to the `build` agent + `runGateway`, driven by an **inline fake LLM** (an OpenAI-compatible
  `/v1/chat/completions` SSE endpoint) that emits fixed markdown carrying a per-run **nonce** (bold +
  inline code + fenced block). The gateway's outbound path is the **real** `createBotApi` pointed at
  **production** Telegram, so the reply is formatted by the real `toMarkdownV2` and actually sent. It also
  sends one photo via `bot.sendPhoto` (public URL) for the media half, then spawns:
- **Node driver** — `packages/opencode/scripts/tg-web-driver.mjs`: reuses the persisted logged-in profile
  (`.pw-telegram/`), sends a trigger into the bot chat **as the operator's own web account**, waits for the
  bot reply bubble carrying the nonce, reads its `innerHTML`, and asserts the render checks. Matching is by
  **text nonce**, not brittle class names.
- **One-time login** — `packages/opencode/scripts/tg-web-login.mjs` (headed, QR scan) persists the session.
  The operator's numeric user id (for the gateway allow-list) is captured by a getUpdates probe.

**Checks (all GREEN, 4/4 runs):** `bold` (`<strong>`), `code` (`<code>`), `pre` (`<pre>`),
`noLiteralStars` (literal `**nonce**` must NOT survive), `media` (bot photo renders as `<img>`).

## Resolved premises & deviations (operator-confirmed, INV-005)

1. **Production Telegram, not the test DC / `?test=1`.** AC-021/HYP-009 literally name the test DC. As with
   [EXP-007](exp-007-report.md) (which superseded the test-DC premise for the userbot tier — test-DC login
   is server-side blocked), the entire live PH-6 harness (AC-019/020) and the operator's web login are on
   **production**. Operator-confirmed (2026-07-12) to run AC-021 on production to match that precedent. This
   is an **evidence note, not a new ADR** — ADR-0013's tier 3 intent (real-app rendered-UX check) is met;
   only the DC differs, and EXP-007 already established the substitution.

2. **Bun vs Node (harness shape).** Playwright's browser launch **hangs under Bun** (its driver expects
   Node); the `@marid/*` packages need Bun. So the browser half is a **Node** child process, the marid/
   gateway/fake-LLM half is **Bun**, coordinated over a spawned-process JSON handshake. Documented in the
   script headers.

3. **Persistent context, not `storageState`.** Telegram Web /k/ stores its session in **IndexedDB**, which a
   Playwright `storageState` snapshot does NOT capture — a `storageState` restore lands logged-out. We use
   `launchPersistentContext(userDataDir=.pw-telegram/)` (git-ignored) to persist the whole profile. The
   logged-in signal is `localStorage.number_of_accounts ≥ 1` **and** absence of the QR page (the MTProto
   `dc<N>_auth_key` is written on *connect*, before login, so it is NOT a logged-in signal — an early false
   positive that cost one debug cycle).

4. **web.telegram.org /k/ pinned.** /k/ (webk) and /a/ (weba) differ in both storage and selectors; the
   harness targets /k/ only. The composer is a contenteditable `.input-message-input`; webk keeps several in
   the DOM, so we focus the **visible** one (`offsetParent ≠ null`) via JS and send real key events —
   `.click()` hits Playwright's pointer-interception check. This is the selector-brittleness EXP-009's FAIL
   branch warned about; it is contained (match by text, focus-by-visibility), and stability held 4/4.

## Media coverage & the onFile ceiling (honest scope)

The meaningful **outbound-file** path (`gateway.ts` `onFile` → `sendPhoto`/`sendDocument`) cannot be
exercised in a live web-render run for two **documented** reasons: (a) the served fake-LLM turn resolves
zero tools, so a live turn cannot emit an assistant FILE part (the zero-tools ceiling noted in
`telegram.test.ts`), and (b) `onFile` sends an **instance-local** file URL Telegram's servers cannot fetch
(future-work note at `gateway.ts:111`). The AC-021 media half therefore asserts render via `bot.sendPhoto`
with a **public** URL — this exercises marid's real Bot API media send + confirms the client renders an
image bubble. The `mime → sendPhoto/sendDocument` decision and the `onFile` wiring stay covered by the
faked-SDK `gateway-integration` tier + unit tests. Net: AC-021 media = **rendered live via the Bot API**;
the `onFile` public-relay path remains future work (unchanged by this experiment).

## Testing model & CI (ADR-0013)

TEST-TG-UI runs **local pre-PR** via `bun run scripts/tg-web-e2e.ts` (needs the one-time login + `.env`
creds). Like the sibling live tiers (TEST-TG-E2E userbot, live-model) it is **not wired into `ci.yml`** —
the deterministic fake-server `telegram.test.ts` remains the sole blocking Telegram PR gate. ADR-0013's
"GitHub on-demand (non-gating)" wiring is **deferred** for the same reason it was never wired for the
userbot tier: an ephemeral GitHub runner has neither the persisted logged-in IndexedDB profile nor a safe
way to inject the web session as a secret. Recorded as deferred, not built.

## Native mobile (TEST-TG-MOBILE / EXP-010) — deferred

EXP-010 (native Telegram Android via emulator/mobile-mcp) is **not** part of AC-021 or the MS-007 exit
(EXP-007/008/009), and ADR-0013 keeps it "manual/occasional, never a gate." No Android tooling is present on
the dev machine (no adb/emulator/SDK/mobile-mcp). Operator-confirmed (2026-07-12) to **defer** EXP-010 as a
manual check for later. AC-021 closes on the Web-Playwright evidence alone.

## Run

```
cd packages/opencode
node scripts/tg-web-login.mjs      # once: headed QR scan, persists .pw-telegram/ + writes .env
bun  run scripts/tg-web-e2e.ts     # the tier: markdown + media render assertions, ~30–60s
```

INV-002: no bot token / session string / LLM key is ever printed by any of the three scripts.
