---
experiment: EXP-007
hypothesis: HYP-007
status: PASS (on the resolved real-account path; test-DC premise superseded)
version: v1.0
updated: 2026-07-10
owner: operator (STK-001)
---

# EXP-007 — GramJS userbot real-client E2E spike

**Verdict: PASS. HYP-007 confirmed on the resolved substrate — a GramJS userbot drives a real Telegram
bot over real MTProto end-to-end (reply + inline keyboard, inline-button callback, file both ways),
deterministically enough for the automated local + on-demand CI tier. The original *test-DC* premise is
superseded (server-side blocked — see below); the experiment ran on a real throwaway account + the
production DC, which is the resolution recorded in the runbook.**

Validates [HYP-007](../research/hypothesis-register.md): *a userbot drives the bot end-to-end
(text/files/slash/inline-keyboard) deterministically enough for automated local + on-demand CI runs.*
De-risks [ADR-0013](../adrs/adr-0013-telegram-test-strategy.md) **tier 2** (TEST-TG-E2E); evidence for
AC-020. **Non-gating by design** — the deterministic fake-server E2E stays the blocking PR gate; this
tier runs local-pre-PR + GitHub-on-demand (`workflow_dispatch`/label), never blocking a merge.

## Result in one line

The userbot **harness mechanism works over real MTProto**. A GramJS userbot logged in with the real
throwaway account (`TELEGRAM_TEST_SESSION`) drove a bot (`TELEGRAM_TEST_BOT_TOKEN`) through the full
round-trip the real Telegram tier needs: send `/start` → **receive** the reply + inline keyboard →
**tap** the inline button (callback answered + acknowledged) → **upload** a document → **receive** the
echoed document back. One live run, first-try green, no secrets logged.

## Setup actually executed (and two deviations from the plan)

Harness: [`packages/marid-telegram/scripts/exp-007-userbot-e2e.mjs`](../../packages/marid-telegram/scripts/exp-007-userbot-e2e.mjs)
— a single Node `.mjs` script (GramJS-on-Bun is unverified; Node is the proven path from the login
script, and a live script stays out of the deterministic `bun test` gate). It runs **both sides in one
process**: the userbot (GramJS, MTProto) and a **minimal Bot-API stub** (raw `fetch`, ~5 endpoints).

Two deliberate deviations from the EXP-007 plan text, both forced and both honest:

1. **Test DC → real account + production DC.** The plan assumed a test-DC bot + synthetic `+99966XYYYY`
   login. That path is **server-side non-functional** — verified 2026-07-10 by spiking *two* independent
   MTProto libraries (GramJS and mtcute): both fail `PHONE_CODE_INVALID` because Telegram now restricts
   SMS-code login to official apps, so no third-party client can complete a synthetic-number login. The
   resolution (a real dedicated throwaway account whose login code arrives **in-app**) is documented in
   [telegram-userbot-e2e-setup.md](../execution/telegram-userbot-e2e-setup.md) (Appendix A). HYP-007's
   real claim — *automatable userbot round-trip* — is unaffected by the substrate swap.
2. **Bot side is a STUB, not the production gateway.** EXP-007 de-risks the **userbot harness**, which is
   bot-agnostic (MTProto behaves identically regardless of what answers). The production bot behavior
   (EXP-005's fixes wired into `@marid/telegram` against a live `marid serve`) is **WBS-6.2/6.6 and is not
   built yet**, so a "drive the real gateway" reading literally cannot run at this stage. The stub answers
   `/start` with a reply + inline keyboard, `answerCallbackQuery` + a confirmation on tap, and echoes an
   uploaded document back by `file_id` (a pure-JSON round-trip — no multipart needed to prove send+receive).

## Evidence (all PASS)

| # | Property (PASS bar) | Assertion | Result |
|---|---|---|---|
| 1 | **Real-protocol login** | The userbot connects with `TELEGRAM_TEST_SESSION` and is authorized on the production DC | ✅ `checkAuthorization()` true; connected `149.154.167.91:80` |
| 2 | **Slash + receive** | `/start` handled by the bot; userbot **receives** the reply | ✅ "Marid test bot online" received |
| 3 | **Inline keyboard renders** | The received message carries `reply_markup` | ✅ inline keyboard present |
| 4 | **Inline-button callback** | `message.click()` taps the button; bot answers the callback | ✅ callback answered: `"Tapped ✓"` |
| 5 | **Post-tap acknowledgement** | The bot's follow-up message reaches the userbot | ✅ "Button acknowledged." received |
| 6 | **File send** | The userbot uploads a document; the bot receives it | ✅ "Got your file: …" ack received |
| 7 | **File receive** | The bot echoes a document; the userbot **receives** it | ✅ 51-byte document received back |

```
$ cd packages/marid-telegram && node scripts/exp-007-userbot-e2e.mjs
 ▶ bot stub live: @marid_test_bot (id 8671610207)
 ▶ userbot authorized                                  # account identity NOT printed (INV-002)
 1/3 · /start → reply text + inline keyboard           ✅
 2/3 · tap inline button → callback "Tapped ✓" + ack   ✅
 3/3 · upload document → ack + 51-byte echo received   ✅
 EXP-007 PASS — reply+keyboard ✓  callback ✓  file both ways ✓
```

## INV-002

The session string and bot token are read from the git-ignored `.env` and are **never printed** (the
script logs "userbot authorized", not the account). The transient upload payload is written to the OS
temp dir (not the repo) and deleted on exit. No token-bearing `getFile` URL is logged (the file-receive
assertion checks the returned *document message*, not a download).

## What this settles

- **The automated real-client tier is feasible.** The single biggest test-strategy risk — "no test drives
  a real Telegram client," the exact gap that let the ADR-0008 defect cluster through — now has a working,
  repeatable harness: real login, receive, inline-button tap, and a file both ways, in ~3 s over the wire.
- **`PHONE_CODE_INVALID` / stale-GramJS (RISK-016) is retired for this tier.** The blocker was the test-DC
  *login*, not the userbot mechanism; on the real-account path GramJS 2.26 drives the full round-trip
  cleanly on Node.
- **Bun-compat question answered pragmatically:** run the userbot tier on **Node** (as this script does) —
  no need to resolve GramJS-on-Bun to ship the tier.

## Residual / carried into WBS-6.6

- **Wire against the real gateway.** This proves the harness; WBS-6.6 points it at a live `marid serve` +
  the EXP-005-fixed `@marid/telegram` (WBS-6.2) and asserts *Marid's* rendered Markdown, real slash
  whitelist routing, and workspace file landing — the product-E2E the stub deliberately does not cover.
- **CI wiring (non-gating).** Local-pre-PR always + GitHub `workflow_dispatch`/label on-demand, with the
  session + bot token as GitHub Actions secrets; a bounded retry + a short per-step timeout (already in the
  harness) keep live-Telegram flakiness from ever blocking a merge (ADR-0013).
- **Ban-risk discipline** (dedicated throwaway account, occasional automated traffic) stays in force.

**FAIL path not taken:** the userbot round-trip did not prove intractable, so the fallback ("keep the
fake-server E2E as the sole deterministic tier; userbot best-effort") does not trigger. HYP-007 stands on
the resolved real-account path; the test-DC premise is formally superseded, not merely deferred.
