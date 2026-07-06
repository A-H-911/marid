---
status: Draft
version: 0.1.0
updated: 2026-07-06
owner: operator (STK-001)
generation: derived
---

# Acceptance Audit (verdict × evidence per AC-)

**Derived — regenerated at every phase gate.** The execution agent's during/after close-out of
[acceptance-criteria](acceptance-criteria.md): each `AC-` carries a verdict `Met | Partial | Not-met |
Pending` with evidence. Distinct from the planner's pre-handoff readiness report. Gate **G-PROGRESS**
checks that every `AC-` is represented here. Seeded from real state through **PH-3 (MS-004, 2026-07-05)**;
PH-4/PH-5 criteria are `Pending`.

| AC | Criterion (short) | Verdict | Evidence | Notes |
|---|---|---|---|---|
| AC-001 | Instance add/start → own tree + health | Met | MS-003 (PR #17): `marid instance add/start`, allocated port, 0700 tree, health-gated; 3-OS `marid-isolation` green | PH-2 |
| AC-002 | Two instances concurrent → no cross-write | Met | MS-003: live 2-instance diff `instance-isolation.test.ts` — distinct ports, per-instance DB/sessions, no escape from composed XDG roots | PH-2 · NFR-008 |
| AC-003 | No token → 401 + audit | Met | MS-002 (PR #13): `@marid/auth` 401 unauthenticated; audit JSONL line written | PH-1 |
| AC-004 | client-scope crosses session/admin → 403 + audit | Met | MS-002 + DEC-011 durable ownership; 403 on non-owned session / admin route; client event/list isolation (PR #15) | PH-1 |
| AC-005 | Over rate limit → 429 + SSE cap | Met | MS-002: token-bucket 10/s burst 30, SSE cap 4, 429 + retry-after | PH-1 |
| AC-006 | SDK-created session visible + live in TUI/subscriber | Met | MS-004 (PR #19): §7 KPI-001 E2E — 2nd client discovers+continues, subscriber sees both | PH-3 · KPI-001 |
| AC-007 | Reconnect with `?after=<seq>` replays missed events exactly once | Not-met | Premise invalid: contract v1.1 (PH-3) corrected the `?after=` per-session replay claim — the v1 firehose is live-only. Recovery is authoritative-store re-fetch, verified under AC-008 | Criterion superseded by the v1.1 correction; see [deferred-work-register](../execution/deferred-work-register.md) |
| AC-008 | Kill + restart mid-prompt → history intact, usable | Met | MS-004: kill+restart E2E — reconnecting client re-fetches authoritative history written before restart, no state loss | PH-3 · replaces AC-007's replay premise |
| AC-009 | Two simultaneous prompts → documented queue/steer, no corruption | Met | MS-004: concurrency E2E through the authed wrapper (join/steer, one Runner, no corruption); contract v1.1 Concurrency section | PH-3 · EXP-001 |
| AC-010 | Non-allowlisted Telegram user → ignored + logged | Pending | — | PH-4 (not started) |
| AC-011 | Allowlisted ask → progressive edits, 4096-split, complete | Pending | — | PH-4 (EXP-003 cadence constants ready) |
| AC-012 | Policy-denied tool → inline-keyboard permission; deny blocks | Pending | — | PH-4 · INV-001 |
| AC-013 | `marid` profile build → excluded surfaces absent + hygiene grep | Met | MS-002: additive `src/marid.ts` + `script/marid-build.ts`; 3-OS `marid-build` green; hygiene grep passes | PH-1 · ADR-0002 |
| AC-014 | Tagged release → private binaries+checksums, 3-OS install | Pending | — | PH-5 |
| AC-015 | Upstream sync PR → contract/migration/delta + one real cycle | Pending | — | PH-5 · KPI-004 |
| AC-016 | Secret would appear → redacted | Met | MS-002: marid-auth audit redaction test (WBS-1.3) | PH-1 · RISK-007 |

## Summary

- **10 / 16 Met** (AC-001..006, 008, 009, 013, 016), **1 Not-met** (AC-007 — premise superseded),
  **5 Pending** (AC-010, 011, 012 → PH-4; AC-014, 015 → PH-5). Realized through PH-3 (MS-004).
- **Residual honesty:** AC-007 will be formally superseded (re-fetch recovery is the delivered behavior);
  tracked in the [deferred-work register](../execution/deferred-work-register.md).
