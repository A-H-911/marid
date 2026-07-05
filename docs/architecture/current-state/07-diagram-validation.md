---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# R-08: Validation of docs/diagrams/ (19 diagrams) against HEAD eb3476660

Method: each diagram's claims were taken from its JSON spec in `docs/diagrams/specs/`, cross-checked against the six current-state analyses in `docs/architecture/current-state/01..06` and, where those docs were silent or contradicted, against source at HEAD. Verdicts: ACCURATE / MINOR-DRIFT (cosmetic or naming) / OUTDATED (materially wrong claim) / UNVERIFIABLE.

## Verdict table

| # | Diagram | Verdict | Key issues |
|---|---------|---------|-----------|
| 01 | architecture-overview | ACCURATE | — |
| 02 | package-dependencies | MINOR-DRIFT | 5 missing dependency edges; `opencode→core` is dev-only |
| 03 | tech-stack | OUTDATED | "Hono + ws" listed under Server — Hono is gone from the main server |
| 04 | modules-map | MINOR-DRIFT | "llm (cache policy)" is not a `packages/opencode/src` module; misses newer dirs |
| 05 | data-flow | ACCURATE | — |
| 06 | session-sequence | MINOR-DRIFT | "POST session.run" is not a real route |
| 07 | database-er | MINOR-DRIFT | All shown tables verified; omits `message`, `part`, `session_context_epoch` |
| 08 | tui-seam | MINOR-DRIFT | Omits `cli/cmd/run/` TUI runtime files and `packages/cli` consumer from the DELETE set |
| 09 | tui-blast-radius | MINOR-DRIFT | Missing consumer: `packages/cli` depends on `tui` |
| 10 | streaming-pipeline | OUTDATED | Edit point 3 targets `server/projectors.ts`, an empty stub; topology projector→SSE wrong |
| 11 | streaming-sequence | MINOR-DRIFT | seq-replay exists only on the v2 per-session stream, not the generic SSE endpoint |
| 12 | boot-layers | ACCURATE | — |
| 13 | deployment | OUTDATED | "SQLite (per workspace)" — DB is one global file per machine |
| 14 | capability-registry | ACCURATE | — |
| 15 | session-lifecycle | ACCURATE | — |
| 16 | message-domain-model | OUTDATED | Part union missing at least 6 variants; source-of-truth path wrong |
| 17 | permission-flow | MINOR-DRIFT | Ask path mislabeled `question/`; "persist" ambiguous between v1 (in-memory) and v2 (DB) |
| 18 | contributor-workflow | ACCURATE | — |
| 19 | codegen-pipeline | ACCURATE | — |

Counts: ACCURATE 7, MINOR-DRIFT 8, OUTDATED 4, UNVERIFIABLE 0.

## Per-diagram notes (non-ACCURATE only)

