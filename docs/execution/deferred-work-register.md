---
status: Approved
version: 1.1.0
updated: 2026-07-09
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
| 8 | Telegram gateway firehose `pump` has **no reconnection** (`packages/marid-telegram/src/gateway.ts:181-189`) — one SSE drop stalls the reply path permanently; contradicts RISK-006's stated "reconnect via authoritative-store re-fetch" mitigation. Surfaced PH-5 as an intermittent `marid-telegram (windows-latest)` hang (~100s, no reply). | Med | FR-036/043, RISK-006 | Add firehose reconnect + authoritative-state re-fetch on drop (contract v1.1 recovery). Interim (PH-5): bounded 3× retry-wrapper on the live E2E in `ci.yml` (operator-chosen); deterministic AC-010/011/012 coverage unaffected (router/stream/permission/gateway-integration tests). | Retry-wrapper green on the RC; a reconnect test when the fix is built | Open |
| 9 | Telegram gateway UX defects found in live E2E (2026-07-09): Markdown un-rendered (`stream.ts` HTML-escapes then sends `parse_mode:HTML`, but the agent emits **Markdown** → literal `**`/backticks); inbound media not landed into the agent's workspace (agent replies "image not found"); slash commands not routed; multi-part replies concatenated into one message; web→Telegram not mirrored (request/response bridge by design). The round-trip itself is verified working (operator "hello" → agent reply synced to web). | Med | FR-036/043, FR-065, INV-001 | **Post-MVP (operator-approved 2026-07-09):** replace the hand-rolled gateway with a fork/port of `grinev/opencode-telegram-bot` (MIT, grammy + remark markdown + official `@opencode-ai/sdk`); INV-001 preserved by **server-enforced `channel:` token** (the fork authenticates to a Marid instance; marid-auth does deny-by-default + bound-agent) + the fork's own allowlist. See **[ADR-0008](../adrs/adr-0008-telegram-gateway-fork.md)**. v0.1.0 ships Telegram **beta** with these documented. | Fork target evaluated (MIT / 897★ / grammy / official SDK); acceptance = markdown+media+slash parity AND INV-001 held (channel-token auth + allowlist), verified against a real provider | **Superseded** — PH-6 gate (2026-07-10) approved **fix-in-place** (ADR-0009 supersedes the fork ADR-0008); the 5 UX defects are fixed in the Marid-owned gateway, not a fork |
| 10 | No automated usage/download-stats mechanism for the single-operator distribution. Upstream's `STATS.md` (npm + GitHub download table) was removed as inapplicable; releases are public (DEC-010) so real per-asset counts are available ad-hoc via `gh api repos/A-H-911/marid/releases`. | Low | — | Post-MVP: a scheduled Marid-owned job pulls GitHub Releases download counts and appends to `STATS.md` (sync-durable). | `STATS.md` shows real per-tag download counts, refreshed on a schedule | Open |
