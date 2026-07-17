---
status: Approved
version: 1.0.0
updated: 2026-07-06
owner: operator (STK-001)
---

# Governance

How this package is identified, versioned, and changed. Identifiers: [naming-conventions](naming-conventions.md).

## Lifecycle statuses
`Draft → Proposed → Approved → Implemented`, with `Rejected` / `Deferred` / `Superseded → Obsolete` branches.
Decision statuses are exactly **Proposed / Approved / Rejected / Superseded / Deferred**. Only Approved items
constrain execution — a Proposed decision is never rendered as Approved (core safeguard). Sole approver is the
operator (STK-001) at all gates (INV-005).

## Versioning
- Package version: semver; this package is at **2.0.0** (breaking restructure to Keystone v1.0.0 layout +
  state schema; migration note in [README](../README.md)). `keystone-state.json` / `manifest.json` carry
  `schema_version` / `skill_version` = 1.0.0 separately.
- Each document carries front-matter `status` / `version` / `updated`, bumped on material change.
- **Immutable after approval:** ADRs and approved acceptance criteria — change by superseding, never by
  rewriting meaning (typo/format fixes allowed). **Derived** artifacts (traceability matrix, status report,
  acceptance audit, readiness report) are regenerated, never hand-edited.

## Cross-references
Reference entities by ID in prose; typed links (`derives_from`, `mitigates`, `verifies`, `supersedes`) where
a row exists because of another. Every MVP `FR-`/`NFR-` reaches ≥1 decision, task, and test in the
traceability matrix (gate G-TRACE). Superseding creates a new ID and sets `superseded_by`/`supersedes` on both.

## Change discipline
Docs are the source of truth; code follows docs. Update the state trackers (progress-log, status-report,
acceptance audit, `keystone-state.json`) in the same change that lands the work. Validate with
`scripts/validate_package.py` (bundled with the Keystone skill, **≥ 1.0.0**) before any PR. The version
floor is load-bearing: the acceptance audit's `AC-` cells are **bare ids** (`| AC-001 |`, not a markdown
link), which 1.0.0's `audit_view` carve-out reads as *references*. Against **0.1.0** the same file reports
31 bogus `duplicate definition … within family 'validation'` findings, and 0.1.0 has no `G-PROGRESS` gate at
all — so a green 0.1.0 run is not evidence. Do not "fix" the audit by re-linking those cells: that is what
broke `G-PROGRESS` before (see [progress-log](../progress/progress-log.md), 2026-07-17).
