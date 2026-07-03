---
artifact: current-state-sessions
status: Draft
version: v0.1
updated: 2026-07-03
---

# R-03: Sessions, Storage, and Cross-Client Sync — Current State

Scope: `packages/opencode` + `packages/core`, branch `dev`. Findings only, no decisions.

## 1. Session storage

### 1.1 Where data lives

- Primary store is a single SQLite database at `<xdg-data>/opencode/opencode.db` (or `opencode-<channel>.db` for non-release channels, overridable via `OPENCODE_DB`): `packages/core/src/database/database.ts:43-55`; data dir from xdg-basedir: `packages/core/src/global.ts:11-24`.
- Opened via Drizzle through `@opencode-ai/effect-drizzle-sqlite` (`packages/core/src/database/database.ts:13`), with runtime-conditional SQLite driver `#sqlite` (`database.ts:4`; `sqlite.bun.ts` / `sqlite.node.ts` in `packages/core/src/database/`). `packages/opencode` also has a `#db` conditional import mapping to `src/storage/db.bun.ts`/`db.node.ts` in `packages/opencode/package.json:24-29`, but those files do not exist on disk (stale mapping; `unverified` whether any code still resolves it).
- Pragmas set at open: WAL, `synchronous=NORMAL`, `busy_timeout=5000`, `foreign_keys=ON` (`database.ts:27-32`).
- A legacy JSON-file store (`<data>/storage/**/*.json`, per-file `TxReentrantLock`) still exists with its own file-based migrations: `packages/opencode/src/storage/storage.ts:81-211,224`. Still consumed by e.g. CLI session/stats, control-plane workspace, revert, message-v2 (`grep Storage.Service` hits in `packages/opencode/src/cli/cmd/session.ts`, `src/session/revert.ts`, `src/session/message-v2.ts`).

### 1.2 Schema (Drizzle, SQLite)

`packages/core/src/session/sql.ts`:
- `session` (:22-66): id, project_id (FK cascade), workspace_id, parent_id (branching), slug, directory, title, share_url, summary_*, cost/token counters, `revert` JSON, `permission` JSON ruleset, agent, model JSON, timestamps, `time_compacting`, `time_archived`.
- `message` (:68-80): id, session_id FK cascade, JSON `data` blob (v1 message minus ids).
- `part` (:82-98): id, message_id FK cascade, session_id, JSON `data`.
- `todo` (:100-117): per-session todo list, PK (session_id, position).
- `session_message` (:119-138): v2 unified message log with per-session unique `seq`.
- `session_input` (:140-166): admitted prompts with `delivery` (`steer`/`queue`), `admitted_seq`, `promoted_seq` — the prompt queue.
- `session_context_epoch` (:168-176): system-context snapshot + baseline seq.

Other tables re-exported in `packages/opencode/src/storage/schema.ts:1-5`: Account/AccountState/ControlAccount, `project`, `session_share`, `workspace`. Event log: `event_sequence` + `event` (per-aggregate monotonic `seq`, `owner_id`; JSON payload) in `packages/core/src/event/sql.ts:4-25`. Permissions are not a table; they live as a JSON `permission` column on `session` (`sql.ts:50`) plus permission events.

### 1.3 Migrations

- SQL migrations are generated modules applied at DB open under a semaphore: fresh DB runs `schema.gen` and marks all migrations complete; existing DB (detected by `session` table) applies pending `migrations` from `migration.gen.ts` recorded in a `migration` table (`packages/core/src/database/migration/migration.ts:17-42`).
- Separate legacy JSON storage migrations tracked by a `migration` marker file (`packages/opencode/src/storage/storage.ts:76-79,222-243`).

## 2. Session lifecycle

Two overlapping stacks exist:
- **Active v1 stack**: `packages/opencode/src/session/session.ts` (CRUD) + `prompt.ts` (loop) + `run-state.ts` (busy/cancel).
- **v2 stack (partially wired)**: `packages/core/src/session/` — `SessionInput` queue, `SessionRunCoordinator`, `SessionRunner`, `SessionExecution` (`execution/local.ts`), wired into the HTTP server layer (`packages/opencode/src/server/routes/instance/httpapi/server.ts:67-68,303`). How much of the live prompt path routes through it is `unverified`; the v1 `SessionPrompt.loop` is what the HTTP session handlers call (`handlers/session.ts:291,300-316`).

