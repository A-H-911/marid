---
status: Draft
version: v0.1
updated: 2026-07-13
owner: operator (STK-001)
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
| DEC-014 | Telegram remediation approach | fix-in-place (`telegramify-markdown` + wire seams) · port grinev render modules · fork grinev wholesale · adopt another bridge | reuse-first + fewest changes (DEC-009, NFR-001) | PH-6 | Approved | fix-in-place (C-8 / ADR-0009); **ADR-0008 SUPERSEDED 2026-07-10 gate**; EXP-005 validates at build |
| DEC-015 | WhatsApp unofficial-client approach | Baileys-behind-WAHA-WS · Baileys-direct-hardened · Evolution API · Puppeteer libs · (official Cloud API — rejected) | minimal supply-chain exposure + outbound-only (OQ-004) | PH-7 | Approved | recommend WAHA-NOWEB-WS (C-9 / ADR-0010), Baileys-direct alt; confirmed by EXP-006 |
| DEC-016 | Amend FR-047 "official Business/Cloud APIs" → permit an unofficial client under private-network containment | keep "official" (needs public ingress) · permit unofficial (OQ-004 fit; ban/ToS + supply-chain risk accepted) | OQ-004 favors outbound/unofficial | PH-7 | Approved | operator-gated requirement amendment; official kept as rejected-with-reason (INV-006) |
| DEC-017 | Gateway shape | server-side Marid Gateway (marid-auth = a component) + `@marid/channel-client` · client-lib-only · standalone proxy · both | operator: "expand marid-auth server-side; marid-auth is a component in the gateway" | PH-6 | Approved | C-11 front-runner A / ADR-0011 |
| DEC-018 | Cross-client sync model, scope + recovery | **full bidirectional mirroring, explicit-attach scope, re-fetch-recovery** · continuity-only · broad-auto · durable-replay | operator: full bidirectional mirroring; explicit-attach (INV-001-safe) | PH-6 | Approved | C-12 A / ADR-0012; view-via-binding, act-via-ownership |
| DEC-019 | Telegram real-client test strategy | **four tiers** (fake-server=gate + userbot + Web-Playwright local/on-demand + native-mobile manual) · fake-server-only · GUI-as-required-gate | operator: real automated testing incl. the native app | PH-6 | Approved | C-10 / ADR-0013 |
| DEC-020 | WhatsApp real-client test strategy | fake-WA-at-WAHA-boundary = gate + burner real-protocol probe (manual) + native-app (manual); **NO deterministic real-protocol tier** · second-account-as-gate · official-Cloud-API-sandbox | WhatsApp has no test DC/sandbox; Baileys mock is private (R-12) | PH-7 | Approved | C-13 / ADR-0014 |
| DEC-021 | WhatsApp permission-approval UX | **token-bound text reply** · interactive buttons · WAHA-Plus lists · polls | buttons dead/deprecated on unofficial WhatsApp; lists paid/fragile (R-12) | PH-7 | Approved | C-14 / ADR-0015 |
| DEC-022 | Machine-state isolation mechanism | **app-name change isolates dirs; KEEP `OPENCODE_*` env + detect/disclose pierce** · rename env for isolation · no isolation | operator: total DATA isolation but keep `OPENCODE_*` env (plugin/ecosystem compat) | PH-8 | Approved | 2026-07-13 (plan §2); realized by ADR-0018 D1; DEC-009 reuse |
| DEC-023 | Config filename + fallback | **`marid.json` primary; project-level `opencode.json` fallback; global reads `~/.config/marid/` only** · global `opencode` fallback · marid-only | operator: project fallback YES, global fallback NO (avoids model/provider bleed) | PH-8 | Approved | 2026-07-13 (plan §2 i); ADR-0018 D2 |
| DEC-024 | `.opencode/` project dirs (agents/skills/plugins/commands) | **keep upstream-named** · rename to `.marid/` | operator: keep (ecosystem compat, like kept env) | PH-8 | Approved | 2026-07-13 (plan §2 ii); ADR-0018 D3 |
| DEC-025 | Upgrade migration | **one-time copy** of the old opencode data/state into the marid dirs (marker; no re-run) · fresh + re-issue · no migration | operator: one-time copy (no auth outage; gateway tokens + Telegram pairing survive) | PH-8 | Approved | 2026-07-13 (plan §2 iii); ADR-0018 D4 |
| DEC-026 | Agent-identity / prompt transform scope | **full** (identity + self-doc-fetch → Marid docs + support URLs → Marid repo) · identity-only · none | operator: full transform | PH-8 | Approved | 2026-07-13 (plan §2 iv); ADR-0018 D6 |
| DEC-027 | Rename the sessions DB file | **keep `opencode.db` inside the isolated marid dir** · rename to `marid.db` | operator: keep (dir isolation already isolates it; rename needs 2 upstream branches, no operator-visible benefit) | PH-8 | Approved | 2026-07-13 (operator gate at ADR-0018 Phase-0 exit); ADR-0018 D5 |

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

