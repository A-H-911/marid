---
status: Accepted (gate 13, 2026-07-03)
version: v1.0
updated: 2026-07-03
owner: operator (STK-001)
---

# Follow-up Prompts (one per phase gate + situational)

Paste the matching prompt when the prior phase's exit criteria are met and the operator has approved
continuing. Each assumes a fresh session: the agent must re-read the files it names.

## PH-0 → start (after gate-11 and gate-12 approvals)

> Gate 11 and 12 are approved. Execute `docs/planning/roadmap.md` WBS-0.1..0.3 exactly as approved in
> `docs/handoff/gate-11-forking-checklist.md` (INV-003: only the approved actions). Then run the four
> experiments WBS-0.4..0.7 per `docs/research/hypothesis-register.md`, writing each report to
> `docs/research/experiments/exp-00N-report.md` with PASS/FAIL against the stated criteria. If any FAIL,
> record the pre-selected fallback as a new DEC in `docs/decisions/open-decision-register.md` (status
> Proposed) and stop for operator review. Exit: MS-001 evidence summarized in a short status note.

## PH-1 → start

> EXP reports are accepted (MS-001). Build PH-1 per `docs/planning/roadmap.md` WBS-1.1..1.5, honoring
> `docs/architecture/api-event-contract.md` (Approved) exactly — tokens, scopes, 429s, audit lines,
> request-IDs. marid-auth attaches via the seam answered by EXP-004; update the patch-surface register in
> `docs/architecture/architecture.md` if P-1 changed. TDD; TEST-AUTH + TEST-CONTRACT green on 3 OSes.
> Exit: MS-002 — an authenticated `marid` binary from the profile build passes contract tests.

## PH-2 → start

> Build marid-instance per WBS-2.1..2.3 and ADR-0006. The isolation suite must cover every row of the
> R-05 conflict inventory (`docs/architecture/current-state/05-config-observability-lifecycle-packaging.md`)
> plus anything EXP-002 added. Exit: MS-003 = KPI-003 green in CI on 3 OSes.

## PH-3 → start

> Build PH-3 per WBS-3.1..3.3 and ADR-0004. The §7 example flow (charter KPI-001) is the acceptance
> demo: script it as an E2E test (TEST-SYNC). Document the concurrency semantics EXP-001 established in
> `docs/architecture/api-event-contract.md` (bump version, additive). Exit: MS-004.

## PH-4 → start

> Build marid-telegram per WBS-4.1..4.5, ADR-0005, and `docs/research/findings/telegram-channel-research.md`
> constants (long polling, cadence from EXP-003, HTML mode, 4096 split). INV-001 is absolute: run the
> policy-denial tests (AC-010/012) before the happy path. Exit: MS-005 = KPI-002 demonstrated.

## PH-5 → start

> Finish per WBS-5.1..5.5: private release pipeline, gh-authenticated install path, the first real
> upstream sync cycle (KPI-004; follow `docs/architecture/upstream-sync-strategy.md` verbatim), README +
> logo per `docs/branding/branding.md`, then regenerate `docs/traceability-matrix.md` and assemble
> readiness evidence for the operator's MVP go/no-go. Exit: MS-006.

## Situational

- **Fresh-session refresher:** "Read docs/01-executive-summary.md, docs/planning/roadmap.md, and
  docs/keystone-state.json; state which WBS item is in progress and its DoD before touching anything."
- **Invariant audit:** "Audit the last N PRs against docs/requirements/invariant-register.md; report any
  violation with file:line and a remediation PR plan. Change nothing without approval."
- **Deviation:** "Reality contradicts an approved artifact. Write docs/decisions/deviation-<topic>.md:
  what the plan says, what you found (evidence), options, recommendation — status Proposed. Stop."
- **Bug triage:** "Reproduce as a failing test first (TEST family per docs/validation/test-strategy.md);
  root-cause in the shared path, not the symptom site; fix; keep the regression test."
- **Status report:** "Summarize phase progress vs milestones/KPIs in ≤ 20 lines, update
  docs/keystone-state.json notes, list blockers needing operator decisions."