Key operations (all mutations are event-sourced — publish first, projector mutates DB):
- **Create**: `Session.create` publishes `session.created` (`session.ts:537`); projector inserts row (`packages/core/src/session/projector.ts:215`).
- **Prompt**: HTTP `prompt`/`promptAsync` → `SessionPrompt.prompt` writes the user message, then `loop` (`prompt.ts:1052-1071`). `loop` = `state.ensureRunning(sessionID, ..., runLoop)` (`prompt.ts:1342-1346`).
- **Streaming**: assistant deltas published as `PartDelta`/`PartUpdated` events (`session.ts:886,639`), consumed by clients via the event stream (section 3).
- **Loop**: `runLoop` re-reads messages every iteration, handles subtasks, auto-compaction on overflow, exits when last assistant finished with no pending tool calls (`prompt.ts:1081-1168`).
- **Cancel/abort**: HTTP `abort` → `promptSvc.cancel` (`handlers/session.ts:232-233`); `SessionRunState.cancel` interrupts the runner fiber and cascades cancel to background jobs by session id (`run-state.ts:77-86,111-143`).
- **Resume**: TUI `--continue`/`--session` re-opens a session by reading state; no generation resume (`packages/opencode/src/cli/cmd/tui.ts:248-291`).
- **Fork/branch**: `Session.fork` creates a new session and clones messages/parts up to an optional messageID, remapping ids (`session.ts:693-731`); `parent_id` column supports child sessions (`sql.ts:31`); fork titles get "(fork #n)" (`session.ts:162-168`).
- **Compaction**: `packages/opencode/src/session/compaction.ts` — a dedicated `compaction` agent summarizes (`:328`), prune thresholds `PRUNE_MINIMUM`/`PRUNE_PROTECT` (`:28-29`), config `compaction.preserve_recent_tokens` / `tail_turns` (`:82,193`); triggered automatically on token overflow (`prompt.ts:1161-1168`).
- **Error recovery in-loop**: orphaned interrupted tool parts marked and tolerated on loop exit (`prompt.ts:97-99,1106-1127`); `revert.cleanup` runs before each prompt (`prompt.ts:1056`); retry logic in `src/session/retry.ts`.

## 3. Event bus

Three layers:
1. **EventV2 (core, durable + live)**: `packages/core/src/event.ts`. `publish` writes durable events to the `event` table with per-aggregate `seq` (definitions with `durable` metadata; `event.ts:205-231`), runs registered `project(...)` projectors (session projectors: `packages/core/src/session/projector.ts:215-379`), and fans out on in-process Effect `PubSub`s (`event.ts:174-191`). Also supports `replay`/`replayAll`/`claim`/`remove` for sync (`event.ts:126-148`).
2. **GlobalBus (process-wide EventEmitter)**: `packages/opencode/src/bus/global.ts:11-22` — bridge target. `EventV2Bridge` re-emits every EventV2 event onto GlobalBus, tagging directory/project/workspace, and additionally emits a `"sync"` wrapper for durable events carrying `{id, type, seq, aggregateID, data}` (`packages/opencode/src/event-v2-bridge.ts:35-62`).
3. **Client transport**: HTTP `GET /event` SSE stream. Handler subscribes to EventV2, filters by instance directory/workspace, emits `server.connected`, 10s heartbeats, and terminates on `server.instance.disposed` (`packages/opencode/src/server/routes/instance/httpapi/handlers/event.ts:25-99`). So yes — events cross process boundaries server→clients via SSE, and multiple clients can subscribe concurrently (each gets its own queue, `event.ts:152-164` bounded variant; SSE handler uses unbounded queue `handlers/event.ts:31`).

