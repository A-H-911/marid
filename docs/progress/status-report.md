---
status: Approved
version: 1.0.0
updated: 2026-07-08
owner: operator (STK-001)
generation: derived
---

# Status Report

**Derived — regenerated each update cycle.** Point-in-time health snapshot. History is in the
[progress log](progress-log.md); the closing loop is the [acceptance audit](../validation/acceptance-audit.md).

## At a glance

| | |
|---|---|
| Reporting date | 2026-07-08 |
| Current phase | **PH-5 (Release & sync) in progress** — WBS-5.1 + 5.3 done; 5.4 / 5.2 / 5.5 remaining |
| Overall status | On track — PH-0..4 done; PH-5 release pipeline + one real upstream sync (KPI-004) landed |
| Last milestone met | MS-005 (2026-07-07, PR #23); MS-006 not yet met |
| Next milestone | MS-006 = MVP — KPI-004 ✅ / KPI-005 / KPI-006; readiness report accepted (gate 14) |

## Phase progress

| Phase | Status | Exit criteria met? | Evidence | Notes |
|---|---|---|---|---|
| PH-0 Foundations | done | yes | MS-001 (PR #9) | EXP-001..004 PASS |
| PH-1 Marid layer | done | yes | MS-002 (PR #13) | marid-auth + profile |
| PH-2 Instances | done | yes | MS-003 (PR #17) | 3-OS `marid-isolation` |
| PH-3 Cross-interface | done | yes | MS-004 (PR #19) | 3-OS `marid-sync`; contract v1.1 |
| PH-4 Telegram | done | yes | MS-005 (PR #23) | 3-OS `marid-telegram` green; INV-001 backstop; AC-010/011/012 Met |
| PH-5 Release & sync | **in progress** | partial | WBS-5.1 (PR #27) + WBS-5.3 (PR #28/#31); PRs #27–#31 on develop@`51fb00c6b` | **KPI-004 met** (sync cycle #31). Remaining: 5.4 branding, 5.2 RC + install smoke, 5.5 readiness → gate 14 |

## Acceptance snapshot

MVP: **13 / 16 Met**, **2 Partial** (AC-014 — release pipeline verified, install path + 3-OS smoke pending
WBS-5.2; AC-016 — MVP redaction slice holds, full secret-value redactor deferred, ADR-0007), **1 Not-met**
(AC-007 — premise superseded). AC-015 Met via the one real sync cycle (PR #31, KPI-004). AC-010/011 Met via
the live 3-OS TEST-TG; AC-012 Met via the faked-SDK permission round trip + `parseAskEvent` + `permission.test`
+ marid-auth `channel-binding`. Detail in the [acceptance audit](../validation/acceptance-audit.md).

## Completed since last report
- **WBS-5.1** (PR #27): public release pipeline — `marid-release.yml` + `marid-build.ts --release` (tar/zip +
  `.sha256` + minisign `.minisig`); trust anchor wired; verified end-to-end (run 28892667716; throwaway
  prerelease signed+checksummed, `-Vm`/`-c` validated, deleted).
- **WBS-5.3 / KPI-004** (PR #28 + #31): sync automation + one real 91-commit upstream cycle merged via
  merge-commit; `upstream/dev` now an ancestor of develop. Codemode reconciled (ADR-0002).
- Supporting: #29/#30 telegram CI robustness (P-CI-4 timing scale + live-E2E retry-wrapper); RISK-006 corrected;
  deferred-work #8 (gateway firehose no-reconnect) filed.

## In progress
**WBS-5.4** (README + red-orange-flame logo + P-2 branding + P-3 `lsp:false`) is next, then WBS-5.2 (RC `v0.1.0`
+ install path + 3-OS asset smoke), then WBS-5.5 (readiness).

## Blockers & risks
No active blockers. **Devil's-advocate review (2026-07-08) flagged for WBS-5.5:** FR-064 is a *hollow trace*
(traceability marks it `full`, but the §18 dependency/secret/license scans + SBOM are unbuilt — deferred per
ADR-0007) → re-mark `partial` at readiness; AC-014's text was stale vs DEC-010 (corrected: public/anonymous,
not private/gh-authenticated). Watch: upstream v1→v2 migration (RISK-001) on future syncs; egress
secret-redaction remains deferred (RISK-007 / AC-016 Partial / ADR-0007 containment).

## Decisions since last report
Releases **public/anonymous** (DEC-010); **minisign** signing; **ship-under-containment** (ADR-0007). Logo →
**red-orange flame + shadowed "marid" wordmark** (operator directive 2026-07-08; amends branding.md 2-color
spec). First RC → **`v0.1.0`** on an independent `0.x` line (package.json stays upstream `1.17.15`; the
release↔upstream mapping is the baseline SHA per sync).

## Upcoming
WBS-5.4 → WBS-5.2 (RC `v0.1.0`) → WBS-5.5 (readiness, FR-064 re-mark) → **STOP at gate 14** (MS-006 MVP go/no-go).
