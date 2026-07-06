---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# Current State: HTTP Server, SSE, and SDKs (Research Track R-02)

Findings only. All paths relative to repo root. `unverified` marks claims not confirmed in code.

## 1. HTTP Server

### 1.1 Where it lives — CLAUDE.md is outdated

CLAUDE.md says "Hono, port 4096". The Hono server is gone. The listener is now built on
**Effect `HttpRouter` / `httpapi` + Node `createServer`**:

- Listener: `packages/opencode/src/server/server.ts:73` (`Server.listen`), Node HTTP server at `packages/opencode/src/server/server.ts:200`, served via `HttpRouter.serve` at `packages/opencode/src/server/server.ts:101`.
- Port 4096 survives only as a preference: explicit port `0` tries 4096 first, then any free port (`packages/opencode/src/server/server.ts:117-122`).
- `bun x @hono/...` / `hono` does not appear in `packages/opencode/package.json` (grep returned nothing).
- Entry point: `opencode serve` (`packages/opencode/src/cli/cmd/serve.ts:6`). Default bind `127.0.0.1`, port `0` (→4096) (`packages/opencode/src/cli/network.ts:7-16`). Optional mDNS discovery (`packages/opencode/src/server/mdns.ts`, wired at `server.ts:155-170`).

### 1.2 Relationship between packages

Two API generations are mounted on the same listener:

| Layer | Contract | Handlers | Paths |
|---|---|---|---|
| **v1 "instance" API** (legacy, un-prefixed paths) | `packages/opencode/src/server/routes/instance/httpapi/groups/*` (20 files) | `.../httpapi/handlers/*` | `/session`, `/event`, `/config`, ... |
| **v2 API** (new, `/api/*` prefix) | `packages/protocol/src/groups/*` (18 files) | `packages/server/src/handlers/*` | `/api/session`, `/api/event`, ... |

- `packages/protocol` = pure endpoint contracts (`HttpApiGroup` definitions + tagged errors), no runtime (`packages/protocol/src/api.ts:37-64`).
- `packages/server` = handler implementations + auth/location middleware; composed in `packages/server/src/routes.ts:39-68` (`createRoutes(password?)`, `createEmbeddedRoutes()`).
- `packages/opencode` mounts everything into one `HttpApi`: `OpenCodeHttpApi = Root + Event + Instance + ServerApi(v2) + PtyConnect` (`packages/opencode/src/server/routes/instance/httpapi/api.ts:79-84`; v2 injected at `api.ts:48-52`).
- v2 groups self-describe as **"Experimental session routes" / "Experimental event stream route" / "Experimental permission routes"** (`packages/protocol/src/groups/session.ts:377`, `event.ts:45`, `permission.ts:137`) and the whole v2 API as "Experimental HttpApi surface" (`packages/protocol/src/api.ts:60`).

### 1.3 OpenAPI contract

- Generated: `packages/opencode/src/server/server.ts:67-69` (`OpenApi.fromApi(PublicApi)`); public subset defined in `packages/opencode/src/server/routes/instance/httpapi/public.ts` (537 lines).
- v2 routes also self-serve `/openapi.json` (`packages/server/src/routes.ts:54`).
- Regeneration pipeline: `script/generate.ts` runs `bun ./packages/sdk/js/script/build.ts` then `bun dev generate > ../sdk/openapi.json` (`script/generate.ts:5-7`). Checked-in spec: `packages/sdk/openapi.json` (162 paths).

### 1.4 Route surface (from `packages/sdk/openapi.json`, 162 paths)

