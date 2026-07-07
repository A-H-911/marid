---
status: Approved
version: 1.0.0
updated: 2026-07-07
owner: operator (STK-001)
---

# Progress Log

Append-only, newest first. Each entry: **Done / Decisions / Deviations / Blockers / Next.** Machine mirror
lives in `keystone-state.json` `progress[]`. Volatile "where are we now" is the
[status report](status-report.md).

## 2026-07-07 — PH-4 security threat-model audit (B1–B8) + corrective doc reconciliation
- **Done:** Full audit against `security-threat-model.md` — every B1–B8 mitigation verified against code and
  tests; ran all three Marid suites (**marid-telegram 58 / marid-auth 72 / marid-instance 40 = 170 pass, 0
  fail**); TEST-SEC injection-containment probes (`channel-binding.test.ts`: escape-agent / widen-tools /
  widen-permission / `/shell` / `/command` / no-agent / unbound-agent) all fail closed (403, `delegated=false`);
  AC-012 permission round trip confirmed. **Finding:** the B7 "redaction filters on channel egress" control is
  claimed but not implemented — only the Telegram bot-token literal is masked (gateway logs); channel egress,
  general logs/errors, and `marid export` (raw by default) have no configured-secret-value redactor; AC-016's
  cited evidence (`audit.test.ts`) tests 0600 + field shape, not redaction. Secret-in-egress is contained by the
  B2/B4 authorization boundary (restricted agent can't read `auth.json`). B5 supply-chain controls (plugin
  allowlist, provider pinning, FR-064 scanning) are unbuilt PH-5 work.
- **Corrective changes (operator-approved scope "docs + cheap guards"):** threat model → v1.1 (B7 + residual
  corrected to fact, status stays Approved — defect fix); **AC-016 verdict Met → Partial** + evidence fixed
  (13 → **12 / 16 Met**, +1 Partial); RISK-007 / RISK-004 mitigation text corrected (flagged for operator
  re-score); **ADR-0007 (Proposed)** records containment-first MVP posture + redactor deferred to PH-5;
  **code guard:** explicit `--hostname 127.0.0.1` loopback bind in `marid-instance` `serveLaunch()` (B3 drift
  guard; `MARID_BIND_HOST` override + warning preserves the documented non-loopback path); **P-4 reserved**
  (deferred `export` default-flip).
- **Decisions:** containment-not-redaction is **Proposed** (ADR-0007), not settled — awaits operator approval.
  **Open sub-decision:** `marid export` raw-default fix — (a) global default-flip [P-4, upstream edit], (b)
  provenance-aware, (c) *interim* doc guardrail + defer to PH-5 (chosen pending confirmation). **Deviations:**
  none (audit-only + doc/guard; no upstream code edited; no merge). **Blockers:** operator to (1) approve
  ADR-0007, (2) pick the export option. **Next:** PH-5 (redactor + B5 controls), or operator direction.

## 2026-07-07 — MS-005 MET (PH-4 Telegram complete)
- **Done:** 3-OS `marid-telegram` green on PR #23 (all 20 checks incl. TEST-TG on ubuntu/macOS/windows) —
  KPI-002. Telegram round trip (AC-010 stranger-ignored, AC-011 streamed reply) proven live; policy-denial
  path (AC-012) proven via the faked-SDK permission round trip + marid-auth INV-001 backstop. Merged
  develop@81ba7e7 (squash). AC-010/011/012 flip to Met → **13 / 16 MVP ACs Met**.
- **Decisions:** (recap of this session's, now shipped) INV-001 = by-construction backstop in `@marid/auth`
  (channel scope deny-by-default on owned-session sub-routes + token-bound-agent guard), not gateway
  convention; hand-rolled Bot API client (no telegram-library dep, RISK-004); full media send + receive.
- **Deviations:** AC-012's LLM-tool→permission link is an opencode harness limit — the HTTP-served run
  resolves zero tools (not a provider or gateway defect), so the permission ROUND TRIP is proven via a
  faked-SDK integration test (event→keyboard→Deny→`permission.respond(reject)`) rather than a live model call.
- **Blockers:** operator to add `marid-telegram` ×3 to required checks (14→17). **Next:** PH-5 (Release &
  sync, MS-006 = MVP).

## 2026-07-06 — PH-4 Telegram built (WBS-4.1..4.5)
- **Done:** new additive `@marid/telegram` pkg (ADR-0005, zero runtime deps, type-only SDK) — long-poll
  ingress + allowlist + `update_id` dedup (AC-010), HTML/4096-split streaming with EXP-003 cadence + 429
  (AC-011), permission inline-keyboard flow (race-safe exactly-once), policy, full media, `marid telegram
  start` CLI. Plus the `@marid/auth` **INV-001 by-construction backstop** (WBS-4.4): channel scope is now
  deny-by-default on owned-session sub-routes (closes a verified hole — `channel:` == `client` could reach
  `/session/:id/shell`), and a token-bound-agent body guard rejects any channel prompt that selects a
  different agent or widens tools. 169 unit tests (auth 72, instance 40, telegram 58) + live TEST-TG
  (AC-010/011) vs a real `marid serve` + fake LLM + local fake Telegram; new 3-OS `marid-telegram` CI job.
- **Decisions:** (operator, this session) INV-001 = by-construction backstop (not gateway convention);
  hand-rolled Bot API client (no telegram-library dep, RISK-004); full media send+receive. Client
  `messageID` dropped from prompts (server ids are timestamp-ordered — a fabricated one corrupts history;
  idempotency is the update_id dedup store).
- **Deviations:** AC-012's LLM-tool→permission link is NOT driven live — the opencode HTTP-served run
  resolves **zero tools** (verified: fake LLM called, calls=1/misses=0, request carries no `tools` field,
  for the build agent AND a `tools:{bash:true}` agent; internal `prompt.loop()` has tools, served
  `promptAsync` does not). Not a provider or gateway issue. The gateway's permission ROUND TRIP
  (event→keyboard→Deny→`permission.respond(reject)`) is instead proven end-to-end via a faked-SDK
  integration test emitting a schema-shaped `permission.asked`; `parseAskEvent` locks the field names
  (id/sessionID/permission — a review caught the gateway reading a non-existent `title`).
- **Blockers:** operator to add `marid-telegram` ×3 to required checks (14→17). **Next:** open the PH-4 PR;
  on 3-OS green + merge, flip MS-005 (separate trackers PR).

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
