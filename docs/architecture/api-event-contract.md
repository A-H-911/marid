---
artifact: api-event-contract
status: Approved (gate 7, 2026-07-03)
version: v1.0
updated: 2026-07-03
---

# Marid Public API & Event Contract (Gate 7)

Basis: ADR-0003 (v1 + SSE behind marid-auth) and ADR-0004 (one server per instance). The contract below
is what Marid **commits to** for apps, gateways, and UIs; upstream v1 provides the substance (evidence:
`current-state/02-server-api-sse-sdk.md`), marid-auth adds the operational envelope.

## Surface (reused v1, grouped)

| Area | Operations (v1, reused as-is) | FR |
|---|---|---|
| Sessions | create · list/discover · get · history (paged) · prompt (sync + async w/ client message ID) · cancel/abort · resume/continue · branch | FR-022/023/026/027 |
| Events | global SSE firehose `GET /event` (live) · per-session SSE with `?after=<seq>` durable replay | FR-024/025, RISK-006 |
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
- Ordering & replay: per-aggregate sequence numbers are the ordering guarantee; on reconnect a client
  resumes with `?after=<lastSeq>` per session (no global replay — documented limitation; the firehose is
  live-only, subscribers needing gap-free history must track per-session).
- Duplicates: at-least-once on reconnect boundaries; clients dedup by (aggregate, seq).
- Backpressure/disconnect: server heartbeats (verify interval in EXP-001); clients reconnect with jittered
  backoff; gateway persists last-seen seq per session.

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
