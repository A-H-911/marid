---
artifact: open-decision-register
status: Draft
version: v0.1
updated: 2026-07-03
---

# Open-Decision Register (DEC-)

Decision points detected at intake — including solution choices the brief itself embeds (lifted here so
the underlying need stays a requirement) and tensions that need a recorded resolution. Statuses follow
governance: Proposed / Approved / Rejected / Superseded / Deferred. Nothing here is Approved yet.

| ID | Decision point | Options on the table | Brief's stated lean | Gate | Status | Decided / note |
|---|---|---|---|---|---|---|
| DEC-001 | Component reduction strategy per package: delete vs build-time exclusion vs feature flag vs package boundary vs distribution profile | All five, compared per candidate (§2, §5) | "Do not assume stripping requires deleting"; prefer small patch surface | 6 | Proposed | open |
| DEC-002 | Primary streaming protocol for the remote API | SSE-first; WebSocket only where SSE+HTTP insufficient | SSE-first (§6) — treated as a proposal from the brief, to be confirmed against upstream's existing mechanism | 7 | Proposed | to confirm vs upstream |
| DEC-003 | Upstream synchronization model | downstream fork w/ upstream remote · periodic merge · periodic rebase · patch-stack · minimal-diff distribution · flags/exclusion · cherry-pick · external adapter layer (§13) | Prefer small isolated patch surface | 9 | Proposed | open |
| DEC-004 | Reuse vs extend vs wrap vs replace for each existing capability: server, SDK, SSE/streaming, session sync, event bus, `packages/slack` channel pattern | Per-capability verdict with evidence (§3) | Reuse-first (INV-007) | 4→6 | Proposed | open |
| DEC-005 | Authoritative session store + concurrency model (optimistic vs pessimistic, queueing/steering semantics) | To be derived from upstream's actual session storage + sync design | None — §7 requires definition, forbids silently assuming distributed coordination | 7 | Proposed | open |
| DEC-006 | MVP distribution method | standalone binary · npm/Bun install · Docker/Compose · native packages (§12) | One MVP method + expansion path; no format explosion | 10 | Proposed | open |
| DEC-007 | Branching model details (Git Flow adaptation for solo downstream fork) | Git Flow as mandated, adapted (§14) | Git Flow is a constraint (CON-007); the *adaptation* is the decision | 9 | Proposed | open |
| DEC-008 | Product/repo/CLI naming | wakil / sanad / rafiq / marid (see naming-proposal.md) | None | 3 | Approved | Marid (2026-07-03) |
| DEC-009 | Reuse-first principle: always reuse upstream capability rather than build new, unless a justified reason is recorded | (stated by owner at gate 4) | — | 4 | Approved | 2026-07-03; strengthens INV-007 |
| DEC-010 | Source repository visibility (`A-H-911/marid`) | private (charter default) · public (unlocks free branch protection/rulesets) | Charter: "private downstream distribution" | 11 (execution) | Approved | Public; operator-directed 2026-07-03; amends charter Mission (detail below) |
| DEC-011 | `client`-scope session ownership: durable store vs in-memory map | durable 0600 sidecar (`ownership.json`) · in-memory map | — | PH-1 (execution) | Approved | 2026-07-04; durable sidecar chosen; detail below |
| DEC-012 | marid binary entry: additive new `src/marid.ts` vs parameterizing edit to upstream `index.ts` | additive entry (P-ENTRY) · edit index.ts | — | PH-1 (execution) | Approved | 2026-07-04; additive entry chosen; detail below |
| DEC-013 | Branding split: land CLI identity in PH-1, defer cosmetic (README/TUI/UA/logo) to PH-5 vs all-at-once | identity-now + cosmetic-later · all-at-once | — | PH-1 (execution) | Approved | 2026-07-04; split chosen; detail below |

## Tensions logged at Stage 6 (contradiction/dependency detection)

