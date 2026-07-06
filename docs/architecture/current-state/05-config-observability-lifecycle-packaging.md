---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# OpenCode Current State: Config, Secrets, Caching, Lifecycle, Observability, Packaging

Research track R-05. Findings only, no decisions. All paths relative to repo root; `path:line` cites branch `dev` as of 2026-07-03.

## 1. Base directories (XDG)

Defined once in `packages/core/src/global.ts:10-31` via the `xdg-basedir` package:

| Purpose | Path (Linux default) | Source |
|---|---|---|
| data | `$XDG_DATA_HOME/opencode` (`~/.local/share/opencode`) | global.ts:11 |
| cache | `$XDG_CACHE_HOME/opencode` (`~/.cache/opencode`) | global.ts:12 |
| config | `$XDG_CONFIG_HOME/opencode` (`~/.config/opencode`) | global.ts:13 |
| state | `$XDG_STATE_HOME/opencode` (`~/.local/state/opencode`) | global.ts:14 |
| tmp | `os.tmpdir()/opencode` | global.ts:15 |
| bin (downloaded tools) | `{cache}/bin` | global.ts:22 |
| log | `{data}/log` | global.ts:23 |
| repos | `{data}/repos` | global.ts:24 |

All are created eagerly at module load (`global.ts:35-43`). On Windows, `xdg-basedir` falls back to home-relative defaults (unverified exact Windows resolution). `OPENCODE_TEST_HOME` overrides home (`global.ts:19`); `OPENCODE_CONFIG_DIR` overrides the config dir (`global.ts:64`, `packages/core/src/flag/flag.ts:63-65`).

## 2. Configuration

### Formats and locations
- JSON and JSONC. Global: `{config}/config.json`, `{config}/opencode.json`, `{config}/opencode.jsonc` (`packages/opencode/src/config/config.ts:139-147, 258-260`). A default global file with `$schema` is seeded on first run (`config.ts:250-257`).
- Legacy TOML `{config}/config` is migrated to `config.json` then deleted (`config.ts:262-276`).
- Project: `opencode.jsonc`/`opencode.json` found by walking up from cwd to the worktree root (`packages/opencode/src/config/paths.ts:10-21`).
- `.opencode/` directories (project-up-tree, home, plus `OPENCODE_CONFIG_DIR`) contribute `opencode.json(c)` plus markdown-defined commands/agents/plugins (`paths.ts:23-41`, `config.ts:423-465`).

### Precedence (deep merge, later wins; `instructions` arrays are concatenated, `config.ts:45-51`)
Assembled in `Config.loadInstanceState` (`config.ts:313-500+`), in this order:
1. Remote "well-known" configs pulled for each `wellknown` entry in auth.json (`config.ts:355-395`).
2. Global config files (`config.ts:397-398`).
3. `OPENCODE_CONFIG` env-pointed file (`config.ts:400-403`, flag at `flag.ts:21`).
4. Project `opencode.json(c)` walking up the tree (`config.ts:405-409`), unless `OPENCODE_DISABLE_PROJECT_CONFIG` (`flag.ts:54-56`).
5. `.opencode` directory configs + markdown commands/agents/plugins (`config.ts:423-465`).
6. `OPENCODE_CONFIG_CONTENT` env var (inline JSON) (`config.ts:467-475`, flag.ts:22).
7. Console/org managed config fetched from the active account's control plane (`config.ts:477-500`).

### Env handling and validation
- Central env-flag registry: `packages/core/src/flag/flag.ts:15-78` (`OPENCODE_*` and `OTEL_*` vars).
- Config text supports `{env:VAR}` and `{file:path}` substitution before parsing (`packages/opencode/src/config/variable.ts:33-70`).
- Validation: parsed JSONC is decoded against the Effect Schema `ConfigV1.Info` (`config.ts:226-227`); schema types live in `packages/core/src/config/*` and `packages/core/src/v1/config/*`. `packages/schema` is a separate small package of shared Effect schemas (`packages/schema/package.json:3-16`), e.g. `installation-event.ts` — it is not the main config schema.
- Self-export pattern: each config module re-exports itself, e.g. `export * as ConfigPaths from "./paths"` (`paths.ts:1`), `export * as ConfigVariable from "./variable"` (`variable.ts:1`), `export * as TuiConfig from "./tui"` (`tui.ts:1`).
- TUI config is a parallel loader with its own merge (`packages/opencode/src/config/tui.ts`), overridable via `OPENCODE_TUI_CONFIG` (`flag.ts:60-62`).