### 02 package-dependencies — MINOR-DRIFT
Verified against the edge list in `01-package-inventory.md` §Dependency map. All drawn edges are real, but:
- Missing edges: `core→llm`, `client→core`, `app→schema`, and all three `session-ui→{core, sdk, ui}` (the `session-ui` node has no outgoing edges at all).
- `opencode→core` (edge d1) is a devDependency only (`packages/opencode/package.json`); drawn like a prod edge.
- Shows 19 packages; the workspace has ~30+ (cli, web, http-recorder, httpapi-codegen, codemode, storybook, slack, function, console/*, stats/* absent). The README's "25 `@opencode-ai/*` packages" caption also doesn't match either count. Acceptable as a curated subset, but the caption overstates coverage.

### 03 tech-stack — OUTDATED
- "Hono + ws" as a child of "Server": the main server is Effect `HttpRouter`/`httpapi` over Node `createServer` (`packages/opencode/src/server/server.ts:73,101,200`; see `02-server-api-sse-sdk.md` §1.1 — "The Hono server is gone", no hono dep in `packages/opencode/package.json`). Hono survives only in cloud packages `enterprise` and `function` (`packages/enterprise/package.json`, `packages/function/package.json`), which the "Server" grouping does not mean.
- ws is real but narrow: WebSockets are used only for PTY connect (`02-server-api-sse-sdk.md` §2).
- Everything else checks out, including Desktop = Electron (correct; the stale-Tauri problem in CLAUDE.md is NOT repeated here).

### 04 modules-map — MINOR-DRIFT
- "llm (cache policy)" under Providers: there is no `packages/opencode/src/llm/` directory (verified by listing); LLM request/cache logic lives in `packages/opencode/src/session/llm/` and the separate `packages/llm` package. Node points nowhere as drawn.
- "mcp-websearch" as a tool leaf is an odd conflation — `websearch` is a builtin tool (`tool/registry.ts`), MCP tools come via `mcp/`.
- Missing newer top-level dirs: `question/`, `share/`, `control-plane/`, `account/`, `patch/`, `format/`, `env/`. Tolerable for a tour mindmap.

### 06 session-sequence — MINOR-DRIFT
- Edge m2 "POST session.run": no such route. Real routes are v1 `POST /session/{id}/message` (sync prompt) and v2 `POST /api/session/{id}/prompt` (durable async) — `02-server-api-sse-sdk.md` §1.4/§3.
- Rest of the flow (persist user msg → provider stream → tool loop → persist parts → events → SSE) matches `04-runtime.md` §1.

### 07 database-er — MINOR-DRIFT
- All 12 drawn tables verified to exist at HEAD, including `permission` (`packages/core/src/permission/sql.ts:8`, PK + project_id + action + resource — note this contradicts `03-sessions-storage-sync.md`'s "permissions are not a table"; the table is the v2 saved-permission store, the per-session ruleset is still a JSON column), `project_directory` (`packages/core/src/project/sql.ts:21`), `account`/`credential` (`packages/core/src/account/sql.ts`, `credential/sql.ts`), `event`/`event_sequence` (`packages/core/src/event/sql.ts:4,10`).
- Omits the tables the live v1 path actually writes: `message` and `part` (`packages/core/src/session/sql.ts:68,82`), plus `session_context_epoch` and `account_state`. Omitting `message`/`part` while showing `session_message` misleads a newcomer about where messages live today (v1 message+part is the active path; `03-sessions-storage-sync.md` §1.2/§2).

### 08 tui-seam — MINOR-DRIFT
- All four DELETE nodes verified (`cli/cmd/tui.ts`, `packages/tui`, `plugin/tui/` incl. keybinds in `plugin/tui/runtime.ts:616`, 13 `/tui/*` routes per `02-server-api-sse-sdk.md` §1.4).
- Incomplete DELETE set: `cli/cmd/run/` contains TUI runtime files (`runtime.boot.ts`, `footer.*.tsx`, prompt/permission/question shared UI), and `packages/cli` also depends on `tui` (`01-package-inventory.md` edge `cli -> ... tui`). Diagram 09 covers `runtime.boot.ts` but 08's seam view doesn't.

### 09 tui-blast-radius — MINOR-DRIFT
- Consumers `cli/cmd/tui.ts`, `cli/cmd/run/runtime.boot.ts`, `plugin/tui/runtime.ts` all verified to exist. Deps below (`core`, `ui`, `plugin`, `sdk`) match `packages/tui/package.json` per `01-package-inventory.md`.
- Missing consumer: the `packages/cli` (`lildax`) package depends on `tui` — removing `tui` also breaks it.

### 10 streaming-pipeline — OUTDATED
- Edit point 3 "Projector (server/projectors.ts)": that file is a one-line empty stub — `export function initProjectors() {}` (`packages/opencode/src/server/projectors.ts:1`; the diagrams README even admits it is "still nascent"). The real projectors live in `packages/core/src/session/projector.ts` and are registered on event definitions, run inside `EventV2.publish` (`03-sessions-storage-sync.md` §3). A contributor following this diagram edits a dead file.
- Topology wrong: drawn as bus → projector → SSE. Actually the projector mutates the DB; SSE handlers subscribe to the bus directly (`packages/opencode/src/server/routes/instance/httpapi/handlers/event.ts:25-87`). The projector is not on the client-delivery path.
- Edit point 2 "Bus.publish" is legacy naming; durable events go through `EventV2` (`packages/core/src/event.ts`), bridged to the old GlobalBus by `event-v2-bridge.ts`.
- Edit points 1 (schema event) and 4 (client subscribe) are correct.

### 11 streaming-sequence — MINOR-DRIFT
- The append-with-`(aggregate_id, seq)` and reconnect-with-last-seq replay flow is real, but only on the v2 per-session stream `GET /api/session/{id}/event?after=<seq>` (`packages/protocol/src/groups/session.ts:327-342`). The generic SSE endpoints drawn have no replay: v2 `/api/event` is live-only, v1 `/event` has neither replay nor `Last-Event-ID` (`02-server-api-sse-sdk.md` §2). The diagram should scope the replay lane to the per-session stream.

### 13 deployment — OUTDATED
- "SQLite (per workspace)" is wrong: there is exactly one global DB per machine, `{xdg-data}/opencode/opencode.db` (per release channel, overridable via `OPENCODE_DB`) shared by all projects/workspaces and even concurrent instances (`packages/core/src/database/database.ts:43-55`; `05-config-observability.md` §5 multi-instance table). Per-workspace isolation does not exist and its absence is a documented conflict risk — the diagram asserts the opposite.
- Other elements verified: MCP stdio/remote subprocesses, LSP subprocess spawning, OTLP span export gated on `OTEL_EXPORTER_OTLP_ENDPOINT` (`05` §6).

### 16 message-domain-model — OUTDATED
- The Part union is far larger than the drawn 5 variants (text/reasoning/tool/file/step-start). The canonical schema also defines at least `snapshot`, `patch`, `agent`, `compaction`, `subtask`, `retry` (`packages/schema/src/v1/session.ts:87-220`). For a diagram captioned "read before touching rendering or storage", missing ~half the variants is material.
- Source-of-truth path in the title (`session/message-v2.ts`) is wrong: `message-v2.ts` consumes the part types; they are defined in `packages/schema/src/v1/session.ts` (mirrored in `packages/core/src/v1/session.ts`).
- Session/MessageV2 attribute boxes are fine.

### 17 permission-flow — MINOR-DRIFT
- The allow/deny/ask evaluation, reply once/always/reject, and reject-fails-the-tool-call shape all match `04-runtime.md` §3 (`permission/index.ts:28-167`).
- "Ask user (question/)" mislabels the mechanism: permission asks are a `Deferred` + `Event.Asked` published from `permission/index.ts:100`; `question/` is the separate agent-asks-user feature (`tool/question`, v2 question routes). Same UX, different module.
- "Save allow rule (persist)": on the v1 path "always" approvals live in an in-memory list for the session lifetime, not on disk (`permission/index.ts:145-151`; `04` §3). Persistence to the `permission` DB table exists only via the v2 saved-permission API (`packages/core/src/permission/sql.ts`, `protocol/groups/permission.ts`). The unqualified "persist" overstates the v1 flow the diagram depicts.

## Cross-cutting observations

- The known staleness signals were checked in every diagram: no diagram repeats the Tauri-desktop error (03 correctly says Electron), none references `desktop-electron`, none confuses `packages/web` with the web UI, and none draws the removed Hono listener except tech-stack (03). The v1-vs-v2 API split and sdk→sdk-next replacement chain are simply not depicted anywhere — the diagrams draw a single undifferentiated "HTTP API/SDK", which is a simplification rather than an error, but 10/11 inherit confusion from it.
- The diagrams README itself has two stale captions: "the 25 `@opencode-ai/*` packages" (count doesn't match either the diagram's 19 nodes or the workspace's ~30), and its Tarseem repo link is a placeholder (`https://github.com/`).