## DEC-014 · DEC-015 · DEC-016 detail — post-MVP channels homework (2026-07-09, all Proposed)

Product of the R-11/R-12 research cycle (findings under `../research/findings/`), comparisons C-8/C-9, and the
devil's-advocate re-check. **All three are Proposed — the operator flips them at the gate (INV-005); nothing is
Approved here.**

**DEC-014 — Telegram remediation = fix-in-place.** Re-evaluates the Approved ADR-0008 (fork grinev) on new
evidence: `packages/marid-telegram` is zero-dep hand-rolled (not grammy) and already has streaming/coalescing/
429/400-fallback; the only gap is Markdown→Telegram conversion (one MIT dep, `telegramify-markdown`); grinev is
Basic-auth + admin-features that the `channel:` scope denies (403). C-8 scores fix-in-place 42/42. On approval:
**ADR-0009 → Approved, ADR-0008 → Superseded.** Confirmation: EXP-005 (PH-6 start).

**DEC-015 — WhatsApp client = unofficial, isolated.** C-9 front-runner is **Baileys behind a pinned WAHA
(NOWEB) container consumed over WebSocket** — Marid pulls no WhatsApp dependency (contains the lotusbail-class
supply-chain risk, RISK-014), WAHA Core is free Apache-2.0, and the connection is outbound-only (OQ-004). The
documented alternative is **hardened Baileys-direct** (best stack/streaming fit, MIT, but Baileys in Marid's
tree). Puppeteer libraries rejected (Chromium footprint). Confirmation: EXP-006 (reproducible fake-WA at PH-7
start; real-number live probe later in PH-7). Realized by ADR-0010.

**DEC-016 — FR-047 amendment (official → unofficial-under-containment).** FR-047's text says "official
Business/Cloud APIs," but the official Cloud API is webhook-push (needs a **public inbound endpoint**),
contradicting OQ-004 (private-network, outbound-only), with business-account/approval overhead disproportionate
to one operator. The operator chose an unofficial client (DEC-015), so FR-047's text must be amended. This is an
**operator-gated requirement amendment**: the official option is preserved as rejected-with-reason (INV-006), and
the accepted trade-off is the ToS/ban reality (RISK-013) + supply-chain exposure (RISK-014), both mitigated per
ADR-0010. Until Approved, FR-047's text stands (the amendment is noted, not applied).

## DEC-017 · DEC-018 · DEC-019 detail — Telegram-first gateway/mirroring/testing expansion (2026-07-10, all Proposed)

Product of the operator's scope expansion + the OpenClaw/Shaheen gateway study + source verification of
`event-filter.ts`. All Proposed — operator flips at the gate (INV-005).

**DEC-017 — Gateway shape = server-side Marid Gateway (marid-auth is a component).** Per operator: evolve
`marid-auth` (the additive HTTP-ingress wrapper) into a **Marid Gateway** with marid-auth as one module, unified
with the HTTP+SSE surface, plus a thin client-side `@marid/channel-client` all channels consume. Design derived
from OpenClaw (nodes model, device-token scope-binding, server-side allowlist, event fan-out) + Shaheen (separate-
process-over-public-API, one `Server.extend` hook). Additive; the new server-side surface is contained behind one
hook (RISK-019). C-11 scores A 32/33. Realized ADR-0011.

**DEC-018 — Cross-client sync = full bidirectional mirroring, explicit-attach scope, re-fetch recovery.** Every
turn of a session mirrors live to every **bound** surface, bidirectionally; scope is **explicit-attach** (a
channel sees its own + operator-attached sessions — a fresh web/TUI session never auto-appears in a channel;
INV-001-safe). Verified additive at `event-filter.ts` (binding registry + binding-aware `isVisible` + channel-
client; no new bus, no upstream edit — RISK-019 downgraded). Authorization = **view-via-binding, act-via-
ownership** (a channel can view a mirrored session but only owns→approve). Recovery = re-fetch-on-reconnect
(additive default; durable replay = flagged escape hatch). C-12 scores A 26/30. Realized ADR-0012.