**v1 sessions:** `/session` (GET/POST), `/session/status`, `/session/{id}` (GET/DELETE/PATCH), `/children`, `/todo`, `/diff`, `/message` (GET/POST = **sync prompt**), `/message/{id}` (GET/DELETE), `/fork`, `/abort`, `/init`, `/share` (POST/DELETE), `/summarize`, `/prompt_async` (**async prompt**), `/command`, `/shell`, `/revert`, `/unrevert`, `/permissions/{permissionID}`, part delete/patch.
**v1 events:** `/event` (SSE), `/global/event`.
**v1 config/infra:** `/config` (GET/PATCH), `/config/providers`, `/global/config`, `/global/health`, `/global/dispose`, `/global/upgrade`, `/instance/dispose`, `/path`, `/vcs/*`, `/log`, `/auth/{providerID}`.
**v1 files/search:** `/find`, `/find/file`, `/find/symbol`, `/file`, `/file/content`, `/file/status`.
**v1 misc:** `/command`, `/agent`, `/skill`, `/lsp`, `/formatter`, `/mcp/*`, `/project/*`, `/pty/*`, `/question/*`, `/permission` (GET) + `/permission/{requestID}/reply`, `/provider/*`, `/sync/*` (start/replay/steal/history), `/tui/*` (13 remote-control routes), `/experimental/*` (worktree, workspace, control-plane, capabilities, tool, resource).
**v2 (`/api/*`):** health, location, agent, session (list/create/active/get/agent/model/prompt/compact/wait/revert stage-clear-commit/context/history/event SSE/interrupt/message), model, provider, integration, credential, permission (request list, saved list/remove, per-session create/list/get/reply), fs (read/list/find), command, skill, event SSE, pty (+ connect-token/connect WS), question, reference.

## 2. Streaming (SSE)

Three SSE surfaces, all `text/event-stream`, all Effect-Stream based:

1. **v1 `/event`** — instance-scoped firehose. Handler `packages/opencode/src/server/routes/instance/httpapi/handlers/event.ts:25-87`: eager listener registration ("events published after this point cannot be lost", line 29-31), unbounded queue, filter by instance directory/workspace, initial `server.connected` event (line 70), `server.heartbeat` every 10s (lines 63-66), terminates on `server.instance.disposed` (line 61).
2. **v2 `/api/event`** — server-scoped. `packages/server/src/handlers/event.ts:20-52`: `server.connected` first, live tail from `EventV2.allBounded(events, 256)` (bounded subscriber capacity, line 9/33), SSE comment heartbeat `": heartbeat"` every 15s (line 37). **No replay** — live-only.
3. **v2 `/api/session/{id}/event`** — per-session durable stream with **replay**: contract takes `?after=<seq>` and "Replay durable events after an aggregate sequence, then continue with new durable events" (`packages/protocol/src/groups/session.ts:327-342`); handler at `packages/server/src/handlers/session.ts:358-363`.

**Ordering/replay model:** v2 durable events carry `{aggregateID, seq, version}` (`packages/protocol/src/groups/event.ts:11`); session events declare `durable: { aggregate: "sessionID", version }` (`packages/schema/src/session-event.ts:38-48`). Reconnect = re-request with last seen `seq` (`after`). Paged catch-up alternative: `GET /api/session/{id}/history?after=&limit=` (max 100/page, `session.ts:87-92, 307-325`).
**Standard SSE `Last-Event-ID` / `id:` field: absent** — SSE `id` is always `undefined` (`packages/server/src/handlers/event.ts:15`; `packages/opencode/.../handlers/event.ts:16`); repo-wide grep for `Last-Event-ID`/`lastEventId` returned nothing. Resume is via the `after` query param instead.
**Backpressure:** v2 firehose subscriber capacity 256 (`packages/server/src/handlers/event.ts:9`); v1 uses an unbounded queue (`.../handlers/event.ts:31`) — no client backpressure there.