| # | Tension | Resolution path |
|---|---|---|
| T-1 | "Keep the Web user interfaces" (CON-005) vs "remove duplicate clients that add maintenance cost" (CON-004) — several web-ish packages exist (`app`, `web`, `console`, `session-ui`, `storybook`) | OQ-005: exact keep-list decided at gate 6 from the component inventory, not from names |
| T-2 | Minimal architecture / no overengineering (NFR-002) vs the very broad §6–§11 capability list | MVP/Full split at scope gate (OQ-002); "Full" items stay in registers as deferred, not deleted |
| T-3 | Small upstream patch surface (NFR-001) vs removing/stripping components (§5) | DEC-001 compares strategies per candidate; deletion is last resort per §2 |
| T-4 | Rich remote API surface (§6) vs "do not expose internal implementation types as long-term public API" (§6) | API/event contract gate (gate 7) decides versioned facade vs direct reuse of upstream SDK contracts |

No mutually exclusive hard contradictions were found; all four tensions have a resolution path inside the
planned gates, so G-CONFLICT passes for proceeding to clarification/scope.

## DEC-010 detail — repository made public (execution-time scope change)

**Decision (operator-directed, 2026-07-03):** set `A-H-911/marid` to **public**. Recorded per the charter's
scope-change rule; supersedes the "private" assumption for the *source repository* only.

**Driver:** branch protection / rulesets are gated behind a paid plan for private repos on GitHub Free
(HTTP 403 — see `deviation-branch-protection.md`). Public unlocks them at no cost. The operator chose this
over GitHub Pro after the contradiction and irreversibility were surfaced twice.

**What it changes:** source repo + its history are world-readable (already mirrors public upstream
`anomalyco/opencode` at `eb3476660`); **GitHub Releases become public** — this affects WBS-5.1's "private
releases" premise, to be reconciled when PH-5 is built.

**What it does NOT change:** the API network-exposure non-goal (OQ-004 — running service stays
private-network-only) is unchanged; **INV-002 remains enforced** (no secrets ever committed — the planning
package was secret-scanned clean before any import). Irreversibility acknowledged: public code can be
cloned/forked/indexed/cached regardless of later visibility flips.

**Traceability:** amends `docs/00-charter.md` (Mission); resolves the blocker in
`docs/decisions/deviation-branch-protection.md`; unblocks WBS-0.3 protection; flags WBS-5.1 for reconciliation.

## DEC-011 · DEC-012 · DEC-013 detail — PH-1 execution decisions (marid-auth + profile build)

Three operator-directed decisions made while building PH-1 (2026-07-04), recorded per the docs-as-source-of-truth rule.

**DEC-011 — `client`-scope session ownership is durable, not in-memory.** The api-event-contract defines `client` as
"sessions it created + its own events." Upstream sessions carry no creator field and the marid-auth wrapper runs
outside the Effect pipeline (EXP-004), so marid-auth tracks token→session ownership itself. Operator chose a
**durable 0600 sidecar** (`ownership.json`, same store pattern as `tokens.json`) over an in-memory map: a `client`
token keeps access to sessions it created across a `marid serve` restart (mirrors upstream's event-sourced session
durability). Ownership is recorded on the two session-*creating* ops — `POST /session` (create) and
`POST /session/:id/fork` (branch). Impl: `packages/marid-auth/src/ownership.ts`.

**DEC-012 — marid binary entry is additive (new `src/marid.ts`), not a parameterizing edit to `index.ts`.** See P-ENTRY
in the patch-surface register. Zero upstream edits; accepts command-list drift, reconciled on sync.

**DEC-013 — Branding split: CLI identity in PH-1, cosmetic in PH-5.** Resolves the CLAUDE.md-vs-roadmap conflict the way
CLAUDE.md intends: the `marid` binary name + `serve`/`token` commands (MS-002 identity) land now; README / TUI title /
user-agent string / logo defer to PH-5. See P-2/P-3.

