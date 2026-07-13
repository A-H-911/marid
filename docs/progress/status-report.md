---
status: Approved
version: 1.0.0
updated: 2026-07-13
owner: operator (STK-001)
generation: derived
---

# Status Report

**Derived — regenerated each update cycle.** Point-in-time health snapshot. History is in the
[progress log](progress-log.md); the closing loop is the [acceptance audit](../validation/acceptance-audit.md).

## At a glance

| | |
|---|---|
| Reporting date | 2026-07-13 |
| Active work | **PH-8 (Isolation & deep rebrand) OPENED — Phase 0 (Keystone scoping + ADR) docs-only, at the operator gate.** Post-`v0.2.0` mission: total DATA isolation from a co-installed OpenCode (dirs/config; `OPENCODE_*` env kept) + deep rebrand (agent identity, TUI, web) + upstream-sync-first. Authored **ADR-0018** (Proposed) + **MS-009** + **AC-025..031** (one per reported v0.2.0 issue) + **WBS-8.0..8.7** + **DEC-022..027** (022..026 Approved operator inputs; ADR-0018 realization Proposed). **STOP: no code phase (WBS-8.1 upstream sync onward) begins until the operator approves ADR-0018 + merges this docs PR (INV-005).** |
| Last completed phase | **PH-6 (Telegram-first) DONE — MS-007 MET (2026-07-12, PR #48 squash `4409d92f`, all 20 CI green).** The full PH-6 stack is merged to `develop`: **WBS-6.1** (Marid Gateway + `@marid/channel-client` + attach endpoint + `owns ∪ bound` `/global/event` fine-filter), **6.2** (full Telegram experience — markdown/files/slash/inline-kbd, marid-telegram 68→99 green), **6.3** (durable `BindingStore` + binding-aware `isVisible`), **6.4** (cross-surface permission: first-responder-wins, view-via-binding/act-via-ownership), **6.5** (SSE reconnect + backoff + re-fetch recovery + attach-triggered re-subscribe), **6.6** (four live test tiers), **6.7** (docs: contract **v1.2** + architecture **v1.1** + Tarseem `20-gateway-mirroring` + `docs/usage.md` user guide). **All MS-007 ACs Met** (AC-017/019/020/021/024); EXP-005/007/008/009 PASS. **🔒 INV-001 firehose isolation leak found via the live tier & FIXED** — ADR-0016 (route-based `isStream`) + ADR-0017 (lazy own-session visibility); zero upstream edit, no P-\*. Native-mobile EXP-010 **deferred** (never an MS-007 gate). |
| Overall status | **MVP COMPLETE (gate 14, 2026-07-09) + PH-6 (Telegram-first) COMPLETE (MS-007, 2026-07-12).** Public `v0.1.0` released; KPI-004∧005∧006 green; docs `validate = OK`. PH-6 fully merged to `develop` (PR #48 `4409d92f`) — AC-017/019/020/021/024 all Met. |
| Last milestone met | **MS-007 (2026-07-12)** — PH-6 Telegram-first: gateway + full experience + bidirectional mirroring + live test tiers (PR #48, squash `4409d92f`, all 20 CI green) |
| Next milestone | **MS-009 (PH-8 Isolation & deep rebrand)** — scoping in progress (this docs PR); **at the operator gate** (ADR-0018 + DEC-022..027 Proposed). AC-025..031 Met + all 6 reported v0.2.0 issues map to a passing check → v0.3.0. *(MS-008 / PH-7 WhatsApp remains not-started, operator-gated, PH-8-independent.)* |

## Phase progress

| Phase | Status | Exit criteria met? | Evidence | Notes |
|---|---|---|---|---|
| PH-0 Foundations | done | yes | MS-001 (PR #9) | EXP-001..004 PASS |
| PH-1 Marid layer | done | yes | MS-002 (PR #13) | marid-auth + profile |
| PH-2 Instances | done | yes | MS-003 (PR #17) | 3-OS `marid-isolation` |
| PH-3 Cross-interface | done | yes | MS-004 (PR #19) | 3-OS `marid-sync`; contract v1.1 |
| PH-4 Telegram | done | yes | MS-005 (PR #23) | 3-OS `marid-telegram` green; INV-001 backstop; AC-010/011/012 Met |
| PH-5 Release & sync | **done** | yes | **MS-006 (2026-07-09)**: public `v0.1.0` release (#35→main `8bf4ab61e`); WBS-5.1 (#27) · 5.3 (#28/#31) · 5.4 (#33) · 5.2 (#35/#38) · 5.5 (this PR) | KPI-004∧005∧006 green; `validate = OK`. Gate-14 ACCEPTED 2026-07-09 |
| PH-6 Telegram-first | **done** | yes | **MS-007 (2026-07-12)**: Marid Gateway + full Telegram + bidirectional mirroring + 4 live test tiers; WBS-6.3 (#44) · 6.1 (#46) · 6.5 (#47) · 6.2/6.4/6.6/6.7 (#48 `4409d92f`) | AC-017/019/020/021/024 all Met; EXP-005/007/008/009 PASS; INV-001 leak fixed (ADR-0016/0017); zero upstream edit, no P-\* |
| PH-8 Isolation & deep rebrand | **scoping (Phase 0)** | at operator gate | this docs PR: ADR-0018 + MS-009 + AC-025..031 + WBS-8.0..8.7 + DEC-022..027 | Proposed; total DATA isolation (env kept) + deep rebrand + sync-first; STOP at ADR-0018 approval before any code |

## Acceptance snapshot

MVP: **14 / 16 Met**, **1 Partial** (AC-016 — MVP redaction slice holds, full secret-value redactor deferred,
ADR-0007), **1 Not-met** (AC-007 — premise superseded). AC-014 Met via the public `v0.1.0` release (KPI-006);
AC-015 Met via the one real sync cycle (PR #31, KPI-004). AC-010/011 Met via
the live 3-OS TEST-TG; AC-012 Met via the faked-SDK permission round trip + `parseAskEvent` + `permission.test`
+ marid-auth `channel-binding`. Detail in the [acceptance audit](../validation/acceptance-audit.md).

PH-6 (Telegram-first): **AC-017/019/020/021/024 all Met** (2026-07-12, PR #48) — live tool calling, bidirectional
mirroring, userbot + Web-Playwright real-client tiers, gateway blast-radius; EXP-005/007/008/009 PASS.

## Completed since last report
- **WBS-5.2 / AC-014 / KPI-006** (PR #36 finalize, #35 RC → main, #38 smoke fix): **public `v0.1.0` release** —
  7 targets × (archive + `.sha256` + `.minisig`) = 21 signed assets; RC 17 checks green; 3-OS install-smoke
  (Linux+Windows green, macOS asset-name typo fixed forward). `marid upgrade` footgun removed.
- **WBS-5.5** (this PR): G-IDS fixed (audit rows reference criteria defs), FR-064 re-marked `partial`, AC-014
  text corrected (DEC-010), `validate = OK`, readiness report authored.
- Earlier PH-5: **WBS-5.1** (#27) release pipeline + minisign trust anchor; **WBS-5.3 / KPI-004** (#28/#31)
  sync automation + one real 91-commit cycle; **WBS-5.4** (#33) Marid README + flame logo + P-2/P-3.

## In progress
**PH-8 Phase 0 — Keystone scoping + ADR (docs-only), at the operator gate.** Opened the post-`v0.2.0` mission
(twice-reviewed plan): total DATA isolation from a co-installed OpenCode + deep rebrand + upstream-sync-first.
This docs PR authors **ADR-0018** (Proposed), opens **MS-009 / AC-025..031 / WBS-8.0..8.7**, records **DEC-022..027**
(022..026 Approved operator inputs; 027 Proposed), amends `branding.md`'s "Rebrand boundary", and pre-registers
**P-6 / P-7 / P-8 + a P-2 expansion**. **STOP:** no code phase (WBS-8.1 upstream sync onward) starts until the
operator approves ADR-0018 and merges this PR (INV-005). PH-0..6 complete; PH-7 (WhatsApp) operator-gated, not
started (PH-8-independent).

## Blockers & risks
No active blockers. WBS-5.5 resolved the two devil's-advocate flags: FR-064 re-marked `partial` (§18
dependency/secret/license scans + SBOM unbuilt — deferred, ADR-0007), and AC-014 text corrected to
public/anonymous (DEC-010). Disclosed residuals carried into the release: AC-016 Partial (egress
secret-redactor deferred, RISK-007 / ADR-0007 containment), AC-007 Not-met (premise superseded — re-fetch
recovery is the delivered behavior), Telegram gateway **beta** (UX defects → post-MVP fork, ADR-0008 /
deferred #9). Watch: upstream v1→v2 migration (RISK-001) on future syncs.

## Decisions since last report
**PH-8 (2026-07-13, plan §2):** total **DATA** isolation via a build-time app-name, **keep `OPENCODE_*` env** +
pierce disclosure (DEC-022); config `marid.json` + project-`opencode.json` fallback, **no global fallback**
(DEC-023); `.opencode/` kept upstream-named (DEC-024); **one-time-copy** migration (DEC-025); full agent-identity
transform (DEC-026); **no DB rename** (DEC-027, Proposed). Realized by **ADR-0018 (Proposed — at the gate)**.
Earlier: releases **public/anonymous** (DEC-010); **minisign** signing; **ship-under-containment** (ADR-0007);
logo = **red-orange flame + shadowed "marid" wordmark** (2026-07-08); `0.x` release line (package.json stays
upstream `1.17.15`; release↔upstream mapping = baseline SHA per sync).

## Upcoming
**PH-8 (Isolation & deep rebrand) — at the operator gate.** On ADR-0018 approval + merge of this docs PR, the
phases run in order (each branch → PR → CI green → operator merge): **WBS-8.1** upstream sync first
(`upstream/dev cf7503687a`, 167 commits / 458 files) → **8.2** total DATA isolation (build-time app-name P-6 +
config P-7 + migration) → **8.3** agent identity (P-8) → **8.4** TUI rebrand (P-2) → **8.5** web UI (separate PR)
→ **8.6** docs/diagrams/screenshots → **8.7** release **v0.3.0**. MS-009 closes when AC-025..031 are Met and all 6
reported v0.2.0 issues map to a passing check. **Still operator-gated, PH-8-independent:** **PH-7 WhatsApp**
(ADR-0010 / DEC-015/016). Backlog: egress secret-redactor (ADR-0007 / AC-016), AC-007 formal supersede, stats
mechanism (deferred #10), upstream sync cadence.
