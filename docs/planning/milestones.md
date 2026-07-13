---
status: Approved
version: 1.0.0
updated: 2026-07-12
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
| MS-007 | Telegram-first: gateway + full experience + mirroring + tests | AC-017/019/020/021 green — full Telegram (files both ways / whitelisted slash / inline kbd) + **bidirectional mirroring** (explicit-attach, INV-001-safe) + real-client E2E (userbot + Web-Playwright); EXP-007/008/009 PASS; TEST-AUTH/TEST-SEC stay green | PH-6 | ✅ **MET (2026-07-12, PR #48 `4409d92f`)** — **AC-019 Met** (live bidirectional mirror + unattached-invisible + attach re-subscribe, real GLM over real MTProto), **AC-020 Met** (userbot real-protocol slash E2E), **AC-021 Met (2026-07-12)** (TEST-TG-UI Telegram-Web-Playwright render tier live vs production — `<strong>`/`<code>`/`<pre>`/no-literal + `<img>`, 4/4 stable; [EXP-009](../experiments/exp-009-report.md) PASS), **AC-024 Met**, **AC-017 Met (2026-07-12)** — the two prior live-impossible parts resolved: root-caused the gateway's `promptAsync` (forks the turn off its request scope → ZERO tools) and fixed it by driving the sync `session.prompt` route detached (Marid-side, no upstream edit); **inline keyboard proven LIVE** (`scripts/tg-tool-e2e.ts` — real GLM bash call → Approve → tool runs) + **outbound files as multipart bytes**. **All MS-007 acceptance criteria (AC-017/019/020/021/024) now Met; EXP-007/008/009 PASS.** INV-001 firehose isolation leak found via the live tier & fixed (ADR-0016/0017; EXP-015/RISK-025). **WBS-6.7 docs done (2026-07-12)** — `api-event-contract.md` v1.2 + `architecture.md` v1.1 + Tarseem `20-gateway-mirroring` diagram + `ci.yml`/manual staleness fixes; `validate_package.py docs/` = OK. **Merged to develop via PR #48 (`4409d92f`, all 20 CI green) → MS-007 MET (2026-07-12); PH-6 complete.** Native-mobile (EXP-010) deferred (never an MS-007 gate). ADRs 0009/0011/0012/0013 + 0016/0017 Approved. |
| MS-008 | WhatsApp adapter working | AC-018 green — round-trip + INV-001 + outbound-only; EXP-006 PASS (fake-WA) then PH-7-start live probe | PH-7 | not-started (post-MVP; ADR-0010 Proposed, gated) |
| MS-009 | Isolation & deep rebrand shipped | AC-025..031 green — a plain `marid` binary reads/writes only marid dirs on a machine with co-installed OpenCode (effective read paths; fresh auth; coexistence); `OPENCODE_*` data-layer overrides disclosed; no update popup; agent identity = Marid (no `\bopencode\b` in emitted prompts); TUI startup/exit/footer/notif = Marid (no GO upsell); web favicon/PWA/Mark/Splash/notif = Marid (no `opencode.ai` fetch); one-time migration from populated v0.2.0 (gateway tokens + Telegram pairing survive) — and all 6 reported v0.2.0 issues map to a passing check | PH-8 | not-started (post-release; ADR-0018 + DEC-022..027 Proposed, operator-gated) |