**Event types (v2 session stream, `packages/schema/src/session-event.ts`):** `session.next.prompt.admitted`, `.prompted`, `.step.started/.ended/.failed`, `.text.started/.delta/.ended`, `.reasoning.started/.delta/.ended`, `.tool.called/.input.started/.input.delta/.input.ended/.progress/.success/.failed`, `.compaction.started/.delta/.ended`, `.agent.switched`, `.model.switched`, `.shell.started/.ended`, `.revert.staged/.cleared/.committed`, `.retried`, `.moved`, `.context.updated`, `.synthetic`; plus `session.status`/`session.idle` (`packages/schema/src/session-status-event.ts`) and `server.connected` (`packages/schema/src/server-event.ts`). The full server manifest also includes permission and question event definitions (`packages/schema/src/event-manifest.ts:14-21`).
**Event bus:** new `EventV2` service (`@opencode-ai/core/event`, wired at `packages/server/src/routes.ts:29`); v1 bridge via `EventV2Bridge` + `GlobalBus` (`packages/opencode/.../handlers/event.ts:1-3`).
**WebSockets:** only for PTY connect (`/api/pty/{id}/connect`, ticket-based) — tracked/closed via `websocket-tracker.ts` (`packages/opencode/src/server/server.ts:12,42`).

## 3. Session operations over HTTP

- **Create/list/get:** both generations (v1 `/session`; v2 `/api/session` with opaque base64url cursor pagination, `packages/protocol/src/groups/session.ts:55-104`). Client may supply its own `id` on v2 create (`session.ts:131`) and on prompt (`session.ts:208`) — client-generated-ID idempotency style. Discovery of live servers: mDNS (opt-in, `packages/opencode/src/server/mdns.ts`); active sessions via `/api/session/active` (`session.ts:146-155`).
- **Prompt sync:** v1 `POST /session/{id}/message` streams/returns the full assistant message (`packages/opencode/.../groups/session.ts:316-328` region, identifier `session.prompt`).
- **Prompt async:** v1 `POST /session/{id}/prompt_async` returns 204 immediately (`.../groups/session.ts:329-341`); v2 `POST /api/session/{id}/prompt` is durable-async: "Durably admit one session input and schedule agent-loop execution unless resume is false", returns `SessionInput.Admitted` (`packages/protocol/src/groups/session.ts:205-223`). `POST /api/session/{id}/wait` blocks until idle (`session.ts:241-253`).
- **Cancel:** v1 `/session/{id}/abort`; v2 `/api/session/{id}/interrupt` (`session.ts:345-357`).
- **Resume:** v2 prompt `resume` flag (`session.ts:211`) resumes scheduled execution; history+`after` replay covers reconnect-resume.
- **Branch/fork:** v1 `/session/{id}/fork` and `/session/{id}/children` (openapi.json). No v2 equivalent found.
- **Share:** v1 `/session/{id}/share` POST/DELETE (`packages/opencode/.../groups/session.ts:279-302`). No v2 equivalent.
- **Permissions over API:** yes, both generations. v1: `GET /permission`, `POST /permission/{requestID}/reply`, `POST /session/{id}/permissions/{permissionID}`. v2: create/list/get/reply per session + saved-permission CRUD (`packages/protocol/src/groups/permission.ts:21-137`).
- **Questions (agent-asks-user):** v2 `/api/session/{id}/question/.../reply|reject` (`packages/protocol/src/groups/question.ts`).

## 4. SDK packages

| Package | What it is | Status |
|---|---|---|
| `packages/sdk` (`@opencode-ai/sdk`, published) | Legacy generated TS client from `openapi.json` via `@hey-api/openapi-ts` (`packages/sdk/js/package.json:26`); has `/v2` exports (`src/v2/gen`) covering the `/api` surface | Current published SDK; slated for replacement (`packages/sdk-next/README.md:3`) |
| `packages/client` (`@opencode-ai/client`, private) | Generated from the Effect `HttpApi` contract via `@opencode-ai/httpapi-codegen` — emits both a Promise client and an Effect client (`packages/client/script/build.ts:2-27`); depends only on `schema`+`protocol` | Active; "generate complete protocol client" landed recently (commit `dfeb1b505`) |
| `packages/sdk-next` (`@opencode-ai/sdk-next`, private) | Effect-native **in-process** host: executes the assembled server router in memory, "opens no listener and performs no network I/O"; will replace `@opencode-ai/sdk` after consumers migrate (`packages/sdk-next/README.md:3-5`) | Transitional/experimental; created 2026-06-25 (commit `cdd67cf30`) |
| `packages/protocol` (private) | Shared HTTP contracts + tagged error types | Active foundation |
| `packages/httpapi-codegen` (private) | The codegen tool itself (Effect HttpApi → client code) | Active tooling |

