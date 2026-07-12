---
status: Approved
version: 1.0.0
updated: 2026-07-12
owner: operator (STK-001)
generation: derived
---

# Status Report

**Derived — regenerated each update cycle.** Point-in-time health snapshot. History is in the
[progress log](progress-log.md); the closing loop is the [acceptance audit](../validation/acceptance-audit.md).

## At a glance

| | |
|---|---|
| Reporting date | 2026-07-12 |
| Current phase | **PH-6 (Telegram-first) DONE — MS-007 MET (2026-07-12, PR #48 squash `4409d92f`, all 20 CI green).** The full PH-6 stack is merged to `develop`: **WBS-6.1** (Marid Gateway + `@marid/channel-client` + attach endpoint + `owns ∪ bound` `/global/event` fine-filter), **6.2** (full Telegram experience — markdown/files/slash/inline-kbd, marid-telegram 68→99 green), **6.3** (durable `BindingStore` + binding-aware `isVisible`), **6.4** (cross-surface permission: first-responder-wins, view-via-binding/act-via-ownership), **6.5** (SSE reconnect + backoff + re-fetch recovery + attach-triggered re-subscribe), **6.6** (four live test tiers), **6.7** (docs: contract **v1.2** + architecture **v1.1** + Tarseem `20-gateway-mirroring` + `docs/usage.md` user guide). **All MS-007 ACs Met** (AC-017/019/020/021/024); EXP-005/007/008/009 PASS. **🔒 INV-001 firehose isolation leak found via the live tier & FIXED** — ADR-0016 (route-based `isStream`) + ADR-0017 (lazy own-session visibility); zero upstream edit, no P-\*. Native-mobile EXP-010 **deferred** (never an MS-007 gate). |
| Overall status | **MVP COMPLETE (gate 14, 2026-07-09) + PH-6 (Telegram-first) COMPLETE (MS-007, 2026-07-12).** Public `v0.1.0` released; KPI-004∧005∧006 green; docs `validate = OK`. PH-6 fully merged to `develop` (PR #48 `4409d92f`) — AC-017/019/020/021/024 all Met. |
| Last milestone met | **MS-007 (2026-07-12)** — PH-6 Telegram-first: gateway + full experience + bidirectional mirroring + live test tiers (PR #48, squash `4409d92f`, all 20 CI green) |
| Next milestone | **MS-008 (PH-7 WhatsApp)** — **not started; operator-gated** (ADR-0010 / DEC-015/016 Proposed). AC-018 + EXP-006 PASS (fake-WA) then a PH-7-start live probe. PH-6-independent. |

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
**Nothing in active execution.** PH-0..6 complete; PH-7 (WhatsApp) is operator-gated and not started. The full
PH-6 (Telegram-first) stack is merged to `develop` (see the Phase progress table and the
[progress log](progress-log.md)) — Marid Gateway + `@marid/channel-client`, full Telegram experience, bidirectional
cross-surface mirroring, SSE reconnect/re-fetch recovery, four live test tiers, and the PH-6 docs/diagrams. All
MS-007 acceptance criteria (AC-017/019/020/021/024) Met; INV-001 firehose leak found via the live tier & fixed
(ADR-0016/0017). Native-mobile EXP-010 deferred (never an MS-007 gate).

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
MS-007 met (2026-07-12) — PH-6 (Telegram-first) formally closed. **Next candidate phase, operator-gated:** **PH-7
WhatsApp** = new `@marid/whatsapp` unofficial client behind pinned WAHA, separate process, `channel:` token (ADR-0010
/ DEC-015/016) — **Proposed, awaiting operator gate** before any code; MS-008 = AC-018 + EXP-006 PASS (fake-WA) then a
PH-7-start live probe. Optional near-term: a `develop → main` sync PR (merge-commit) to fold PH-6 into a release.
Remaining backlog: egress secret-redactor (ADR-0007 / AC-016), AC-007 formal supersede, stats mechanism
(deferred #10), upstream sync cadence.
