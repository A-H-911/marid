---
status: Approved (gate 7, 2026-07-03; amended v1.1 2026-07-05 — PH-3, additive + reconnect correction; amended v1.2 2026-07-12 — PH-6, Marid channel gateway surface)
version: v1.2
updated: 2026-07-12
owner: operator (STK-001)
---

# Marid Public API & Event Contract (Gate 7)

> **v1.1 (2026-07-05, PH-3).** Additive: documents the concurrency semantics EXP-001 verified (new
> *Concurrency* section). **Correction:** v1.0 stated per-session SSE `?after=<seq>` durable replay; the
> v1 event surface does not implement it (the `/event` firehose is live-only, frames carry no SSE `id:`
> line, and there is no per-session event route or cursor — verified in `handlers/event.ts` + the
> `event` httpapi group). The *Ordering & recovery* section below is corrected to the actual model
> (authoritative-store re-fetch on reconnect; the event-sourced `sync` subsystem is the only replay path
> and is out of the MVP contract). ADR-0004 and EXP-001 carry reconciling notes pointing here.

> **v1.2 (2026-07-12, PH-6 — Marid channel gateway).** Additive. Documents the four Marid-added
> `/marid/*` gateway routes (session↔surface binding), the binding-aware `owns ∪ bound` visibility on the
> `/event` + `/global/event` firehoses (cross-surface mirroring), the route-based SSE-isolation fix
> (ADR-0016/0017), and two *behaviours* on already-committed routes — channel tool calling (sync
> `/session/{id}/message`) and outbound file sending (multipart, Marid-side). **No new replay path:**
> mirroring rides the v1.1 authoritative-store re-fetch-on-reconnect model, not a `seq`/`id:` cursor. See
> the new *Channel gateway surface & cross-surface mirroring* section.

Basis: ADR-0003 (v1 + SSE behind marid-auth) and ADR-0004 (one server per instance). The contract below
is what Marid **commits to** for apps, gateways, and UIs; upstream v1 provides the substance (evidence:
`current-state/02-server-api-sse-sdk.md`), marid-auth adds the operational envelope.

## Surface (reused v1, grouped)

