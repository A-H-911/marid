---
status: Approved
version: 1.0.0
updated: 2026-07-11
owner: operator (STK-001)
generation: derived
---

# Status Report

**Derived — regenerated each update cycle.** Point-in-time health snapshot. History is in the
[progress log](progress-log.md); the closing loop is the [acceptance audit](../validation/acceptance-audit.md).

## At a glance

| | |
|---|---|
| Reporting date | 2026-07-11 |
| Current phase | **PH-6 in execution (Telegram-first).** De-risking done: **EXP-005/007/008 PASS**. **WBS-6.2 done** (4 Telegram UX defects; marid-telegram **68→89 green**). **WBS-6.3 done** (mirroring mechanism: durable `BindingStore` + binding-aware `isVisible`; marid-auth **87→100**, merged #44). **WBS-6.4 done** (cross-surface permission verified: first-responder-wins server invariant, ask-mirrors-to-bound-surface, act-via-ownership; concurrency = EXP-001; opencode permission **79→80**, marid-auth **→101**). **WBS-6.1 slice a done** (channel-client extracted: new additive `@marid/channel-client` ← `gateway.ts`; behavior-preserving, marid-auth **101** / marid-telegram **89** unchanged & green, channel-client **+10**; zero upstream edit, no P-\*). **WBS-6.1 slice b done** — part 1 admin-gated attach endpoint + `/doc` OpenAPI merge; part 2 fine-filtered `/global/event` (owns ∪ bound — closes the pre-existing `/global/event` INV-001 gap AND delivers mirroring; wrapped picker drops the durable `sync` twin of a non-owned session); part 3 channel-client consumes bound sessions + Telegram `defaultChatId`; owed live `/doc` assertion. **AC-024 Met; AC-019 Partial (blockers cleared — real-account live bidirectional E2E = WBS-6.6).** marid-auth **101→119**, channel-client **10→11**, marid-telegram **89→90**; zero upstream edit, no P-\*. On `feat/ph6-gateway`, **unmerged** (INV-003/005). **WBS-6.5 done** (reconnect + backoff + re-fetch recovery + attach-triggered re-subscribe via non-admin `/marid/self-bindings` poll; channel-client 16 / marid-auth 121 / marid-telegram 91 green; AC verdicts unchanged), on `feat/ph6-reconnect`, unmerged. Next: WBS-6.6 (live 4-tier E2E) / 6.7 (docs), or an operator merge |
| Overall status | **MVP COMPLETE (gate 14, 2026-07-09).** Public `v0.1.0` released; KPI-004∧005∧006 green; docs `validate = OK`. **PH-6 code underway** (WBS-6.2 + 6.3 merged/done; 6.4 + **6.1 slice a+b** done unmerged — **AC-024 Met; AC-019 Partial, blockers cleared**) |
| Last milestone met | **MS-006 (2026-07-09)** — public `v0.1.0` release, MVP release-ready |
| Next milestone | **MS-007 (PH-6 Telegram-first)** — in progress; WBS-6.2/6.3/6.4 + **6.1 slice a+b** + **6.5 (reconnect + re-fetch recovery + attach-triggered re-subscribe)** done + EXP-005/007/008 PASS; remaining WBS (6.6 live 4-tier E2E / 6.7 docs) outstanding. **AC-024 Met; AC-019 Partial (blockers cleared)**; the real-account Telegram bidirectional live E2E that flips AC-019→Met = WBS-6.6 |

## Phase progress

| Phase | Status | Exit criteria met? | Evidence | Notes |
|---|---|---|---|---|
| PH-0 Foundations | done | yes | MS-001 (PR #9) | EXP-001..004 PASS |
| PH-1 Marid layer | done | yes | MS-002 (PR #13) | marid-auth + profile |
| PH-2 Instances | done | yes | MS-003 (PR #17) | 3-OS `marid-isolation` |
| PH-3 Cross-interface | done | yes | MS-004 (PR #19) | 3-OS `marid-sync`; contract v1.1 |
| PH-4 Telegram | done | yes | MS-005 (PR #23) | 3-OS `marid-telegram` green; INV-001 backstop; AC-010/011/012 Met |
| PH-5 Release & sync | **done** | yes | **MS-006 (2026-07-09)**: public `v0.1.0` release (#35→main `8bf4ab61e`); WBS-5.1 (#27) · 5.3 (#28/#31) · 5.4 (#33) · 5.2 (#35/#38) · 5.5 (this PR) | KPI-004∧005∧006 green; `validate = OK`. Gate-14 ACCEPTED 2026-07-09 |

## Acceptance snapshot

MVP: **14 / 16 Met**, **1 Partial** (AC-016 — MVP redaction slice holds, full secret-value redactor deferred,
ADR-0007), **1 Not-met** (AC-007 — premise superseded). AC-014 Met via the public `v0.1.0` release (KPI-006);
AC-015 Met via the one real sync cycle (PR #31, KPI-004). AC-010/011 Met via
the live 3-OS TEST-TG; AC-012 Met via the faked-SDK permission round trip + `parseAskEvent` + `permission.test`
+ marid-auth `channel-binding`. Detail in the [acceptance audit](../validation/acceptance-audit.md).

## Completed since last report
- **WBS-5.2 / AC-014 / KPI-006** (PR #36 finalize, #35 RC → main, #38 smoke fix): **public `v0.1.0` release** —
  7 targets × (archive + `.sha256` + `.minisig`) = 21 signed assets; RC 17 checks green; 3-OS install-smoke
  (Linux+Windows green, macOS asset-name typo fixed forward). `marid upgrade` footgun removed.
- **WBS-5.5** (this PR): G-IDS fixed (audit rows reference criteria defs), FR-064 re-marked `partial`, AC-014
  text corrected (DEC-010), `validate = OK`, readiness report authored.
- Earlier PH-5: **WBS-5.1** (#27) release pipeline + minisign trust anchor; **WBS-5.3 / KPI-004** (#28/#31)
  sync automation + one real 91-commit cycle; **WBS-5.4** (#33) Marid README + flame logo + P-2/P-3.

## In progress
**PH-6 (Telegram-first).** MVP (PH-0..5) complete since gate 14. **WBS-6.2 implemented** (all 4 Telegram UX defects fixed
in place; marid-telegram 89 green, typecheck clean) + **EXP-005/007/008 PASS** — all on `feat/ph6-marid-gateway`,
**unmerged** (awaiting operator merge, INV-003/005). **WBS-6.3/6.4 done** (mirroring mechanism + cross-surface
permission verified) and **WBS-6.1 slice a+b done** (`@marid/channel-client` extracted + attach endpoint +
`/global/event` fine-filter + bound-session consume; **AC-024 Met; AC-019 Partial (blockers cleared)**; marid-auth 119 / channel-client 11 /
marid-telegram 90 green; zero upstream edit, no P-\*), all unmerged. **WBS-6.5 done** (SSE reconnect + backoff +
re-fetch recovery for owned sessions + attach-triggered mid-stream re-subscribe via a new non-admin
`GET /marid/self-bindings` poll; channel-client 11→16, marid-auth 119→121, marid-telegram 90→91 green; zero
upstream edit, no P-\*; AC verdicts unchanged — 6.5 is FR-036/043 + RISK-006, not an AC flip), on
`feat/ph6-reconnect`, unmerged. Outstanding: WBS-6.6 (live 4-tier real-account E2E + CI — flips AC-019 → Met),
WBS-6.7 (docs).

## Blockers & risks
No active blockers. WBS-5.5 resolved the two devil's-advocate flags: FR-064 re-marked `partial` (§18
dependency/secret/license scans + SBOM unbuilt — deferred, ADR-0007), and AC-014 text corrected to
public/anonymous (DEC-010). Disclosed residuals carried into the release: AC-016 Partial (egress
secret-redactor deferred, RISK-007 / ADR-0007 containment), AC-007 Not-met (premise superseded — re-fetch
recovery is the delivered behavior), Telegram gateway **beta** (UX defects → post-MVP fork, ADR-0008 /
deferred #9). Watch: upstream v1→v2 migration (RISK-001) on future syncs.

## Decisions since last report
Releases **public/anonymous** (DEC-010); **minisign** signing; **ship-under-containment** (ADR-0007). Logo →
**red-orange flame + shadowed "marid" wordmark** (operator directive 2026-07-08; amends branding.md 2-color
spec). First RC → **`v0.1.0`** on an independent `0.x` line (package.json stays upstream `1.17.15`; the
release↔upstream mapping is the baseline SHA per sync).

## Upcoming
Gate-14 accepted (2026-07-09) — MS-006 formally closed. **Post-MVP channels package (Proposed, awaiting operator
gate):** **PH-6 (expanded 2026-07-10, all-in-one)** = **Marid Gateway** (marid-auth as a component, ADR-0011) +
**full Telegram experience** (fix-in-place, ADR-0009) + **full bidirectional cross-client mirroring**
(explicit-attach, ADR-0012) + **four-tier real-client test strategy** (ADR-0013); DEC-014/017/018/019. **PH-7
WhatsApp** = unofficial client behind pinned WAHA (ADR-0010 / DEC-015/016). All **Proposed — awaiting operator gate**
before any code; mirroring verified **additive** (`event-filter.ts`), INV-001-safe (view-via-binding/act-via-
ownership). Remaining backlog: egress secret-redactor (ADR-0007 / AC-016), AC-007 formal supersede, stats
mechanism (deferred #10), upstream sync cadence.
