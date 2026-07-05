---
artifact: api-event-contract
status: Approved (gate 7, 2026-07-03; amended v1.1 2026-07-05 — PH-3, additive + reconnect correction)
version: v1.1
updated: 2026-07-05
---

# Marid Public API & Event Contract (Gate 7)

> **v1.1 (2026-07-05, PH-3).** Additive: documents the concurrency semantics EXP-001 verified (new
> *Concurrency* section). **Correction:** v1.0 stated per-session SSE `?after=<seq>` durable replay; the
> v1 event surface does not implement it (the `/event` firehose is live-only, frames carry no SSE `id:`
> line, and there is no per-session event route or cursor — verified in `handlers/event.ts` + the
> `event` httpapi group). The *Ordering & recovery* section below is corrected to the actual model
> (authoritative-store re-fetch on reconnect; the event-sourced `sync` subsystem is the only replay path
> and is out of the MVP contract). ADR-0004 and EXP-001 carry reconciling notes pointing here.

Basis: ADR-0003 (v1 + SSE behind marid-auth) and ADR-0004 (one server per instance). The contract below
is what Marid **commits to** for apps, gateways, and UIs; upstream v1 provides the substance (evidence:
`current-state/02-server-api-sse-sdk.md`), marid-auth adds the operational envelope.

## Surface (reused v1, grouped)

| Area | Operations (v1, reused as-is) | FR |
|---|---|---|
| Sessions | create · list/discover · get · history (paged) · prompt (sync + async w/ client message ID) · cancel/abort · resume/continue · branch | FR-022/023/026/027 |
| Events | global SSE firehose `GET /event` (live-only) · recovery by authoritative-state re-fetch on reconnect (see *Ordering & recovery* — v1.0's `?after=<seq>` replay claim corrected in v1.1) | FR-024/025, RISK-006 |
| Permissions | list pending · `POST /permission/:id/reply` (approve/deny) — over API and via bus to TUI | FR-028 |
| Config/agents | read config · list agents/models (what upstream exposes; no Marid additions) | FR-010 |
| Meta | health + version (extend to readiness in marid-auth if absent) | FR-034 |

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