Taxonomy: enumerable via `EventManifest.Definitions` (`packages/schema/src/event-manifest.ts:57-83`) — session v1 events (created/updated/deleted/diff/error, message/part updated/removed/delta), SessionEvent v2 (PromptAdmitted, Prompted, Moved, AgentSwitched, ModelSwitched, ContextUpdated, Synthetic, Shell.*), plus permission, question, todo, file/FS-watcher, LSP, PTY, MCP, installation, project, workspace, worktree, VCS, server, TUI event families.

Legacy `Bus` naming survives in docs (`packages/opencode/src/sync/README.md`) describing the SyncEvent design: single-writer event sourcing with total ordering by per-aggregate sequence number.

## 4. TUI <-> server relationship

- The TUI (`packages/tui`, SolidJS) always talks the HTTP API shape via the generated SDK (`createOpencodeClient({ baseUrl ... })`, `packages/tui/src/context/sdk.tsx:24-28`).
- In default `opencode` TUI mode the server runs in a Worker thread of the same process; transport is an in-process RPC bridge faking fetch (`url: "http://opencode.internal"`, `createWorkerFetch`, `createEventSource` over RPC `"global.event"`): `packages/opencode/src/cli/cmd/tui.ts:210-245`. With `--port`/`--hostname`/mdns it switches to a real HTTP URL + auth headers (`tui.ts:230-240`), and `opencode serve` exposes the same API standalone.
- Live updates: the TUI subscribes to the full event stream (`packages/tui/src/context/event.ts:9-30`, filtering out `"sync"` envelope events) and its data/sync contexts apply `session.updated`, message/part events, etc. So a session modified by another client of the **same server instance** does live-update in the TUI. Two independent processes (two `opencode` TUIs in separate terminals) each have their own server worker but share the same SQLite file (WAL + busy_timeout); there is no cross-process event push between them — one TUI will not see the other's live events (`unverified` for any mdns/attach path).

## 5. Concurrency today

- Per-session in-memory runner: `SessionRunState` keeps a `Map<SessionID, Runner>` (`packages/opencode/src/session/run-state.ts:38,52-69`) with busy/idle status published as session status events (`run-state.ts:62-64`).
- **Two simultaneous prompts, one session**: the second prompt's user message is written immediately; `ensureRunning` on a `Running` runner *joins* the existing run rather than starting a new one (`packages/opencode/src/effect/runner.ts:115-129`); the active loop re-reads messages each iteration (`prompt.ts:1092`), so the new message is picked up — de-facto steering. No explicit rejection.
- **"Session is busy"**: `Session.BusyError` (`session.ts:409-411`) is raised by `assertNotBusy` / shell start when a runner is active (`run-state.ts:71-75,96-105`), mapped to an HTTP `SessionBusyError` (`httpapi/handlers/session-errors.ts:10-14`, `httpapi/errors.ts:116`). Applies to shell/revert paths, not the normal prompt path.
- **v2 queueing (built, partially live)**: `session_input` rows with `delivery: "steer" | "queue"` and admitted/promoted sequence numbers (`packages/core/src/session/input.ts:41-116`); the v2 runner promotes steers mid-run and next queued item after a run (`packages/core/src/session/runner/llm.ts:185-188,382-398`); `SessionRunCoordinator` serializes execution per session with coalesced wake-ups and interrupt (`packages/core/src/session/run-coordinator.ts:5-104`); idempotent admission and `LifecycleConflict` optimistic checks (`input.ts:37-39,100,115,144-152`).
- Storage-level: per-file reentrant RW locks in the legacy JSON store (`storage.ts:218-221,266-299`); SQLite relies on WAL + busy timeout.

## 6. Recovery after process restart

- **Survives**: everything projected to SQLite — sessions, messages, parts (including partial assistant messages/parts written during streaming), todos, admitted `session_input` rows, the durable event log, context epochs.
- **Lost**: in-memory runner state (`run-state.ts:38` Map), in-flight LLM stream, permission prompts in flight, background jobs. No startup code found that resumes an interrupted run or drains pending `session_input` on boot (searched for startup drain; none found — `unverified` beyond search). `SessionExecution.resume`/`wake` exist (`execution/local.ts:31-36`) but no boot-time caller was found.
- On next prompt, `revert.cleanup` and orphaned-interrupted-tool marking normalize the dangling assistant/tool state (`prompt.ts:97-99,1056,1117-1127`). TUI `--continue` reattaches to the stored session.