**DEC-019 — Telegram test strategy = four tiers.** Deterministic **fake-server E2E = blocking GitHub PR gate**;
**GramJS userbot (test DC) + Telegram-Web-Playwright** run local-pre-PR every time + GitHub on-demand (non-gating);
**native mobile app (mobilewright)** = operator-requested manual/occasional check (never a gate). Honors "always
executed" without flaky remote gates. C-10 front-runners A+B (complementary) + fake-server gate + C manual.
Realized ADR-0013; feasibility gated by EXP-007/009/010.

## DEC-022 … DEC-027 detail — PH-8 isolation & deep rebrand (2026-07-13)

Inputs the operator locked while planning PH-8 (twice-reviewed plan §2, 2026-07-13). **DEC-022..027 are all
Approved** — DEC-022..026 as plan-locked inputs, and **DEC-027 confirmed KEEP `opencode.db` at the Phase-0
operator gate (2026-07-13).** They are *realized* by
**[ADR-0018](../adrs/adr-0018-data-isolation-deep-rebrand.md)**, **Approved at that same PH-8 Phase-0 gate**
(INV-005) — the design is settled and PH-8 code phases (WBS-8.1+) are authorized.

**Context.** The public `marid` v0.2.0 binary, run beside a co-installed OpenCode, leaks the OpenCode
identity and shares machine-global state (auth/model/sessions/config/DB) — six reported issues (see ADR-0018
Context). This is exactly the on-machine conflict `branding.md`'s "Rebrand boundary" said it would *"revisit
only if"* it emerged. PH-8 revisits it: **dir names change (isolation); env stays; DB name stays.**

**DEC-022 — machine-state isolation via app-name; keep `OPENCODE_*` env + disclose pierce (Approved).** All
data/state/config dirs and the file lock derive from one upstream app-name constant; a build-time
`__MARID_APP` define isolates them at once (ADR-0018 D1, **P-6**). `OPENCODE_*` env is **kept** (DEC-009
reuse — third-party plugins + Marid's own instance/test infra read it); data-layer overrides that *pierce*
isolation are **detected and disclosed** (boot WARN + `usage.md` table + negative tests), never silently
honored.

**DEC-023 — config `marid.json` primary; project-`opencode.json` fallback; no global fallback (Approved).**
A repo's checked-in `opencode.json` still works; a global `~/.config/opencode/` fallback is **rejected** — it
would re-import the reported model/provider bleed. ADR-0018 D2, **P-7**.

**DEC-024 — `.opencode/` project dirs kept upstream-named (Approved).** Agents/skills/plugins/commands
discovery keeps the upstream name (ecosystem compat, like kept env); isolation targets machine-global state,
not project-local opt-in content. ADR-0018 D3.

**DEC-025 — migration = one-time copy (Approved).** First run with no marid dir copies the old opencode
data/state (auth.json, `${data}/marid` gateway tokens, DB, model.json, Telegram pairing) into the marid dirs
once (marker prevents re-run, logged) → no auth outage, pairing survives. ADR-0018 D4.

**DEC-026 — full agent-identity transform (Approved).** Marid-owned wrap of `provider()`'s output at the
single system-prompt choke point: identity → Marid, self-doc-fetch → Marid docs/neutralized, support URLs →
Marid repo; CI guard forbids `\bopencode\b` in emitted prompts outside an allowlist. ADR-0018 D6, **P-8**
(conditional).

**DEC-027 — no DB rename (Approved).** The DB file stays `opencode.db` *inside* the isolated marid dir (dir
isolation already isolates it; renaming needs two upstream branches, conflicts with marid-instance, no
operator-visible benefit). **The operator confirmed KEEP `opencode.db` (no rename) at the ADR-0018 Phase-0
gate (2026-07-13).** ADR-0018 D5.

**Traceability:** realized by ADR-0018 (Approved 2026-07-13); opens PH-8 / MS-009 (roadmap/WBS/milestones) + AC-025..031;
amends `branding.md` "Rebrand boundary"; pre-registers P-6/P-7/P-8 + a P-2 expansion in `architecture.md`.
