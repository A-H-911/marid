---
status: Approved
version: 1.0.0
updated: 2026-07-06
owner: operator (STK-001)
---

# Contributing to this package

How a contributor (human or agent) changes the Marid planning package without breaking governance.

## Rules
- **Docs are authoritative.** Change the docs first; code follows. Do not silently diverge state from the
  rendered artifacts — a mismatch is a defect to repair.
- **Respect approvals (INV-005).** Do not flip a `Proposed` item to `Approved`; only the operator approves.
  Never proceed past an unanswered gate.
- **Preserve the unresolved.** Rejected alternatives, open questions, and deferred items stay in their
  registers — never dropped to make the plan look finished.
- **Additive-first.** New capability lives in new packages/files speaking existing interfaces (DEC-009). A
  direct upstream-file edit is a last resort and must be an enumerated `P-*` row.
- **Immutable artifacts:** ADRs and approved acceptance criteria — supersede, don't rewrite.

## Workflow for a change
1. Edit the owning register/artifact; bump its `version` / `updated`.
2. Re-derive dependents (traceability matrix, status report, acceptance audit) and `keystone-state.json`.
3. Run the mechanical gates: `python <keystone>/scripts/validate_package.py docs/` → must be `RESULT: OK`
   (Keystone **≥ 1.0.0**; 0.1.0 has no `G-PROGRESS` gate and misreads the audit's bare `AC-` ids).
4. Update [progress-log](../progress/progress-log.md) + [status-report](../progress/status-report.md).
5. Open a squash PR into `develop`; all required checks green; merge only on explicit operator instruction.

## Where things live
Reading order and the full map are in the [package README](../README.md) and
[AGENTS.md](../AGENTS.md) (the standing agent-control surface).
