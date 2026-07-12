---
experiment: EXP-008
hypothesis: HYP-008
status: PASS
version: v1.0
updated: 2026-07-10
owner: operator (STK-001)
---

# EXP-008 — Cross-client mirroring + cross-surface permission/concurrency spike

**Verdict: PASS. HYP-008 confirmed — full bidirectional mirroring is achievable ADDITIVELY (zero
upstream edit, zero `marid-auth/src` edit), with INV-001 held by construction (view-via-binding,
act-via-ownership), blast-radius contained, and graceful degradation.**

Validates [HYP-008](../research/hypothesis-register.md): *full bidirectional mirroring is achievable
additively (session↔surface binding registry + binding-aware `isVisible` filter + channel-client) with
no upstream edit, INV-001 held across permission-surfacing + concurrency.* Load-bearing for
[ADR-0011](../adrs/adr-0011-marid-gateway.md) / [ADR-0012](../adrs/adr-0012-cross-client-mirroring.md);
resolves [RISK-019](../risks/risk-register.md) (NFR-001) and [RISK-024](../risks/risk-register.md)
(gateway blast radius); evidence for AC-019 and AC-024.

## Result in one line

Mirroring is a **one-predicate swap**. The `/event` firehose already streams every instance event to
every SSE connection; `marid-auth` narrows it per-token via `filterSseStream(body, owns)`
(`event-filter.ts:59`), where `owns` is built at `middleware.ts:228` and injected at the filter site
`middleware.ts:266-267`. Replacing that single `owns` with `isVisible = (id) => owned.has(id) ||
attachedTo(token).has(id)` — fed by a durable session↔surface **binding registry** written by `/attach`
— yields **view-via-binding**, while the **acting** path (`authorize({… owns})` at `scope.ts:90` /
`middleware.ts:199`) is left on `owns`, yielding **act-via-ownership** for free. No new broadcast bus,
no upstream file touched.

## Setup actually executed (and deviation from the plan)

The hypothesis-register SETUP calls for attaching a live Telegram chat to a Web/API session and driving
turns from both surfaces against a running `marid serve`. Two constraints made a **primitive-composition
spike** the higher-signal execution:

1. The experiment's real question is **architectural, not behavioral**: *can the visibility + authorization
   + degradation semantics be composed from the EXISTING marid-auth primitives without modifying them?* The
   cleanest proof is to import the **unmodified** `filterSseStream` and `authorize`, compose them with the
   one new predicate + a stub registry, and assert every required property — while `git` witnesses that no
   `src/` file changed.
2. The live-permission half cannot be driven end-to-end anyway: the openai-compatible **test provider does
   not forward tools to the model** (`marid-telegram/src/gateway.ts:30-33`), so no real `permission.asked`
   is emitted — PH-4 already established the faked-injection pattern for exactly this. The cross-surface
   first-responder-wins property is therefore modelled as the idempotent single-use reply guard the
   production reply path needs.

Spike: `packages/marid-auth/test/exp-008-mirroring-spike.test.ts` (throwaway; **not** WBS-6.3 production
wiring). It reuses the `event-filter.test.ts` harness idiom (`frame` / `byteStream` / `readAll`) and the
real exports. Run on the PH-6 branch with the recorded green baseline (marid-auth 77/0, marid-telegram
58/0).

## Evidence (all PASS)

| # | Property (PASS bar) | Assertion | Result |
|---|---|---|---|
| 1 | **Mirroring works** (view-via-binding) | An `/attach`-bound channel receives the web session's frames through the real `filterSseStream` | ✅ web turn appears in the channel |
| 2 | **Explicit-attach scope** | An unattached channel does NOT receive the web session's frames | ✅ fresh web session does not auto-appear |
| 3 | **Bidirectional** | A second surface attached to the channel's session receives the channel's frames | ✅ channel turn mirrored outward |
| 4 | **Act-via-ownership / no privilege escalation** (INV-001) | The real `authorize` DENIES a bound-but-not-owner channel replying to / prompting a session it does not own | ✅ deny (reply, prompt), and `/shell` still deny-by-default; own-session act still allowed |
| 5 | **Blast-radius no-op** (RISK-024/AC-024) | With nothing attached, `isVisible` is byte-identical to `owns` for every id | ✅ plain-client path unchanged |
| 6 | **Graceful degradation** (RISK-024/AC-024) | A THROWING registry collapses to owns-only behavior; the SSE filter still runs end-to-end | ✅ no crash; mirror silently drops; auth path unbroken |
| 7 | **First-responder-wins / no double-approve** | A permission is answered exactly once; the second reply is a no-op | ✅ applied then ignored |

```
$ bun test test/exp-008-mirroring-spike.test.ts
 10 pass · 0 fail · 18 expect() calls

$ bun test            # full marid-auth suite
 87 pass · 0 fail     # was 77/0 baseline + 10 spike tests → non-regression (RISK-017)

$ git status --short packages/
?? packages/marid-auth/test/exp-008-mirroring-spike.test.ts   # ← the ONLY change: additivity proven
```

## What this settles

- **RISK-019 (NFR-001) — closed as additive.** Mirroring rides the existing firehose + per-connection
  filter; the production delta is (a) a durable binding registry (like `ownership.json`), (b) the
  `isVisible` predicate at `middleware.ts:266-267`, (c) the channel-client consuming bound sessions. No
  upstream edit. The one residual write-path — *iff* OpenCode owns session metadata the registry must
  mutate — remains a single enumerated `Server.extend` hook (WBS-6.1), not a scattered patch surface.
- **INV-001 held by construction.** Because acting stays gated on `owns` (`scope.ts:109`), a surface can
  *see* a bound session's events but can never *act* (prompt/approve/shell) on a session it does not own.
  No mirroring-induced privilege escalation.
- **RISK-024 / AC-024 (blast radius).** Unattached sessions make `isVisible ≡ owns` — a literal no-op for
  every plain TUI/Web client — and an injected registry fault degrades to today's non-mirrored behavior
  without breaking auth or a plain client.

## Residual / carried into WBS-6.3–6.5

- **Mid-stream binding needs a reconnect.** `owns`/`isVisible` is snapshotted at subscribe time
  (`event-filter.ts:56-58` `ponytail:` note). An `/attach` during a live stream takes effect only after the
  channel-client reconnects the firehose. This is WBS-6.5's job (SSE reconnect + authoritative re-fetch);
  the spike confirms the predicate composition, not the reconnect trigger — that is tested live at WBS-6.5.
- **Durable registry + `/attach` command** are production concerns (WBS-6.3), stubbed in-memory here.
- **Real cross-surface permission surfacing** (a genuine `permission.asked` fanned to a bound surface's
  inline keyboard) is exercised at WBS-6.4 with the faked-SDK injection pattern; the property (idempotent
  single-use reply + ownership gate) is what this spike locks.

**FAIL path not taken:** no upstream edit was required, so the NFR-001 escape-hatch weighing (a single
`P-*` vs. the additive envelope) does not trigger. HYP-008 stands.
