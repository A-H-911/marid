---
status: Approved
version: 1.0.0
updated: 2026-07-06
owner: operator (STK-001)
---

# Definition of Done

A work item (WBS- leaf) is **DONE** when all hold:

- Its acceptance criteria (`AC-`) pass, with evidence recorded in the [acceptance audit](../validation/acceptance-audit.md).
- Its `TEST-` items are green in CI on all required OSes (no phase starts or ships with red CI).
- No invariant (`INV-001..008`) is violated; any unavoidable violation is a new `ADR-` (status Proposed) with a STOP for approval.
- Relevant NFR thresholds hold (e.g. NFR-001 patch-surface stays enumerable; NFR-008 isolation).
- Any direct upstream-file edit is registered as a `P-*` row in [architecture](../architecture/architecture.md) (preference: new package → config → CI → last-resort edit).
- Traceability updated: the item appears in [traceability-matrix](../validation/traceability-matrix.md) linking decision/test.
- Trackers updated in the same change: [progress-log](../progress/progress-log.md), [status-report](../progress/status-report.md), acceptance audit, and `keystone-state.json`.
- Change merged into `develop` via squash PR with all required checks green (14 as of PH-3); merge only on explicit operator instruction (INV-005).

## Phase / milestone DONE

A phase (`PH-`) is done when its milestone (`MS-`) criteria in [milestones](../planning/milestones.md) are met with 3-OS CI evidence, the operator has reviewed at the checkpoint, and the readiness re-check shows no new critical gap.