## 3. Secrets

- Provider credentials are stored in a plain JSON file: `{data}/auth.json`, written with mode `0o600` (`packages/opencode/src/auth/index.ts:10, 73-89`). No OS keychain use found.
- Entry types: `oauth` (refresh/access/expires), `api` (key), `wellknown` (key+token) (`auth/index.ts:14-35`).
- `OPENCODE_AUTH_CONTENT` env var can replace the file entirely (`auth/index.ts:59-63`).
- MCP OAuth tokens are stored separately in `{data}/mcp-auth.json` (`packages/opencode/src/mcp/auth.ts:37`).
- Flow to providers: `packages/opencode/src/provider/provider.ts` reads `Auth` entries and injects them as SDK `apiKey` or `Authorization: Bearer` headers per provider (e.g. provider.ts:530, 605-627, 738-743, 864); providers also autoload from env vars advertised by the models.dev catalog (`env` list, `packages/core/src/models-dev.ts:104`).
- Redaction: no redaction layer found in the main logging pipeline (`packages/core/src/observability/logging.ts` formats whatever is passed). Redaction code exists only in `packages/http-recorder` (URL/header redaction, `packages/http-recorder/test/record-replay.test.ts:65-93`) and path redaction in `packages/codemode/src/codemode.ts:616`. Whether API keys can reach log lines in practice: unverified (no counter-example found, but nothing enforces it).

## 4. Caching

| Cache | Location | Source |
|---|---|---|
| models.dev catalog | `{cache}/models.json` (or `models-{hash}.json` for custom `OPENCODE_MODELS_URL`), 5-min TTL, atomic tmp-file rename, guarded by a Flock key `models-dev:{path}` | `packages/core/src/models-dev.ts:138-190` |
| skills | `{cache}/skills` | `packages/opencode/src/skill/discovery.ts:35` |
| downloaded tool binaries (LSP servers, gopls, clangd, zls, jdtls, elixir-ls, rubocop, fsautocomplete...) | `{cache}/bin` | `packages/opencode/src/lsp/server.ts:180-1200` |
| cloned repos | `{data}/repos` | global.ts:24 |
| snapshot git dirs (per project/worktree) | `{data}/snapshot/{projectID}/{hash(worktree)}` | `packages/opencode/src/snapshot/index.ts:71` |
| managed worktrees | `{data}/worktree/{projectID}` | `packages/opencode/src/worktree/index.ts:208` |
| blob/file storage | `{data}/storage` | `packages/opencode/src/storage/storage.ts:224` |
| baked-in model snapshot | `OPENCODE_MODELS_DEV` compile-time define (fallback when offline) | models-dev.ts:114, 176-178; `packages/opencode/script/build.ts:192` |

`opencode uninstall` deletes data/cache/state dirs (`packages/opencode/src/cli/cmd/uninstall.ts:92-95`).

## 5. Process / instance lifecycle