Chronology (git): `packages/server` bootstrapped 2026-04-15 (`6706358a6`, "document extraction plan"); `packages/protocol` extracted 2026-06-04→06-25 (`56a37c364`); `client`/`sdk-next` added 2026-06-25 (`cdd67cf30`). Commit counts: server 72, client 15, protocol 9, sdk-next 7 — young, high-churn packages.

## 5. Auth, CORS, binding

- **AuthN:** optional HTTP **Basic auth**, enabled only when `OPENCODE_SERVER_PASSWORD` is set (`packages/server/src/auth.ts:20-50`); username defaults to `opencode` (`auth.ts:32`). Also accepted as `?auth_token=<base64>` query param for browser/WS cases (`packages/server/src/middleware/authorization.ts:9,30-32`). PTY WebSocket connect uses one-time tickets instead of headers (`authorization.ts:46-48`). `opencode serve` prints "Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured." (`packages/opencode/src/cli/cmd/serve.ts:15-17`).
- **AuthZ:** none beyond the single shared credential — no roles/scopes/multi-user (no such code found).
- **CORS:** allowlist — localhost/127.0.0.1 any port, Tauri/Electron origins, `*.opencode.ai`, plus `--cors` extras (`packages/server/src/cors.ts:11-26`); wired at `packages/opencode/src/server/routes/instance/httpapi/server.ts:289-294`.
- **Binding:** default `127.0.0.1` (`packages/opencode/src/cli/network.ts:14-15`); `--mdns` flips default to `0.0.0.0` (`network.ts:71-74`).
- **Rate limiting:** absent — repo-wide grep for rate-limit in server packages returned nothing.

## 6. Health, errors, correlation, idempotency

- **Health:** v2 `GET /api/health` → `{healthy: true}` (`packages/protocol/src/groups/health.ts:4-14`); v1 `GET /global/health` (openapi.json). No separate readiness endpoint. Version info: `/global/upgrade` exists; a dedicated version endpoint is `unverified` (some instance metadata routes exist in `.../groups/instance.ts`, not fully reviewed).
- **Structured errors:** yes on v2 — tagged error classes with fixed HTTP statuses: `InvalidRequestError` 400, `UnauthorizedError` 401, `ForbiddenError` 403, `*NotFoundError` 404, `ConflictError` 409, `UnknownError` 500 (with `ref` field), `ServiceUnavailableError` 503 (`packages/protocol/src/errors.ts:3-111`). Schema decode failures normalized by `schema-error` middleware (`packages/server/src/middleware/schema-error.ts`).
- **Request correlation:** partial — `UnknownError.ref` is generated server-side and logged with context (`packages/server/src/handlers/session.ts:318-324`; `errors.ts:41`). No `X-Request-ID` header echo/propagation found (grep negative).
- **Idempotency:** partial — client-supplied IDs on v2 session create (`session.ts:131`), prompt message ID (`session.ts:208`), permission create (`permission.ts:66`); prompt is "durably admitted" with `ConflictError` on clash (`session.ts:214`). No generic `Idempotency-Key` header mechanism.

## 7. FR gap table