| Area | Operations (v1, reused as-is) | FR |
|---|---|---|
| Sessions | create · list/discover · get · history (paged) · prompt (sync + async w/ client message ID) · cancel/abort · resume/continue · branch | FR-022/023/026/027 |
| Events | global SSE firehose `GET /event` (live-only) · recovery by authoritative-state re-fetch on reconnect (see *Ordering & recovery* — v1.0's `?after=<seq>` replay claim corrected in v1.1) | FR-024/025, RISK-006 |
| Permissions | list pending · `POST /permission/:id/reply` (approve/deny) — over API and via bus to TUI | FR-028 (reply cycle) |
| Config/agents | read config · list agents/models (what upstream exposes; no Marid additions) | FR-010 |
| Meta | health + version (extend to readiness in marid-auth if absent) | FR-034 (health/version) |

## Marid envelope (added by marid-auth, all NEW code)

- **AuthN:** static bearer tokens issued by the operator per client (`marid token create <name> --scope …`);
  stored per instance; constant-time comparison; no token ⇒ 401 (server refuses unauthenticated even on
  localhost — stricter than upstream's optional Basic).
- **AuthZ scopes (MVP-simple):** `admin` (everything), `client` (sessions it created + its own events),
  `channel:<name>` (bound to the channel's dedicated agent, its capability policy, and its sessions only).
- **Rate limiting:** token-bucket per token (defaults: 10 req/s burst 30; SSE connections exempt but
  capped per token at 4). 429 with `retry-after`.
- **Audit log:** append-only JSONL per instance (`audit/audit-<date>.jsonl`): timestamp, token name,
  route, session, decision (allow/deny/429), request-ID. Separate from ops telemetry (FR-059).
- **Correlation:** accept/generate `x-request-id`, echo in responses, propagate into audit + traces (FR-030).
- **Idempotency:** reuse v1 client-supplied message IDs + ConflictError for prompts (verified R-02);
  document it as the contract; no extra Idempotency-Key layer in MVP.
- **Errors:** upstream structured errors pass through; marid-auth failures use the same shape
  (`{ name, message, requestId }`).

## Event contract

- Transport: **SSE only** (DEC-002). Commands are plain HTTP; no WebSocket unless a recorded gap (EXP-001).
- Taxonomy: reuse upstream event types (message/part deltas incl. text+reasoning, tool
  called/progress/success/failed, step lifecycle, status/idle, permission asks, session lifecycle).
  Subagent events: exposed to the extent upstream emits them (R-02 marked dedicated subagent events
  `unverified` — confirm during EXP-001 and document the result here).
- Ordering: events for one aggregate (a session) are delivered in the order the server emits them —
  a single per-subscriber FIFO queue feeds the SSE encode (EXP-001, criterion 3). Each event payload
  carries an `id` and a top-level `sessionID` (the event-sourcing aggregate key) inside its `properties`.
- **Recovery on reconnect (corrected v1.1): the authoritative store, not event replay.** The `/event`
  firehose is **live-only** — no `?after=<seq>` cursor, no SSE `id:` line / `Last-Event-ID` resumption.
  On reconnect a client re-subscribes to the live stream and **reconciles by re-reading authoritative
  session state** (`GET /session` + `GET /session/{id}/message`), which is the source of truth (the store
  is event-sourced and durable). No *state* is lost across a disconnect or a server restart; events
  emitted during the gap are not replayed as events — clients reconcile by re-reading. Verified by the
  PH-3 reconnect test (kill + restart `marid serve` → client re-fetch recovers the message written while
  down). The only event-sourced *replay* path is the experimental `sync` subsystem
  (`OPENCODE_EXPERIMENTAL_WORKSPACES`, `/sync/replay`), which is **out of the MVP contract**.
- Duplicates: at-least-once across a reconnect boundary is possible; clients that dedup do so by event
  `id`. Because recovery is re-fetch rather than replay, exact-once event delivery is not promised.
- Backpressure/disconnect: server emits `server.heartbeat` frames; clients reconnect with jittered
  backoff (the SDK does exponential backoff, base 1s cap 30s) and then re-read authoritative state.

## Channel gateway surface & cross-surface mirroring (PH-6, v1.2)

PH-6 evolves `marid-auth` into the **channel gateway**: the same authenticated wrapper now serves four
Marid-owned routes (additive — no upstream edit, no `P-*`) that bind a session to a channel surface so
that surface mirrors it. These are the only routes PH-6 adds to the committed surface. They are pinned by
the **merged-`/doc` assertion** in `packages/marid-auth/test/gateway.test.ts`, not by `contract.test.ts`:
the upstream `Server.openapi()` that `contract.test.ts` reads does not carry them, so the merged `/doc`
(where the wrapper adds its OpenAPI fragment) is where the contract holds.

| Route | Scope | Purpose |
|---|---|---|
| `POST /marid/attach` | admin | Bind a channel token to a session (operator explicitly attaches — ADR-0012) |
| `POST /marid/detach` | admin | Remove a session↔surface binding |
| `GET /marid/bindings?token=<t>` | admin | List the sessions a given channel token is bound to |
| `GET /marid/self-bindings` | any authenticated token | List the **caller's own** bound sessions — keyed on the authenticated token, **no `?token=` override** (spoof-proof); the channel-client polls it to pick up a mid-stream attach/detach (WBS-6.5) |

**Visibility = `owns ∪ bound` (the mirroring mechanism).** A non-admin token's `/event` and `/global/event`
firehoses — and its `GET /session` / `GET /permission` lists — now show, in addition to the sessions it
**owns**, the sessions explicitly **bound** to it. An attached surface (TUI, web, or channel) sees a bound
session's frames live; an unattached surface never does. **Admin is still never filtered.**
**View-via-binding, act-via-ownership:** a bound-but-not-owner surface can *observe* a session but cannot
approve its permissions or prompt it (`authorize` / reply / prompt stay on `owns`) — no privilege
escalation via mirroring (INV-001). A binding-store fault degrades safe to owns-only (RISK-024).

**Recovery is unchanged from v1.1 — re-fetch, not replay.** Mirroring adds no `seq`/`id:` cursor. On a
firehose drop the channel-client reconnects (capped exponential backoff 500 ms–30 s) and reconciles by
re-reading authoritative state; a bound (non-owned) session is **never** re-fetched (`GET
/session/{id}/message` is owns-gated → 403, INV-001), so it resumes live only with gap frames lost by
design. Owned sessions re-read full history and flush the latest assistant message **edit-in-place**
(`part.id`-keyed → the finished-during-gap turn renders once, no duplicate).

**SSE isolation keys on the route, not the `Accept` header (ADR-0016/0017).** The `owns ∪ bound` filter
must run on the firehose response. The wrapper originally detected the firehose by the request header
`Accept: text/event-stream` — but the Marid SDK's SSE client omits it, which **bypassed the filter for
every non-admin token** (a realized INV-001 leak surfaced by the WBS-6.6 live-account tier, EXP-015 /
RISK-025). The fix recognises the firehose by **pathname** (`isStream` matches `/event` and `/global/event`
regardless of `Accept`), so the filter always applies; ADR-0017 fixes the companion own-session
lazy-visibility defect the leak had masked. Regression-pinned by a real-request test in `marid-auth`.

**Two behaviours on already-committed routes (no new route):**

- **Channel tool calling** rides the sync `POST /session/{id}/message` route (already committed). The
  gateway drives it **detached** — the SDK drains the response stream to completion in the background, so
  the request stays alive for the whole turn and the served turn resolves the **full toolset + MCP**. (The
  async `prompt_async` route `Effect.forkIn`s the turn off its request scope → it runs after the request
  returns, outliving the request-scoped tool/agent/MCP context, and resolves an *empty* toolset; root
  cause pinned by `test/marid/step0-tools-probe.test.ts`.) Per-tool gating is the channel agent's
  `permission` ruleset (`docs/execution/telegram-channel-tools.md`); `ask` surfaces the inline Approve/Deny
  keyboard via the existing `permission.replied` cycle.
- **Outbound file sending** is Marid-side, not a server route: when a tool returns a media attachment
  (a `data:` URL part), the gateway decodes the bytes and uploads them to the channel as **multipart**
  (image mime → photo, else document). No public URL / relay is involved.

## Concurrency semantics (EXP-001 — verified; §7 / FR-040/041)

Upstream serializes every concurrent action on a session through **one `Runner` per session** backed by
an atomic `SynchronizedRef`; the user message is persisted to the DB **before** the run starts. Marid
adds no busy-lock/queue of its own (C-5 option C not required) — the wrapper preserves this authority,
proven through the authenticated surface by the PH-3 concurrency test (two clients, one session).

- **Two simultaneous prompts to one session:** the second does **not** spawn a parallel run. If a run is
  active it **joins** the in-flight run — and because the run loop re-reads the full persisted message
  list at the top of every step, the already-persisted second prompt is absorbed on the next step (the
  **steer**). Both callers resolve against the same finalized assistant message. No interleaving, no
  corruption, no lost/duplicate messages.
- **Exclusive operations while a run is active** (e.g. starting a shell) are rejected with `BusyError`
  rather than racing the run.
- **Abort/cancel** interrupts the run fiber and resolves **all** joined awaiters with the same finalized
  message; a mid-run cancel leaves no poison rows; cancel propagates from a parent session to subtask
  children.
- **Ownership / access control:** `client`-scope tokens act on sessions they created (durable ownership,
  fork-aware) and observe only their own sessions/events (marid-auth body-filters `/event`, `/session`,
  `/permission`); `admin` is unfiltered. Cross-session isolation is by the per-session aggregate key.
- **Event ordering under concurrency:** because the second prompt *joins* rather than producing a second
  parallel producer, a run has exactly one event producer, so the per-subscriber FIFO preserves
  per-session order (EXP-001, criterion 3).

## Versioning policy (FR-035)

- The Marid contract version rides the product version (semver). Marid does **not** re-version upstream
  v1 routes; it pins them: any upstream breaking change to a committed route is caught by contract tests
  (FR-063) at sync time and is a blocking sync-review item.
- Event payloads: additive changes allowed; removals/renames require a major version + migration note.
- When upstream v2 stabilizes, migration happens behind the facade with a compatibility window (ADR-0003).

## Explicitly not in the MVP contract

Durable global event replay (FR-037, Full), webhooks/outbound callbacks, multi-user token semantics
(single operator issues all tokens), public-internet hardening (TLS/certs documented as deployment
guidance only — OQ-004).
