---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# Assumption Register (ASM-)

Explicit assumptions with risk-if-wrong. These are **not requirements**; each is revisited when its
trigger fires.

| ID | Assumption | Risk if wrong | Trigger to revisit | Status |
|---|---|---|---|---|
| ASM-001 | The fork baseline will be the current `dev` HEAD of anomalyco/opencode (eb3476660, 2026-07-03) or a nearby tag chosen at the forking gate | Analysis drift if baseline moves far before fork approval; re-validate component inventory | Forking gate (gate 11) | Draft |
| ASM-002 | The local working tree's untracked files (docs/brief.md, docs/diagrams/, CLAUDE.md, .claude/) are user-authored planning inputs to preserve, not product code | If any are generated/transient, import plan changes | Gate 12 (import of local changes) | Draft |
| ASM-003 | Shaheen access will remain available for the §15 analysis window | §15 comparison becomes blocked; must be recorded per brief | When Phase B research starts | Draft |
| ASM-004 | The single maintainer is the user (solo project); review rules in Git Flow are adapted accordingly (e.g., self-review + CI gates instead of second-human review) | If a team exists, branch/review rules and identity model change | Clarified at scope gate or later | Draft |
| ASM-005 | No hard deadline or budget cap; research depth sized by risk, roadmap phased by dependency order rather than dates | Over-invested research; roadmap re-cut needed | OQ-006 answered | Draft |
| ASM-006 | Proposed NFR thresholds marked ⊕ in non-functional.md are placeholders to be tuned at gate 5, not commitments | Thresholds treated as binding too early → wrong architecture trade-offs | Gate 5 (architecture) | Draft |
| ASM-007 | The 19 docs/diagrams reflect a recent but possibly stale view of the codebase; each will be validated against source before being cited as evidence | Decisions based on stale diagrams | Current-state analysis (gate 4) | Draft |
