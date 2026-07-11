---
status: Draft
version: 0.1.0
updated: 2026-07-11
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
| AC-001 | Instance add/start → own tree + health | Met | MS-003 (PR #17): `marid instance add/start`, allocated port, 0700 tree, health-gated; 3-OS `marid-isolation` green | PH-2 |
| AC-002 | Two instances concurrent → no cross-write | Met | MS-003: live 2-instance diff `instance-isolation.test.ts` — distinct ports, per-instance DB/sessions, no escape from composed XDG roots | PH-2 · NFR-008 |
| AC-003 | No token → 401 + audit | Met | MS-002 (PR #13): `@marid/auth` 401 unauthenticated; audit JSONL line written | PH-1 |
| AC-004 | client-scope crosses session/admin → 403 + audit | Met | MS-002 + DEC-011 durable ownership; 403 on non-owned session / admin route; client event/list isolation (PR #15) | PH-1 |
| AC-005 | Over rate limit → 429 + SSE cap | Met | MS-002: token-bucket 10/s burst 30, SSE cap 4, 429 + retry-after | PH-1 |
| AC-006 | SDK-created session visible + live in TUI/subscriber | Met | MS-004 (PR #19): §7 KPI-001 E2E — 2nd client discovers+continues, subscriber sees both | PH-3 · KPI-001 |
| AC-007 | Reconnect with `?after=<seq>` replays missed events exactly once | Not-met | Premise invalid: contract v1.1 (PH-3) corrected the `?after=` per-session replay claim — the v1 firehose is live-only. Recovery is authoritative-store re-fetch, verified under AC-008 | Criterion superseded by the v1.1 correction; see [deferred-work-register](../execution/deferred-work-register.md) |
| AC-008 | Kill + restart mid-prompt → history intact, usable | Met | MS-004: kill+restart E2E — reconnecting client re-fetches authoritative history written before restart, no state loss | PH-3 · replaces AC-007's replay premise |
| AC-009 | Two simultaneous prompts → documented queue/steer, no corruption | Met | MS-004: concurrency E2E through the authed wrapper (join/steer, one Runner, no corruption); contract v1.1 Concurrency section | PH-3 · EXP-001 |
| AC-010 | Non-allowlisted Telegram user → ignored + logged | Met | MS-005 (PR #23): allowlist + `update_id` dedup; stranger ignored + logged, proven live in the 3-OS `marid-telegram` TEST-TG job | PH-4 · FR-050 |
| AC-011 | Allowlisted ask → progressive edits, 4096-split, complete | Met | MS-005 (PR #23): HTML/4096-split edit-coalesced streaming (EXP-003 cadence); progressive edits + complete reply proven live in the 3-OS `marid-telegram` TEST-TG job | PH-4 · KPI-002 |
| AC-012 | Policy-denied tool → inline-keyboard permission; deny blocks | Met | MS-005 (PR #23): permission round trip proven via faked-SDK integration test (event→keyboard→Deny→`permission.respond(reject)`) + `parseAskEvent` schema lock + `permission.test` (claim/timeout/races) + marid-auth `channel-binding`/`scope` (INV-001: channel token cannot reach /shell or /command, cannot escape its bound agent). The live LLM-tool→permission link is unreachable in-harness (the opencode HTTP-served run resolves zero tools — a harness limit, not a gateway/provider defect) | PH-4 · INV-001 |
| AC-013 | `marid` profile build → excluded surfaces absent + hygiene grep | Met | MS-002: additive `src/marid.ts` + `script/marid-build.ts`; 3-OS `marid-build` green; hygiene grep passes | PH-1 · ADR-0002 |
| AC-014 | Tagged release → public signed binaries+checksums, 3-OS install (DEC-010: public/anonymous) | Met | **Public `v0.1.0` release cut (2026-07-09)** on `main` merge `8bf4ab61e`: `marid-release.yml` published 7 targets × (archive + `.sha256` + `.minisig`) = 21 signed/checksummed assets, release not draft/prerelease. **Install-smoke** proves the anonymous download→`minisign -Vm`→`sha256sum -c`→run path on **Linux + Windows** (both green); **macOS** smoke was a matrix filename typo (`.tar.gz`→`.zip`), fixed forward in PR #38 — the darwin `.zip` asset is present + signed like the others. KPI-006: RC (#35→main) 17 checks green. | PH-5 · KPI-006 |
| AC-015 | Upstream sync PR → contract/migration/delta + one real cycle | Met | `marid-sync-upstream.yml` (PR #28) provides the weekly conflict-check + monthly merge PR carrying the delta report, migration-review, and dependency-diff; **one real 91-commit cycle merged via merge-commit (PR #31), `upstream/dev` now an ancestor of develop, ≤1 person-day (KPI-004).** | PH-5 · KPI-004 |
| AC-016 | Secret would appear → redacted | Partial | Corrected by PH-4 audit (2026-07-07). MET slice: the audit stream never carries the bearer (logs the token *name*, no request bodies) and secrets live only in env / sha256-hashed stores — `marid-auth` `audit.test.ts` proves the 0600 append + field shape (NOT redaction); the Telegram **bot-token literal** is masked in gateway logs (`marid-telegram` `redact.test.ts` + `safeLog`). OPEN slice → **PH-5**: no configured-secret-value redactor on channel egress (`stream.ts`), on general logs/errors (no runtime facility), or on session export (`marid export` raw by default). Secret-in-egress is contained in the MVP by the B2/B4 authorization boundary (restricted agent cannot read `auth.json`). Disposition: ADR-0007 (Approved); redactor tracked to PH-5/WBS-5.1. | PH-1 (partial) · PH-5 (redactor) · RISK-007 |
| AC-017 | Telegram remediation parity + INV-001 | Pending | **WBS-6.2 impl done (2026-07-10).** EXP-005 PASS; 4 UX defects fixed in place — MarkdownV2, files both ways, deny-by-default slash whitelist, multi-part separation (marid-telegram 68→89 green, typecheck clean); INV-002/004 held (token URL never logged, filename traversal guard); INV-001 unchanged (acting stays `@marid/auth`-enforced). Live 3-OS `marid-telegram` + real-client E2E = WBS-6.6. On `feat/ph6-marid-gateway` (unmerged). | post-MVP · PH-6 |
| AC-018 | WhatsApp round-trip + INV-001 + outbound-only | Pending | **PH-7, not-started.** Unofficial client per C-9 / R-12 (ADR-0010 Proposed); verified by EXP-006 (fake-WA) + AC-018 tests + PH-7-start live probe | post-MVP · PH-7 |
| AC-019 | Cross-client bidirectional mirroring + view-via-binding/act-via-ownership | Partial | **Blockers cleared — WBS-6.1 slice b delivered the mechanism + operator-reachable attach; the real-account live bidirectional Telegram E2E (which flips this to Met) remains WBS-6.6 (2026-07-11).** Prior (WBS-6.3/6.4): durable `BindingStore` + binding-aware `isVisible` (`owns ∪ bound`) at `/event`; `mirroring.test.ts` proves mirror-in/out, explicit-attach scope, **act-via-ownership** deny (INV-001), degradation (RISK-024); first-responder-wins + permission.asked view proven. **slice b closes it:** (a) operator-reachable **attach** via the admin-gated `POST /marid/attach|/detach` + `GET /marid/bindings` (part 1); (b) the SAME `owns ∪ bound` filter now applied to `/global/event` — the firehose web + TUI + channel all ride — so a bound session's web/TUI turn reaches the channel and an **unattached session stays invisible** (`global-event-filter.test.ts`), while a wrapped-frame picker drops both the regular AND the durable `sync` twin of a non-owned session (INV-001 leak closed); (c) the channel-client lazily builds a streamer for a bound (non-owned) session with no prior `beginTurn`, Telegram rendering it into the operator's `defaultChatId` (`client.test.ts`, `gateway-integration.test.ts`). Real-account 3-OS Telegram bidirectional E2E = WBS-6.6 (`marid-telegram` job); attach-triggered mid-stream reconnect = WBS-6.5. marid-auth 119 / channel-client 11 / marid-telegram 90 green | post-MVP · PH-6 |
| AC-020 | Userbot real-protocol E2E | Pending | **EXP-007 PASS (2026-07-10).** GramJS userbot ↔ real bot round-trip (reply + inline keyboard, button callback, file both ways) on the **real-account / production-DC** path — the test-DC premise is superseded (SMS-login restricted to official apps; runbook Appendix A). Bot side is a stub, so this proves the userbot HARNESS; wiring it against the real gateway (WBS-6.2 fixes) + CI (TEST-TG-E2E, non-gating) = WBS-6.6. | post-MVP · PH-6 |
| AC-021 | Real-app GUI rendering (Telegram Web + Playwright) | Pending | **PH-6, not-started.** ADR-0013 tier 3 (Approved 2026-07-10); verified by EXP-009 + TEST-TG-UI | post-MVP · PH-6 |
| AC-022 | WhatsApp token-bound text permission + act-via-ownership | Pending | **PH-7, not-started.** ADR-0015 (Proposed); verified by fake-WA (EXP-011) + parser unit test | post-MVP · PH-7 |
| AC-023 | WhatsApp fake-WA deterministic gate (round-trip/media/streaming/mirror/permission) | Pending | **PH-7, not-started.** ADR-0014 tier 2 (Proposed); verified by EXP-011 + TEST-WA | post-MVP · PH-7 |
| AC-024 | Gateway blast-radius isolation + degradation + new-endpoint contract | Met | **WBS-6.1 slice b (2026-07-11).** **New-endpoint contract:** admin-gated `POST /marid/attach|/detach` + `GET /marid/bindings` served in the marid-auth wrapper, DOCUMENTED by merging a Marid-owned OpenAPI fragment into the intercepted `GET /doc`; pinned by TEST-CONTRACT (`gateway.test.ts`) **and** a live assertion in the `marid-sync` job (real gzip→strip→merge, `paths['/marid/attach'|'/detach'|'/bindings']`). **Blast-radius isolation:** non-admin token → 403 on the gateway routes (a `channel:` token cannot self-attach — INV-001); the `owns ∪ bound` filter on `/event`+`/global/event` bounds what a token can view. **Degradation:** EXP-008 + `mirroring.test.ts` (registry fault → owns-only, RISK-024). Health = existing `/global/health`. Additive: zero upstream edit, no `P-*` (EXP-014 PASS) | post-MVP · PH-6 |

## Summary

- **14 / 16 Met** (AC-001..006, 008..015), **1 Not-met** (AC-007 — premise superseded),
  **1 Partial** (AC-016 — redactor deferred, ADR-0007). AC-014 met at PH-5 (public `v0.1.0` release,
  KPI-006); AC-015 met at PH-5 (sync cycle #31, KPI-004). MS-006 gates on KPI-004∧005∧006 + accepted
  readiness report (execution gate 14) — **not** "every AC Met" — so the one Partial (AC-016) + one
  Not-met (AC-007) are disclosed residuals, not blockers.
- **Residual honesty:** AC-007 will be formally superseded (re-fetch recovery is the delivered behavior);
  tracked in the [deferred-work register](../execution/deferred-work-register.md).
- **Post-MVP additions (2026-07-09):** **AC-017 (Telegram, PH-6)** and **AC-018 (WhatsApp, PH-7)** are **Pending**
  (not-started; ADR-0009/0010 Proposed, operator-gated). MVP acceptance is unchanged (14/16 Met + 1 Partial +
  1 Not-met); the two new criteria are post-MVP and do not affect the accepted MS-006 verdict.
