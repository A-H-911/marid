---
experiment: EXP-015
hypothesis: HYP-015
status: Complete
version: v1.0
updated: 2026-07-11
owner: operator (STK-001)
---

# EXP-015 — Live SSE firehose isolation probe (owns∪bound on the real SDK path) · TEST-SEC

## Result in one line

**HYP-015 REFUTED.** The owns∪bound isolation that the unit suite proves at the filter-function level does
**not** hold on the live path a channel/client token actually uses — `/global/event` (and `/event`) is
served **unfiltered** to a non-admin token, a realized **INV-001** leak. Root cause + fix decision:
[ADR-0016](../adrs/adr-0016-sse-isolation-route-not-header.md); exposure: [RISK-025](../risks/risk-register.md).

## Hypothesis

**HYP-015:** The owns∪bound SSE isolation (WBS-6.1 slice b, AC-019 / AC-004 / AC-024) holds on the **live** path a
non-admin token uses in production — i.e. a channel/client token subscribing via `sdk.global.event()` (or
`/event`) receives **only** frames for sessions it owns or is bound to.

## How it surfaced

The WBS-6.6 live model tier (`packages/opencode/scripts/tg-model-e2e.ts` — real GLM over the real gateway +
real MTProto) included the AC-019 negative control *"an unattached session must not appear on the channel."*
It **failed**: a channel token received and rendered a session created by an **admin** token that the channel
neither owned nor was bound to (self-bindings and admin-view-of-bindings both empty at the time). The two
"positive" AC-019 sub-results were confounded (mirror-in observer was an admin token — unfiltered by design)
or invalidated (mirror-out mirrors regardless of attach, because the filter is a no-op).

## Minimal reproduction (deterministic, model-free)

`packages/opencode/scripts/global-event-isolation-repro.ts` — no GLM, no Telegram, no gateway. Mint an admin
token + a channel token; subscribe the **channel** token to `/global/event` three ways; create an
**admin-only** session after each subscribe; report whether it leaks into the channel's stream:

| subscribe mode | `Accept: text/event-stream`? | admin-only session |
|---|---|---|
| raw `fetch` **with** the header | yes | **isolated** (filter works) |
| raw `fetch` **without** the header | no | **LEAKS** |
| `sdk.global.event()` (the real channel-client path) | **no — the SDK omits it** | **LEAKS** |

Runs in ~15 s, exits non-zero on leak.

## Root cause

`marid-auth` gates its owns∪bound SSE filter on `isStream(request)`, which returns true **only** for
`Accept: text/event-stream` (`packages/marid-auth/src/middleware.ts:48-50`); the filter block is inside
`if (stream)` (middleware:277). The generated SDK SSE client
(`packages/sdk/js/src/v2/gen/core/serverSentEvents.gen.ts`) never sends that header (sets only
`Last-Event-ID`), so the real firehose request is treated as a non-stream → filter skipped → unfiltered
firehose. The middleware **filter itself is correct** (raw-fetch WITH the header isolates); the **header
gate** is the defect.

## Why the unit suite missed it

`packages/marid-auth/test/global-event-filter.test.ts` exercises `owningSessionGlobal(...)` directly and
drives `auth.handle` with **header-ful** requests — it never issues a real header-less SSE request, the
exact shape the SDK produces. Synthetic-vs-real gap.

## Blast radius

The `isStream` gate covers **both** `/event` and `/global/event`, for **every** non-admin token — **client
scope included**. So this defeats, on the live path:
- **AC-019** — the "unattached session stays invisible / INV-001 leak closed" claim (WBS-6.1 slice b).
- **AC-004** — PH-1 "client event/list isolation" (the **event** firehose half; route-ownership 403s are
  unaffected).
- **AC-024** — "the owns∪bound filter on `/event`+`/global/event` bounds what a token can view."

## What this settles

- The fix is a route-based (not header-based) filter gate + a **real-request-level** regression test —
  [ADR-0016](../adrs/adr-0016-sse-isolation-route-not-header.md) (Proposed, operator-gated).
- WBS-6.6 does **not** close and AC-019 is **not** flippable to Met until the leak is fixed and isolation is
  re-established on the live path. AC-020 (slash) and the AC-017 live text round-trip (the channel's own
  owned session) are unaffected and stand.

## Resolution (2026-07-11)

**ADR-0016 approved + implemented the same day.** `isStream()` (`packages/marid-auth/src/middleware.ts`)
now recognises `GET /event` and `GET /global/event` as streams by **pathname**, header-independent, so the
owns∪bound filter runs on the real header-less SDK path. Pinned by a **real-request-level** regression test
(`packages/marid-auth/test/global-event-filter.test.ts` PART 2b — a header-less non-admin firehose request
must still drop non-owned frames; RED before the fix, GREEN after). Verification: marid-auth **123** green;
`scripts/global-event-isolation-repro.ts` now isolates on **all three** modes (incl. `sdk.global.event()`).
See [RISK-025](../risks/risk-register.md) (resolved), [ADR-0016](../adrs/adr-0016-sse-isolation-route-not-header.md).

## Residual / carried forward

The AC-019 **live bidirectional mirror** re-verification (re-run `scripts/tg-model-e2e.ts` — mirror-out was
invalidated by the leak, now unblocked) and the full WBS-6.6 close (AC verdict flips + `keystone-state.json`
reconcile) are the remaining operator-gated close steps.
