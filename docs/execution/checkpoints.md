---
status: Approved
version: 1.0.0
updated: 2026-07-06
owner: operator (STK-001)
---

# Checkpoints (review / approval gates)

Execution is gated: no phase passes without an operator checkpoint (INV-005). Gates are demos, not dates.

| Gate | When | What the operator reviews | Status |
|---|---|---|---|
| Gate 11 | Repo creation | Fork created, remotes wired, baseline tagged, branch protection | passed (PH-0) |
| Gate 12 | Planning import | Planning package imported; nothing committed silently (INV-003) | passed (PH-0) |
| PH-0 exit | MS-001 | EXP-001..004 PASS; CI skeleton green | passed |
| PH-1 exit | MS-002 | Authenticated `marid` binary passes contract tests; 3-OS `marid-build` | passed |
| PH-2 exit | MS-003 | 3-OS `marid-isolation` green (2 consecutive) | passed |
| PH-3 exit | MS-004 | 3-OS `marid-sync` green; concurrency contract v1.1 | passed |
| PH-4 exit | MS-005 | KPI-002 — Telegram round trip + policy-denial paths | passed |
| PH-5 exit | MS-006 | KPI-004/005/006; readiness report accepted | passed (2026-07-09) |
| Gate 14 | Go/no-go | Final readiness — all critical gates green | **passed (ACCEPTED 2026-07-09)** — MVP go; MS-006 met |

## Per-PR checkpoint
Every feature branch → squash PR into `develop`; all required checks green (14 as of PH-3); reviewed against
[review-prompts](../handoff/review-prompts.md) (esp. patch-surface discipline — flag any upstream edit not
registered as a `P-*`). Merge only on explicit operator instruction.