| FR | Requirement | Verdict | Evidence |
|---|---|---|---|
| FR-022 | Session create + discover | **exists-as-is** | v1 `/session`, v2 `/api/session` (`protocol/groups/session.ts:129`); `/api/session/active` (`:146`); mDNS discovery opt-in (`server/mdns.ts`) |
| FR-023 | Sync + async prompt | **exists-as-is** | sync v1 `/session/{id}/message`; async v1 `/prompt_async` + v2 `/api/.../prompt` + `/wait` (`session.ts:205,241`) |
| FR-024 | Event streaming: token/message/tool/permission/status/lifecycle | **exists-as-is** (v2) | text/reasoning deltas, tool lifecycle, step lifecycle, status/idle (`schema/session-event.ts`, `session-status-event.ts`); permission/question events in manifest (`schema/event-manifest.ts:14-21`) |
| FR-025 | SSE primary transport | **exists-as-is** | 3 SSE endpoints (`server/handlers/event.ts:38-48`; `session.ts:358`; opencode `handlers/event.ts:69`) |
| FR-026 | History | **exists-as-is** | `/api/session/{id}/history` paged durable log (`protocol/groups/session.ts:307-325`); v1 `/session/{id}/message` GET |
| FR-027 | Cancel + resume | **exists-as-is** | `/api/.../interrupt` (`session.ts:345`); prompt `resume` flag (`session.ts:211`); replay via `after` |
| FR-028 | Permissions over API | **exists-as-is** | full v2 request/reply cycle (`protocol/groups/permission.ts:63-136`) |
| FR-029 | Tool progress + subagent events | **exists-partially** | `session.next.tool.progress` exists (`schema/session-event.ts`); dedicated subagent/child-session events `unverified` — v1 has `/session/{id}/children` + `fork` but no child-lifecycle event found |
| FR-030 | Structured errors / correlation / idempotency | **exists-partially** | tagged errors ✓ (`protocol/errors.ts`); correlation only via `UnknownError.ref`; idempotency only via client-supplied IDs; no request-ID header, no Idempotency-Key |
| FR-031 | AuthN/Z | **exists-partially** | optional single-credential Basic auth (`server/auth.ts:20-50`); no authz model, unsecured by default (`cli/cmd/serve.ts:15`) |
| FR-032 | Rate limiting | **absent** | no rate-limit code in server packages (grep negative) |
| FR-033 | Audit log | **absent** | grep "audit" in server packages negative; only Effect request logging/observability (`httpapi/server.ts:295` Observability.layer) |
| FR-034 | Health/ready/version | **exists-partially** | `/api/health`, `/global/health` ✓; no readiness distinction; version endpoint `unverified` |
| FR-035 | API versioning | **exists-partially** | de-facto v1 vs v2 (`/api` prefix, `v2.*` OpenAPI ids, sdk `/v2` export); no negotiated/header versioning; durable events carry a schema `version` int (`protocol/groups/event.ts:11`) |
| FR-036 | Backpressure/reconnect/ordering/dedup | **exists-partially** | ordering+reconnect via per-aggregate `seq` + `after` replay (v2 session stream only); bounded capacity 256 on v2 firehose; no SSE `Last-Event-ID`; v1 stream has no replay and unbounded queue; dedup relies on event `id`/`seq`, no explicit mechanism |

## 8. Stability assessment

| Capability | Assessment | Evidence |
|---|---|---|
| v1 instance API (`/session`, `/event`, ...) | stable-but-legacy | published `@opencode-ai/sdk` targets it; being superseded |
| v2 `/api/*` API | experimental | every group annotated "Experimental" (`protocol/src/api.ts:60`, group annotations); packages < 3 months old |
| Server listener (Effect rewrite) | recent, active churn | 72 commits on `packages/server`; extraction plan started 2026-04-15 |
| Durable event replay | experimental | v2-only, session-scoped |
| SDK chain client→sdk-next | in-flight replacement | `sdk-next/README.md:3`; both packages private, added 2026-06-25 |
| Auth/CORS | stable but minimal | Basic auth + origin allowlist only |
