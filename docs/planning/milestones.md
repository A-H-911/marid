---
status: Approved
version: 1.0.0
updated: 2026-07-09
owner: operator (STK-001)
---

# Milestones (MS-)

Binary, verifiable phase-exit checkpoints. Each milestone gates entry to the next phase (see
[roadmap](roadmap.md)); the underlying work items are in [work-breakdown](work-breakdown.md). Status is
`MET` (with date + shipping PR) or `not-started`.

| ID | Milestone | Criteria (met when…) | Phase | Status |
|---|---|---|---|---|
| MS-001 | Foundations ready | EXP-001..004 all PASS (no FAIL → no fallbacks); reports in `../experiments/`; CI skeleton green | PH-0 | MET 2026-07-04 (PR #9) |
| MS-002 | Marid layer ready | authenticated `marid` binary from the `marid` profile passes contract tests; 3-OS `marid-build` green | PH-1 | MET 2026-07-04 (PR #13) |
| MS-003 | Instances isolated | KPI-003 — 3-OS `marid-isolation` green (2 consecutive all-green runs) | PH-2 | MET 2026-07-05 (PR #17) |
| MS-004 | Cross-interface sync | KPI-001 demo repeatable — 3-OS `marid-sync` green; concurrency semantics documented (contract v1.1) | PH-3 | MET 2026-07-05 (PR #19) |
| MS-005 | Telegram working | KPI-002 — round trip + policy-denial paths green | PH-4 | MET 2026-07-07 (PR #23) |
| MS-006 | MVP / release-ready | KPI-004, KPI-005, KPI-006 green; readiness report accepted (execution gate 14) | PH-5 | **MET + gate-14 ACCEPTED 2026-07-09** (public `v0.1.0` release; KPI-004∧005∧006 green; readiness report Approved). Marid MVP plan (PH-0..5) complete. |
| MS-007 | Telegram-first: gateway + full experience + mirroring + tests | AC-017/019/020/021 green — full Telegram (files both ways / whitelisted slash / inline kbd) + **bidirectional mirroring** (explicit-attach, INV-001-safe) + real-client E2E (userbot + Web-Playwright); EXP-007/008/009 PASS; TEST-AUTH/TEST-SEC stay green | PH-6 | 🟡 in progress — **AC-019 Met** (live bidirectional mirror + unattached-invisible + attach re-subscribe, real GLM over real MTProto), **AC-020 Met** (userbot real-protocol slash E2E), **AC-024 Met**, **AC-017 Partial** (live text round-trip; Markdown render + inline-kbd/outbound-file = the AC-021 / faked-SDK tiers). INV-001 firehose isolation leak found via the live tier & fixed (ADR-0016/0017; EXP-015/RISK-025). **NOT MET:** AC-021 (TEST-TG-UI / EXP-009 Telegram-Web-Playwright + native-mobile — not built). ADRs 0009/0011/0012/0013 + 0016/0017 Approved. |
| MS-008 | WhatsApp adapter working | AC-018 green — round-trip + INV-001 + outbound-only; EXP-006 PASS (fake-WA) then PH-7-start live probe | PH-7 | not-started (post-MVP; ADR-0010 Proposed, gated) |