**Documented seam limitation (not a decision, a consequence) — now resolved:** the outer-wrapper ingress sees HTTP
only, so `client` enforcement was initially per-session *route* ownership, with body-filtering of the global
`/event` firehose and `GET /session` list deferred. That gap is now closed at the wrapper altitude (not the
pipeline) by `@marid/auth/event-filter.ts` — see "Resolved (was Deferred)" below. FR-030 in-pipeline trace
correlation remains the one item genuinely left for the pipeline.

**Traceability:** implements FR-030/031/032/033 (marid-auth envelope), FR-035 (contract pinning via TEST-CONTRACT),
FR-060 (profile build); amends `architecture.md` (patch-surface register, P-2/P-3/P-ENTRY); to be reconciled into
`upstream-sync-strategy.md` (marid.ts + marid-build.ts reconcile checklist).

## Resolved (was Deferred) — strict `client`-scope event isolation (firehose/list body filtering)

**Status: Resolved via option (b) (operator-directed, 2026-07-05).** Built as a marid-owned filter in
`@marid/auth` (`src/event-filter.ts`), wired into the middleware — **zero upstream edit, no new patch surface**.
For any non-admin token the wrapper now body-filters on the way out: it drops other sessions' frames from the
global SSE firehose (`GET /event`) and other sessions' entries from the `GET /session` **and `GET /permission`**
lists (sessions keyed by `id`, permissions by their `sessionID`). Admin is never filtered. This closes the gap
vs the contract's literal "sessions it created + **its own events**."

**Compression handled:** upstream gzips JSON ≥1KB when the request allows it, and a compressed body is opaque to
the wrapper's text-level filter. The middleware strips `accept-encoding` before delegating the filtered list
routes so upstream returns plain JSON (SSE is never compressed, so `/event` is unaffected); non-admin loses
response compression only on those two list routes — negligible on a private LAN. Verified live in
`contract.test.ts` (the isolation test sends a real `accept-encoding` through `maridServe`).

**Residual (documented, not silently dropped):** `POST /permission/:requestID/reply` is keyed by an opaque `per_`
id, not a `sessionID`, so the wrapper can't ownership-gate it without a requestID→session map. It stays
route-allowed; because `GET /permission` is now filtered, a client can't discover another session's requestID
through the API, so replying requires an id learned out-of-band. Full reply-gating is a follow-up (in-pipeline).
The top-level-`sessionID` invariant the filter relies on is pinned by a contract test (fails on upstream drift).

**Why option (b) over (a)/(c):** the ground-truth check showed every session-bearing event — v1 (`session.created`,
`message.part.*`) and v2 (`session.next.*`, `session.status`, `permission.v2.*`) — carries `sessionID` at the
**top level** of its payload (the event-sourcing `durable.aggregate` key), so extracting the owning session is a
one-field probe, not the per-taxonomy map the deferral feared. That made (b) cheap and truly correct. Option (a)
would have reintroduced the P-1 upstream edit EXP-004 removed; option (c) had no route to lean on — the actual
`/event` route is instance/workspace-global (`event.ts` filters only by directory/workspaceID; there is no
per-session subscription route), so "per-session only" would have cut `client` off from streaming entirely.

**Mechanism & limits:** SSE frames are parsed and re-emitted across chunk boundaries; session-less frames
(`server.connected`/`heartbeat`/`disposed`, global/foundation events) always pass — they are infrastructure the
client needs, not another session's data. Ownership is snapshotted at subscribe time (a session the same client
creates mid-stream on another request appears only after reconnect — acceptable for MVP; noted in code).

**Traceability:** consequence of ADR-0003 (v1 + wrapper) + EXP-004 seam; implemented in `@marid/auth`
(`event-filter.ts` + `middleware.ts`); tested by `event-filter.test.ts` (13) + 3 middleware integration tests;
relates to FR-024/025 (events) and the `client` scope in `api-event-contract.md`. No new `P-*` row (additive,
Marid-owned).
