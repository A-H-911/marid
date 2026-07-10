---
status: Approved
version: v1.0
updated: 2026-07-09
owner: operator (STK-001)
---

# Roadmap (PH-) — Gate 10

Phases are dependency-ordered, not date-boxed (ASM-005: no hard deadline). Each phase exits at a measurable
milestone (see [milestones](milestones.md)); the leaf work items and their Definition of Done are in
[work-breakdown](work-breakdown.md). Execution follows TDD per the [test strategy](../validation/test-strategy.md);
each phase ends at a review checkpoint with the operator (see [checkpoints](../execution/checkpoints.md)).

## Phases & milestones

| Phase | Goal | Milestone (exit) | Depends on |
|---|---|---|---|
| PH-0 Foundations ✅ | Fork exists, CI skeleton green, all 4 experiments answered | **MS-001 MET (2026-07-04)**: EXP-001..004 all PASS (no FAIL → no fallbacks); reports in `../experiments/`. Shipped PR #9. | Gates 9, 11, 12 |
| PH-1 Marid layer ✅ | marid-auth + distribution profile + branding | **MS-002 MET (2026-07-04)**: authenticated `marid` binary from the `marid` profile passes contract tests; 3-OS `marid-build` green. Shipped PR #13. | PH-0 |
| PH-2 Instances ✅ | marid-instance CLI + isolation | **MS-003 MET (2026-07-05)**: KPI-003 — 3-OS `marid-isolation` green (2 consecutive all-green runs incl. announced unit-windows re-run). Shipped PR #17. | PH-1 |
| PH-3 Cross-interface ✅ | TUI-as-client default + §7 flow verified | **MS-004 MET (2026-07-05)**: KPI-001 demo repeatable — 3-OS `marid-sync` green; concurrency semantics documented (contract v1.1). Shipped PR #19. | PH-1 (parallel with PH-2) |
| PH-4 Telegram ✅ | marid-telegram + capability policy | **MS-005 MET (2026-07-07)**: KPI-002 — 3-OS `marid-telegram` green; Telegram round trip + policy-denial paths verified. Shipped PR #23. | PH-1; PH-3 for live-update assertions |
| PH-5 Release & sync ✅ | Public distribution + one real upstream sync + docs | **MS-006 MET (2026-07-09)**: public `v0.1.0` release (7 signed targets), KPI-004 (sync #31) / KPI-005 (clean G-TRACE) / KPI-006 (RC 17 checks green); readiness report Approved — **gate-14 ACCEPTED 2026-07-09** | PH-2..4 |
| PH-6 Telegram-first (gateway + full experience + mirroring + tests) ⏳ | Marid Gateway (marid-auth as a component) + `@marid/channel-client`; full Telegram (files both ways / whitelisted slash / inline kbd); **bidirectional cross-client mirroring** (explicit-attach); 4-tier real-client test strategy — ADR-0009/0011/0012/0013 | **MS-007 (not-started)**: AC-017/019/020/021 + EXP-007/008/009 PASS; TEST-AUTH/SEC green | MS-006 (post-MVP; gated) |
| PH-7 WhatsApp adapter ⏳ | New `@marid/whatsapp` unofficial-client channel (separate process, `channel:` token) — ADR-0010 | **MS-008 (not-started)**: AC-018 + EXP-006 PASS (fake-WA) + PH-7-start live probe | MS-006 (post-MVP; PH-6-independent; gated) |

Per-phase goal/scope/deliverables/validation/exit detail is carried in the milestone criteria
([milestones](milestones.md)) and the phase-grouped work items ([work-breakdown](work-breakdown.md)); this
overview is the single place that sequences the phases and their dependencies.

## Parallelization & staffing note

Single execution agent + operator reviews: PH-2 and PH-3 can interleave after PH-1; PH-4 starts once
WBS-1.2 lands (needs tokens). Every phase-exit is an operator checkpoint mapped to the follow-up prompts
in the handoff package.