## 7. Retention / deletion / export

- **Deletion**: `Session.remove` recursively removes children, publishes `session.deleted`, and deletes the aggregate's durable events (`session.ts:608-629`); DB FKs cascade message/part/todo/input rows (`sql.ts:75,89,106`). Per-message/part removal also exists (`session.ts:855-871`).
- **Archival**: `time_archived` column + `setArchived` (`sql.ts:59`, `session.ts:760`); list excludes archived by default (`session.ts:564`).
- **Export/import**: CLI `opencode export [sessionID]` dumps `{info, messages}` JSON with optional redaction (`packages/opencode/src/cli/cmd/export.ts:222-289`); `opencode import <file>` restores from JSON or share URL (`cli/cmd/import.ts:84-88`). Sharing via `session_share` table + `share_url`.
- **Retention policy**: none found — no TTL, pruning, or size-based cleanup of sessions or the event log ("prune" hits are compaction/token pruning only).

## 8. Gap analysis vs targets

| FR | Target | Verdict | Evidence / gap |
|----|--------|---------|----------------|
| FR-038 | Cross-interface consistency | **Partial** | All clients of one server instance share one SQLite store and one SSE/RPC event stream (`handlers/event.ts:25-99`). But two separate TUI processes share the DB file without sharing live events; legacy JSON store still holds some state (revert, CLI stats), so not one consistent surface. |
| FR-039 | Authoritative store + identity mapping | **Partial** | SQLite is authoritative with event-sourced writes and per-aggregate seq (`event/sql.ts`, `projector.ts`). Identity mapping exists per project/workspace (`sql.ts:26-30`, `event_sequence.owner_id`), but dual v1/v2 message tables (`message`+`part` vs `session_message`) and residual JSON storage mean no single canonical model yet. |
| FR-040 | Concurrency / queueing / ordering | **Partial** | v2 has real queueing: `session_input` steer/queue with admitted/promoted seq (`input.ts:41-288`) and per-session serialized coordinator (`run-coordinator.ts`). Active v1 path only joins-or-runs (`runner.ts:115-129`) with implicit steering; no user-visible queue on the live path (`unverified` how far v2 is enabled). |
| FR-041 | Ownership / locking / conflict | **Partial** | Single-writer ownership exists: `event_sequence.owner_id`, `claim`, `strictOwner` replay, and a `steal` endpoint reassigning a session's workspace (`handlers/sync.ts:61-70`, `event.ts:147`). Conflict detection is `LifecycleConflict` on projection (`input.ts:37-39`). No general session-level lock or conflict resolution for two writers on one DB. |
| FR-042 | TUI live subscription | **Exists** | TUI subscribes to the full event stream (in-process RPC or SSE) and live-applies session/message/part events (`tui.ts:242-245`, `tui/src/context/event.ts:9-30`) — within one server instance. |
| FR-043 | Restart recovery + disconnect behavior | **Partial** | Durable state survives (SQLite, WAL); SSE has heartbeat + `server.instance.disposed` termination (`handlers/event.ts:60-66`). No resume of interrupted runs and no boot-time drain of pending inputs; dangling state is only repaired lazily on next prompt (`prompt.ts:1056,1117-1127`). |
| FR-044 | Retention / archival / export / deletion | **Partial** | Archival flag, recursive delete with cascades, JSON export/import CLI all exist (section 7). No retention policy, no event-log pruning, no scheduled archival. |

## Open questions (unverified)

- Whether any code path still resolves the stale `#db` import mapping (`packages/opencode/package.json:25-29`).
- Exact activation status of the v2 runner (`SessionRunner`/`SessionExecution`) on the default prompt path vs the v1 `SessionPrompt.loop`.
- Cross-process behavior when two TUIs open the same project (shared DB, separate event buses).
