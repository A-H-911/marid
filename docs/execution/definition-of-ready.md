---
status: Approved
version: 1.0.0
updated: 2026-07-06
owner: operator (STK-001)
---

# Definition of Ready

A work item (`WBS-` leaf) is **READY** to start when:

- It traces to ≥1 requirement (`FR-`/`NFR-`) in the [traceability matrix](../validation/traceability-matrix.md).
- Its acceptance criteria (`AC-`) exist and are testable ([acceptance-criteria](../validation/acceptance-criteria.md)).
- Its dependencies (`DEP-`, prior `WBS-`/`PH-`) are satisfied; no blocking open question (`OQ-`) remains.
- Every decision it needs (`DEC-`/`ADR-`) is **Approved** (a Proposed decision is not a green light).
- The invariants it touches (`INV-`) are known and its verification (`TEST-` family) is defined.
- It is small enough to complete and review as one bounded step; prerequisites (runtimes, tokens, accounts) are available.

## Phase entry

A phase (`PH-`) is READY when the prior phase's milestone (`MS-`) is MET and the operator has explicitly
approved continuing (paste the phase `→ start` prompt from [follow-up-prompts](../handoff/follow-up-prompts.md)).
Never enter a phase past an unanswered gate.
