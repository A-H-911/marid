---
status: Draft
version: 0.1.0
updated: 2026-07-09
owner: operator (STK-001)
generation: derived
---

# Acceptance Audit (verdict × evidence per AC-)

**Derived — regenerated at every phase gate.** The execution agent's during/after close-out of
[acceptance-criteria](acceptance-criteria.md): each `AC-` carries a verdict `Met | Partial | Not-met |
Pending` with evidence. Distinct from the planner's pre-handoff readiness report. Gate **G-PROGRESS**
checks that every `AC-` is represented here. Reflects real state through **PH-5 (MS-006, 2026-07-09)**:
the public `v0.1.0` release closed AC-014; AC-015 closed at the sync cycle (#31).

| AC | Criterion (short) | Verdict | Evidence | Notes |
|---|---|---|---|---|
| [AC-001](acceptance-criteria.md) | Instance add/start → own tree + health | Met | MS-003 (PR #17): `marid instance add/start`, allocated port, 0700 tree, health-gated; 3-OS `marid-isolation` green | PH-2 |
| [AC-002](acceptance-criteria.md) | Two instances concurrent → no cross-write | Met | MS-003: live 2-instance diff `instance-isolation.test.ts` — distinct ports, per-instance DB/sessions, no escape from composed XDG roots | PH-2 · NFR-008 |
| [AC-003](acceptance-criteria.md) | No token → 401 + audit | Met | MS-002 (PR #13): `@marid/auth` 401 unauthenticated; audit JSONL line written | PH-1 |
| [AC-004](acceptance-criteria.md) | client-scope crosses session/admin → 403 + audit | Met | MS-002 + DEC-011 durable ownership; 403 on non-owned session / admin route; client event/list isolation (PR #15) | PH-1 |
| [AC-005](acceptance-criteria.md) | Over rate limit → 429 + SSE cap | Met | MS-002: token-bucket 10/s burst 30, SSE cap 4, 429 + retry-after | PH-1 |
| [AC-006](acceptance-criteria.md) | SDK-created session visible + live in TUI/subscriber | Met | MS-004 (PR #19): §7 KPI-001 E2E — 2nd client discovers+continues, subscriber sees both | PH-3 · KPI-001 |
| [AC-007](acceptance-criteria.md) | Reconnect with `?after=<seq>` replays missed events exactly once | Not-met | Premise invalid: contract v1.1 (PH-3) corrected the `?after=` per-session replay claim — the v1 firehose is live-only. Recovery is authoritative-store re-fetch, verified under AC-008 | Criterion superseded by the v1.1 correction; see [deferred-work-register](../execution/deferred-work-register.md) |
| [AC-008](acceptance-criteria.md) | Kill + restart mid-prompt → history intact, usable | Met | MS-004: kill+restart E2E — reconnecting client re-fetches authoritative history written before restart, no state loss | PH-3 · replaces AC-007's replay premise |
| [AC-009](acceptance-criteria.md) | Two simultaneous prompts → documented queue/steer, no corruption | Met | MS-004: concurrency E2E through the authed wrapper (join/steer, one Runner, no corruption); contract v1.1 Concurrency section | PH-3 · EXP-001 |
| [AC-010](acceptance-criteria.md) | Non-allowlisted Telegram user → ignored + logged | Met | MS-005 (PR #23): allowlist + `update_id` dedup; stranger ignored + logged, proven live in the 3-OS `marid-telegram` TEST-TG job | PH-4 · FR-050 |
| [AC-011](acceptance-criteria.md) | Allowlisted ask → progressive edits, 4096-split, complete | Met | MS-005 (PR #23): HTML/4096-split edit-coalesced streaming (EXP-003 cadence); progressive edits + complete reply proven live in the 3-OS `marid-telegram` TEST-TG job | PH-4 · KPI-002 |
| [AC-012](acceptance-criteria.md) | Policy-denied tool → inline-keyboard permission; deny blocks | Met | MS-005 (PR #23): permission round trip proven via faked-SDK integration test (event→keyboard→Deny→`permission.respond(reject)`) + `parseAskEvent` schema lock + `permission.test` (claim/timeout/races) + marid-auth `channel-binding`/`scope` (INV-001: channel token cannot reach /shell or /command, cannot escape its bound agent). The live LLM-tool→permission link is unreachable in-harness (the opencode HTTP-served run resolves zero tools — a harness limit, not a gateway/provider defect) | PH-4 · INV-001 |
| [AC-013](acceptance-criteria.md) | `marid` profile build → excluded surfaces absent + hygiene grep | Met | MS-002: additive `src/marid.ts` + `script/marid-build.ts`; 3-OS `marid-build` green; hygiene grep passes | PH-1 · ADR-0002 |
| [AC-014](acceptance-criteria.md) | Tagged release → public signed binaries+checksums, 3-OS install (DEC-010: public/anonymous) | Met | **Public `v0.1.0` release cut (2026-07-09)** on `main` merge `8bf4ab61e`: `marid-release.yml` published 7 targets × (archive + `.sha256` + `.minisig`) = 21 signed/checksummed assets, release not draft/prerelease. **Install-smoke** proves the anonymous download→`minisign -Vm`→`sha256sum -c`→run path on **Linux + Windows** (both green); **macOS** smoke was a matrix filename typo (`.tar.gz`→`.zip`), fixed forward in PR #38 — the darwin `.zip` asset is present + signed like the others. KPI-006: RC (#35→main) 17 checks green. | PH-5 · KPI-006 |
| [AC-015](acceptance-criteria.md) | Upstream sync PR → contract/migration/delta + one real cycle | Met | `marid-sync-upstream.yml` (PR #28) provides the weekly conflict-check + monthly merge PR carrying the delta report, migration-review, and dependency-diff; **one real 91-commit cycle merged via merge-commit (PR #31), `upstream/dev` now an ancestor of develop, ≤1 person-day (KPI-004).** | PH-5 · KPI-004 |
| [AC-016](acceptance-criteria.md) | Secret would appear → redacted | Partial | Corrected by PH-4 audit (2026-07-07). MET slice: the audit stream never carries the bearer (logs the token *name*, no request bodies) and secrets live only in env / sha256-hashed stores — `marid-auth` `audit.test.ts` proves the 0600 append + field shape (NOT redaction); the Telegram **bot-token literal** is masked in gateway logs (`marid-telegram` `redact.test.ts` + `safeLog`). OPEN slice → **PH-5**: no configured-secret-value redactor on channel egress (`stream.ts`), on general logs/errors (no runtime facility), or on session export (`marid export` raw by default). Secret-in-egress is contained in the MVP by the B2/B4 authorization boundary (restricted agent cannot read `auth.json`). Disposition: ADR-0007 (Approved); redactor tracked to PH-5/WBS-5.1. | PH-1 (partial) · PH-5 (redactor) · RISK-007 |

## Summary

- **14 / 16 Met** (AC-001..006, 008..015), **1 Not-met** (AC-007 — premise superseded),
  **1 Partial** (AC-016 — redactor deferred, ADR-0007). AC-014 met at PH-5 (public `v0.1.0` release,
  KPI-006); AC-015 met at PH-5 (sync cycle #31, KPI-004). MS-006 gates on KPI-004∧005∧006 + accepted
  readiness report (execution gate 14) — **not** "every AC Met" — so the one Partial (AC-016) + one
  Not-met (AC-007) are disclosed residuals, not blockers.
- **Residual honesty:** AC-007 will be formally superseded (re-fetch recovery is the delivered behavior);
  tracked in the [deferred-work register](../execution/deferred-work-register.md).
