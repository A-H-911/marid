---
status: Approved
version: 1.0.0
updated: 2026-07-06
owner: operator (STK-001)
---

# Progress Log

Append-only, newest first. Each entry: **Done / Decisions / Deviations / Blockers / Next.** Machine mirror
lives in `keystone-state.json` `progress[]`. Volatile "where are we now" is the
[status report](status-report.md).

## 2026-07-06 — Keystone v1.0.0 package migration
- **Done:** re-homed the whole `docs/` package to the Keystone v1.0.0 layout (progress/, execution/,
  governance/, planning split, validation/traceability, architecture/diagrams); rebuilt `keystone-state.json`
  to the new schema; frontmatter → `status/version/updated/owner`; added agent-control surface
  (`AGENTS.md` + `CLAUDE.md` import); mechanical validator green.
- **Decisions:** the three PH-1 sub-decisions (formerly labeled 11a/b/c) promoted to real register rows
  DEC-011 / DEC-012 / DEC-013. No content lost.
- **Deviations:** none. **Blockers:** none.
- **Next:** PH-4 (Telegram, MS-005) remains the next execution phase.

## 2026-07-05 — MS-004 MET (PH-3 Cross-interface complete)
- **Done:** 3-OS `marid-sync` green on PR #19 (first macOS+linux exercise of the cross-interface path);
  KPI-001 demo repeatable. Merged develop@82a92d8943; synced to main@862c7bd6fc; ruleset → 14 required checks.
- **Decisions:** api-event-contract v1.0→v1.1 — added Concurrency section (EXP-001), corrected the `?after=`
  replay claim (firehose is live-only; recovery = authoritative re-fetch). ADR-0004 + EXP-001 carry pointers.
- **Deviations:** interactive SolidTUI not driven headlessly (no repo precedent) — TUI wire role exercised via
  `marid instance attach`. **Blockers:** none.
- **Next:** PH-4 unblocked (needs WBS-1.2 tokens, done).

## 2026-07-05 — PH-3 Cross-interface built (WBS-3.1..3.3)
- **Done:** `marid instance attach <name>` (bearer flows to HTTP + SSE, zero upstream edit); TEST-SYNC live E2E
  (§7 discovery/continue, concurrency, restart-recovery) vs a real authed `marid serve`; new 3-OS `marid-sync`
  CI job. **Decisions:** WBS-3.2 DoD met by authoritative-store re-fetch, not event replay.
- **Deviations:** none. **Blockers:** operator to add `marid-sync` ×3 to required checks (11→14).
- **Next:** open PR #19; on green flip MS-004.

## 2026-07-05 — MS-003 MET (PH-2 Instances complete)
- **Done:** 3-OS `marid-isolation` green on every PR #17 run incl. final all-green ×2; KPI-003. Merged
  develop@6e013b45e; sync main@06b36e4cb; ruleset → 11 checks. Devil's-advocate review closed P-CI-4 residuals
  with two runtime probes. **Decisions:** globalPassThroughEnv delivers OPENCODE_TIMING_SCALE (proven at runtime).
- **Deviations:** none. **Blockers:** none. **Next:** PH-3 and PH-4 unblocked.

## 2026-07-05 — PH-2 Instances built (WBS-2.1..2.3)
- **Done:** new `@marid/instance` pkg (`composeInstanceEnv` = EXP-002 env set; race-free port; PID/port record;
  idempotent start guard; platform-split tree-kill); `MaridInstanceCommand`; 39 unit + live 2-instance diff;
  new 3-OS `marid-isolation` job. ADR-0006 verified live (EXP-002 residual closed).
- **Decisions:** OPENCODE_DB omitted (XDG_DATA_HOME isolates the DB); home not relocated.
- **Deviations:** graceful shutdown POSIX-only (Windows has no catchable SIGTERM). **Blockers:** operator to add
  `marid-isolation` to required checks (8→9). **Next:** open PR #17.

## 2026-07-05 — PH-1 follow-up: strict client-scope event/list isolation RESOLVED
- **Done:** marid-owned `@marid/auth/event-filter.ts` body-filters non-owned frames from `GET /event` and
  entries from `GET /session` + `GET /permission`; zero upstream edit, no new P-*. Advisor-caught fixes:
  invariant pinned across all session families; permission leak class closed; accept-encoding stripped before
  filtered list routes. PR #15 → develop a3524a6f9; sync #16 main e14c232e1.
- **Decisions:** built via option (b). **Deviations:** POST `/permission/:id/reply` reply-gating residual
  (opaque `per_` id) documented, not hidden. **Blockers:** none. **Next:** PH-2 / PH-3.

## 2026-07-04 — MS-002 MET (PH-1 Marid layer complete)
- **Done:** PR #13 merged (11 checks green incl. 3-OS `marid-build`); authenticated `marid` binary passes
  contract tests. New `@marid/auth` (tokens/scopes/rate-limit/audit/request-ID); `marid serve` wrapper on the
  EXP-004 seam (zero server edit); TEST-CONTRACT; additive `src/marid.ts` + `script/marid-build.ts`. 92 tests.
- **Decisions:** DEC-011 durable ownership sidecar; DEC-012 additive marid.ts entry (P-ENTRY); DEC-013 branding
  split (identity now, cosmetic PH-5). **Deviations:** firehose/list altitude follow-up flagged (later resolved).
  **Blockers:** none. **Next:** PH-2 / PH-3 (PH-4 needs tokens, done).

## 2026-07-04 — MS-001 MET (PH-0 Foundations complete)
- **Done:** EXP-001..004 all PASS (no FAIL → no fallbacks); CI skeleton green; fork + baseline tag; branch
  protection. PRs #9 (reports), #10 (P-CI-4). **Decisions:** no marid concurrency layer (EXP-001); instance env
  set = XDG + port + TMP (EXP-002); Telegram ≥2s cadence (EXP-003); P-1 dropped — auth as outer wrapper (EXP-004).
- **Deviations:** two live steps deferred (bun-dependent). **Blockers:** none. **Next:** PH-1 / MS-002.
