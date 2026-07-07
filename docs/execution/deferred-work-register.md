---
status: Approved
version: 1.0.0
updated: 2026-07-06
owner: operator (STK-001)
---

# Deferred-Work / Tech-Debt Register

Durable index of known-not-done and accepted debt (distinct from the forward roadmap). Local `#` ids, no
governed prefix. Severity Low/Med/High. Status Open / In progress / Done / Won't do.

| # | Item | Severity | Invariant / req at stake | Proposed (additive) fix | Acceptance / guard | Status |
|---|---|---|---|---|---|---|
| 1 | AC-007 criterion assumes `?after=<seq>` SSE replay that the v1 firehose does not provide | Med | FR-036 | Supersede AC-007 with a re-fetch-recovery criterion (new `AC-`), pointing to AC-008; keep AC-007 as history | New AC Approved; traceability updated | Open |
| 2 | `POST /permission/:requestID/reply` not ownership-gated (opaque `per_` id) | Low | INV-001, FR-028 | In-pipeline requestID→session map to gate reply by owner | reply-gating test; `GET /permission` already filtered so ids aren't discoverable via API | Open |
| 3 | Cosmetic branding P-2 (README / TUI title / user-agent / logo) deferred | Low | FR-065, DEC-013 | Land in PH-5 (WBS-5.4) alongside README + logo | hygiene grep + visual check | Open |
| 4 | Config defaults P-3 (`lsp:false` etc.) deferred | Low | NFR-002, DEC-013 | Ship distribution config defaults in PH-5 (prefer config file over code) | build smoke; patch-surface stays enumerable | Open |
| 5 | Deferred (Full) requirements FR-037, FR-044, FR-047, FR-058 | Low | scope | Post-MVP; live in [functional](../requirements/functional.md) with triggers; marked `Scope: Full` in the matrix | revisit at their triggers | Open |
| 6 | `deviation-branch-protection` (GitHub Free blocked private branch protection) | Med | INV-003 | Resolved by DEC-010 (repo made public); WBS-5.1 "private releases" premise to reconcile in PH-5 | WBS-5.1 review | In progress |
| 7 | FR-030 in-pipeline trace correlation (request-ID → traces) left for the pipeline | Low | FR-030 | Wrapper does request-ID + audit; deeper trace correlation is an in-pipeline follow-up | correlation test | Open |
