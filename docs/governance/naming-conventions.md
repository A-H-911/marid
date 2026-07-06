---
status: Approved
version: 1.0.0
updated: 2026-07-06
owner: operator (STK-001)
---

# Naming Conventions

Identifier scheme for this package (Keystone governance + Marid-specific additions). Stable prefix +
zero-padded number; unique within the package; never reused.

| Entity | ID format | Lives in |
|---|---|---|
| Functional requirement | `FR-NNN` | requirements/functional.md |
| Non-functional requirement | `NFR-NNN` | requirements/non-functional.md |
| Constraint | `CON-NNN` | requirements/constraint-register.md |
| Invariant | `INV-NNN` | requirements/invariant-register.md |
| Dependency | `DEP-NNN` | requirements/dependency-register.md |
| Assumption | `ASM-NNN` | decisions/assumption-register.md |
| Open question | `OQ-NNN` | decisions/open-question-register.md |
| Decision | `DEC-NNN` | decisions/open-decision-register.md |
| Architecture Decision Record | `ADR-NNNN` | adrs/ |
| Risk | `RISK-NNN` | risks/risk-register.md |
| Hypothesis | `HYP-NNN` | research/hypothesis-register.md |
| Experiment | `EXP-NNN` | experiments/ |
| Comparison | `C-N` | architecture/technology-comparison.md |
| Success metric / KPI | `KPI-NNN` | 00-charter.md |
| Stakeholder | `STK-NNN` | 00-charter.md |
| Phase | `PH-N` | planning/roadmap.md |
| Milestone | `MS-NNN` | planning/milestones.md |
| Work item | `WBS-N.N[.N]` | planning/work-breakdown.md |
| Acceptance criterion | `AC-NNN` | validation/acceptance-criteria.md |
| Test family | `TEST-<NAME>` | validation/test-strategy.md |

## Marid-specific (not Keystone-governed)

| Entity | ID format | Meaning |
|---|---|---|
| Patch-surface item | `P-*` (P-2, P-3, P-CI-N, P-ENTRY) | An enumerated upstream-file edit or Marid-owned CI/config surface — see [architecture](../architecture/architecture.md) |
| Research track | `R-NN` | Planning-phase research track (research/) |
| Tension | `T-N` | Stage-6 contradiction log (open-decision-register) |

## Files & directories
kebab-case, ASCII, no spaces. Ordered narrative docs `NN-topic.md`; registers `<thing>-register.md`; ADRs
`adr-NNNN-short-title.md`. One entity family per register; one ADR per file.