- **Server port**: `Server.listen` prefers 4096, then falls back to any free port when the requested port is `0` (`packages/opencode/src/server/server.ts:117-122`). Clients default to `http://localhost:4096` (`packages/opencode/src/cli/cmd/attach.ts:14`, `packages/opencode/src/plugin/index.ts:143,160`). Optional mDNS publish for non-loopback hosts (`server.ts:155-170`). Basic auth via `OPENCODE_SERVER_USERNAME/PASSWORD` env (`flag.ts:32-33`).
- **Database**: single global SQLite file `{data}/opencode.db` (per release channel: `opencode-{channel}.db` for non-prod channels), overridable via `OPENCODE_DB` (`packages/core/src/database/database.ts:43-55`). Opened with WAL + `busy_timeout=5000` (`database.ts:27-32`), so concurrent readers/writers are tolerated at the SQLite level.
- **Locks**: directory-based advisory locks under `{state}/locks` — lockdir + `meta.json` (pid, hostname, token) + heartbeat file, stale detection at 60s, exponential backoff, breaker dir for stale cleanup (`packages/core/src/util/flock.ts:19-30, 148-272`; root wired at `global.ts:33`). Used by config, plugin install, MCP auth, models cache (`packages/opencode/src/plugin/install.ts`, `mcp/auth.ts`, `config/config.ts`, `models-dev.ts:144`). No global PID file or single-instance lock found.
- **No unix sockets / named pipes found**; IPC is HTTP on TCP (unverified there are no others; none surfaced in search).
- **Temp**: shared `os.tmpdir()/opencode` (`global.ts:15`); models cache writes use pid+timestamp-suffixed temp names (`models-dev.ts:182`).
- **MCP children**: local MCP servers spawned via `StdioClientTransport` with cwd = instance directory and merged env (`packages/opencode/src/mcp/index.ts:339-349`); descendants tracked via `pgrep -P` walk on POSIX (returns `[]` on Windows) (`mcp/index.ts:410-432`); connection close handlers update status (`mcp/index.ts:434-447`).
- **LSP children**: spawned per server definition in `packages/opencode/src/lsp/server.ts` (e.g. :102-127, :148-211), with binaries auto-downloaded into the shared `{cache}/bin`.
- **Shutdown**: server stop closes the Effect scope + force-closes websockets (`server.ts:172-181`); the CLI ends with an unconditional `process.exit()` in a `finally` block explicitly to kill hung MCP subprocesses (`packages/opencode/src/index.ts:136-142`). No graceful drain of child processes beyond scope finalizers found.

### Multi-instance conflict inventory (what is shared on one machine today)

| Resource | Path | Conflict behavior with 2 instances |
|---|---|---|
| HTTP port 4096 | TCP | Second instance silently falls back to a random free port (`server.ts:121`) — works, but clients that assume 4096 (`attach.ts:14`, `plugin/index.ts:143`) hit the wrong instance. |
| SQLite DB | `{data}/opencode.db` | Shared. WAL + busy_timeout mitigates, but both instances read/write the same sessions/projects DB (`database.ts:43-55`). Isolation only via `OPENCODE_DB` env. |
| auth.json | `{data}/auth.json` | Read-modify-write with no Flock (`auth/index.ts:73-89`) — concurrent `set` calls can lose writes (last writer wins). |
| mcp-auth.json | `{data}/mcp-auth.json` | Shared; this one does use Flock (`mcp/auth.ts`). |
| Global config | `{config}/opencode.json(c)` | Shared; `updateGlobal` writes it (unverified locking discipline; `EffectFlock` is imported in config.ts:23). |
| Log file | `{data}/log/opencode.log` | Both append to one file; lines carry a per-process `runID` so they interleave but are attributable (`logging.ts:49-52`). |
| models.dev cache | `{cache}/models.json` | Flock-guarded + atomic rename — safe (`models-dev.ts:144, 180-190`). |
| Tool binaries | `{cache}/bin` | Concurrent LSP downloads/extracts to same paths are not obviously locked (unverified) — potential torn installs. |
| Locks dir | `{state}/locks` | By design shared; cross-instance mutual exclusion works via heartbeat/stale logic. |
| Temp dir | `{tmp}` = `os.tmpdir()/opencode` | Shared; individual files are pid-suffixed where it matters. |
| Snapshot/worktree/storage dirs | `{data}/snapshot`, `{data}/worktree`, `{data}/storage` | Keyed by project ID — two instances on the *same project* share them; different projects do not collide. |

