---
id: ADR-0016
status: Proposed
version: 1.0.0
updated: 2026-07-11
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0016 — SSE owns∪bound isolation must key on the route, not the client `Accept` header

## Status

**Approved** (2026-07-11, operator STK-001) — drafted after a live test tier surfaced a realized INV-001
leak (see [EXP-015](../experiments/exp-015-report.md), [RISK-025](../risks/risk-register.md)); approved and
implemented the same day. **Implementation:** `isStream()` recognises `GET /event` and `GET /global/event`
as streams by route (regardless of the `Accept` header), so the owns∪bound filter runs on the real
header-less SDK path; a real-request-level regression test (`global-event-filter.test.ts`, PART 2b) pins it.
This also corrects the rate-limit classification of a header-less firehose request (it is a stream) — a
strict improvement consistent with the decision below.

## Context

The `marid-auth` wrapper enforces strict per-token isolation on the SSE firehoses (`/event`,
`/global/event`): a non-admin token must see only frames for sessions it **owns** or is **bound** to
(owns∪bound; view-via-binding / act-via-ownership, INV-001). WBS-6.1 slice b's audit records this as *"the
`/global/event` INV-001 gap closed"* (AC-019) and PH-1 records *"client event/list isolation"* as **Met**
(AC-004); AC-024's blast-radius claim likewise asserts *"the owns∪bound filter on `/event`+`/global/event`
bounds what a token can view."*

The filter, however, is **gated on `isStream(request)`**, which returns true **only when the request
carries the header `Accept: text/event-stream`** (`packages/marid-auth/src/middleware.ts:48-50`). The whole
filter block lives inside `if (stream) { … }` (middleware:277). The SDK's own SSE client
(`packages/sdk/js/src/v2/gen/core/serverSentEvents.gen.ts`) — the exact path
`@marid/channel-client` uses via `sdk.global.event()` — **does not send that header** (it sets only
`Last-Event-ID`). So a real firehose subscription is classified as a **non-stream**, the filter block is
**skipped**, and `/global/event` (and `/event`) is served **UNFILTERED** to the non-admin token.

This was invisible to the unit suite (`packages/marid-auth/test/global-event-filter.test.ts`) because it
exercises the filter **function** directly and with header-ful requests — never a real header-less SDK
request. It was surfaced only by a **live** test tier (WBS-6.6, [EXP-015](../experiments/exp-015-report.md)):
a channel token received and rendered a session it neither owned nor was bound to.

**Proof (deterministic, model-free — `packages/opencode/scripts/global-event-isolation-repro.ts`):**

| `/global/event` subscribe (channel token) | `Accept: text/event-stream`? | admin-only session |
|---|---|---|
| raw fetch **with** the header | yes | **isolated** ✓ |
| raw fetch **without** the header | no | **LEAKS** |
| `sdk.global.event()` (the real channel path) | **no — SDK omits it** | **LEAKS** |

The filter itself is correct; **gating a security boundary on a client-supplied header is the defect.**

## Decision (proposed)

Recognise the firehose routes as streams by **route (pathname)**, not by trusting a client header:

- Treat `GET /event` and `GET /global/event` as streams for the purpose of applying the owns∪bound filter
  regardless of the `Accept` header — i.e. the `if (stream)` filter branch (middleware:277–302) must run
  for these routes whenever the token is non-admin, independent of `isStream()`. (Rate-limiting may keep
  its current stream/non-stream accounting; only the **filter gate** changes.)
- Fail **closed**: a non-admin request to a firehose route is filtered even if the request shape is
  unexpected — a security boundary must never depend on client-supplied content.

This is **Marid-owned** (in `marid-auth`, an additive package), **sync-durable**, and requires **no upstream
edit and no new `P-*`**.

## Consequences

- **Positive:** closes the realized INV-001 leak on both firehoses for every non-admin scope (channel and
  client); restores the isolation AC-004 / AC-019 / AC-024 assert; independent of SDK/client header behaviour.
- **Required with the fix:** a regression test **at the real request level** — a header-less `GET
  /global/event` (and `/event`) for a non-admin token MUST still drop non-owned frames. The absence of such
  a test is itself part of the defect; a function-level test is insufficient (it is what missed this).
- **Re-verification:** AC-004, AC-019, and AC-024 evidence must be re-established on the live path once the
  fix lands (their current "Met/closed" evidence is invalidated — see the acceptance audit).
- **Neutral:** admin tokens remain unfiltered by design (`isolate = scope !== "admin"`), unchanged.

## Alternatives considered

- **Make the SDK send `Accept: text/event-stream`.** Rejected: the SDK is upstream-generated (editing it is
  an upstream patch surface / `P-*` and drifts on regen), and — more fundamentally — it leaves a **security
  boundary trusting a client to opt in**. Any client (or a future SDK regen) that omits the header
  re-opens the hole.
- **Status quo.** Rejected: a standing INV-001 violation on the live path.

## Links

- Invariant: **INV-001** (deny-by-default channel capability; owns∪bound isolation).
- Evidence: [EXP-015](../experiments/exp-015-report.md) (HYP-015 refuted); repro
  `packages/opencode/scripts/global-event-isolation-repro.ts`.
- Risk: [RISK-025](../risks/risk-register.md).
- Affected acceptance: AC-004 (PH-1 client event isolation), AC-019 (mirroring / unattached-invisible),
  AC-024 (blast-radius isolation) — see [acceptance-audit](../validation/acceptance-audit.md).
- Prior: WBS-6.1 slice b (`global-event-filter.test.ts`), ADR-0011 (marid-auth gateway), ADR-0012 (mirroring),
  DEC-011 (client-scope isolation).