**Summary answer**: two independent instances mostly run today because of port fallback, WAL SQLite, and the Flock layer — but they are *not isolated*: they share one DB, one auth store, one config, one log, one cache. The concrete breakage risks are: port-4096 assumption in attach/plugin defaults, lost writes to `auth.json`, and unlocked shared `{cache}/bin` installs.

## 6. Observability

- **Logging**: Effect `Logger` with a custom key=value structured formatter; always writes to `{data}/log/opencode.log` (append), plus stderr when `OPENCODE_PRINT_LOGS=1` (`packages/core/src/observability/logging.ts:49-69`). Level via `OPENCODE_LOG_LEVEL` (default INFO) (`logging.ts:56-65`). Each process gets a `runID` stamped on every line (`logging.ts:12`).
- **OpenTelemetry — verified wired, opt-in**: if `OTEL_EXPORTER_OTLP_ENDPOINT` is set (`flag.ts:16-17`), an OTLP logger (`{endpoint}/v1/logs`) and an OTLP trace exporter (`{endpoint}/v1/traces`, BatchSpanProcessor via `@effect/opentelemetry` NodeSdk) are installed, with resource attrs `service.name=opencode`, channel, client, runID (`packages/core/src/observability/otlp.ts:50-77`; assembled in `packages/core/src/observability.ts:11-24`). Effect spans (`Effect.fn`, `Effect.withSpan`) throughout the codebase feed this. Without the env var, both are no-ops (`otlp.ts:51,56`).
- **Metrics**: no metrics exporter found (no `/v1/metrics`, no OTel MeterProvider). unverified beyond search.
- **packages/stats**: does not exist. There is a `stats` CLI command (`packages/opencode/src/cli/cmd/stats.ts`, local usage stats) and a `.github/workflows/stats.yml` workflow.
- **Sentry**: used in web/desktop builds only (publish.yml:330-336), not in the CLI runtime (unverified for desktop internals).

## 7. Packaging / build / release

- **Build**: `packages/opencode/script/build.ts` — Bun `compile` of `src/index.ts` into standalone binaries for 12 targets (linux/darwin/win32 × arch × musl/baseline) (`build.ts:53-135, 168-199`). `--single` builds only the current platform/arch (`build.ts:116-135`). Embeds the web UI (`build.ts:27-51`), the models.dev snapshot, version and channel as compile-time defines (`build.ts:189-198`). `Script.release` uploads zips/tarballs to the GitHub release (`build.ts:232-241`).
- **Release pipeline**: `.github/workflows/publish.yml` — triggered on pushes to `dev`/`beta`/etc. or manual dispatch with bump/version (publish.yml:4-26): version job → build-cli → Azure Trusted Signing of Windows exes (publish.yml:120-218) → Electron desktop builds per-OS with Apple notarization (publish.yml:220-406) → `script/publish.ts` which pushes npm, Docker (ghcr), AUR, and desktop `latest*.yml` update feeds (publish.yml:408-521).
- **Install channels**: detected at runtime in `packages/opencode/src/installation/index.ts:18` — `curl | npm | yarn | pnpm | bun | brew | scoop | choco` (curl detected by exec path under `.opencode/bin` or `.local/bin`, installation/index.ts:175-176). A repo-root `install` shell script exists for the curl channel. Homebrew formula `anomalyco/tap/opencode` (`installation/index.ts:126-131`).
- **Auto-update**: on startup (`packages/opencode/src/cli/upgrade.ts:8-53`): disabled by config `autoupdate: false` or `OPENCODE_DISABLE_AUTOUPDATE` (`upgrade.ts:10`, flag.ts:23); patch releases self-upgrade in place via the detected install method; minor/major (or `autoupdate: "notify"`) only emit an `UpdateAvailable` event (`upgrade.ts:28-42`). Desktop apps use electron-builder `latest*.yml` feeds (publish.yml:402-406, 519).
- **Release channels**: `InstallationChannel` compile-time define (`build.ts:195`); non-prod channels get their own DB file (`database.ts:48-54`).
