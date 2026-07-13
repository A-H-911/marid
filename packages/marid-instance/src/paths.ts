import os from "node:os"
import path from "node:path"

// Marid instances live under ~/.marid/instances/<name>/ (0700 trees). MARID_HOME
// overrides the root — the hermetic lever for tests, mirroring OPENCODE_TEST_HOME.
export function maridHome(): string {
  return process.env.MARID_HOME ?? path.join(os.homedir(), ".marid")
}

export function instancesRoot(): string {
  return path.join(maridHome(), "instances")
}

export function instanceDir(name: string): string {
  return path.join(instancesRoot(), name)
}

// The instance's runtime record (name, port, pid, startedAt) + its server log.
export function instanceRecordFile(dir: string): string {
  return path.join(dir, "instance.json")
}
export function instanceLogFile(dir: string): string {
  return path.join(dir, "server.log")
}

// The XDG base roots opencode's Global.Path.* will resolve under, given the
// composed env. Kept here so the isolation suite asserts against the SAME roots
// the server writes to — one source of truth, no hand-copied path segments.
export interface InstancePaths {
  data: string
  cache: string
  config: string
  state: string
  tmp: string
}
export function instancePaths(dir: string): InstancePaths {
  return {
    data: path.join(dir, "data"),
    cache: path.join(dir, "cache"),
    config: path.join(dir, "config"),
    state: path.join(dir, "state"),
    tmp: path.join(dir, "tmp"),
  }
}

// The marid binary nests its app-name segment "marid" under each XDG root
// (packages/core/src/global.ts `const app` = "marid" via the P-6 build define /
// dev bootstrap). Expose the concrete files/dirs the isolation suite checks,
// derived once from instancePaths so a path change can't drift the token store
// away from where the server reads it. (Pre-P-6 this segment was "opencode".)
export function instanceDataDir(dir: string): string {
  return path.join(instancePaths(dir).data, "marid")
}
// Note: no instanceDbFile helper. The DB filename is channel-dependent
// (`opencode.db` on prod channels, `opencode-<channel>.db` otherwise — see
// packages/core/src/database/database.ts), so a hardcoded name would drift.
// XDG_DATA_HOME is what actually isolates the DB into instanceDataDir(dir); the
// live isolation test asserts the DB lands there rather than trusting a string.
// marid-auth's token store: `${Global.Path.data}/marid` (see marid/serve.ts
// maridDir()). With XDG_DATA_HOME = {dir}/data, that is {dir}/data/marid/marid.
export function instanceMaridDir(dir: string): string {
  return path.join(instanceDataDir(dir), "marid")
}

// The EXP-002-verified isolation env set. Composing these over the base env
// namespaces every filesystem row of the R-05 conflict inventory into `dir`:
//   XDG_DATA_HOME   -> DB, auth.json, mcp-auth.json, log, storage, snapshot, repos
//   XDG_CACHE_HOME  -> models.json cache, downloaded tool binaries ({cache}/bin)
//   XDG_CONFIG_HOME -> global opencode.json(c)
//   XDG_STATE_HOME  -> advisory locks dir
//   TMPDIR/TMP/TEMP -> os.tmpdir() (the one row no XDG_* relocates)
// The HTTP-port row is isolated by the OS-assigned `--port 0` at launch, not env.
// OPENCODE_DB is intentionally omitted: XDG_DATA_HOME already isolates the DB, and
// hand-building the path would drift from opencode's channel-suffix logic.
// Home is NOT relocated — real ~ reads (e.g. ~/.claude) are user intent, not
// instance state (EXP-002 home-read audit).
export function composeInstanceEnv(dir: string): Record<string, string> {
  const p = instancePaths(dir)
  return {
    XDG_DATA_HOME: p.data,
    XDG_CACHE_HOME: p.cache,
    XDG_CONFIG_HOME: p.config,
    XDG_STATE_HOME: p.state,
    TMPDIR: p.tmp,
    TMP: p.tmp,
    TEMP: p.tmp,
  }
}

// P-3 (marid distribution config default). The private distribution launches
// instances with language servers OFF by default: LSP adds startup latency and a
// process/footprint the channel-first workloads don't need out of the box. Delivered
// as an OPENCODE_CONFIG_CONTENT layer, which the server MERGES over the file config
// (packages/opencode/src/config/config.ts) rather than replacing it. Kept OUT of
// composeInstanceEnv on purpose: that set is per-instance path isolation (the
// paths suite asserts every value is instance-unique), and this is a global default.
// An operator who sets OPENCODE_CONFIG_CONTENT themselves keeps full control — we
// only supply the default when they haven't.
export function instanceConfigEnv(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  if (env.OPENCODE_CONFIG_CONTENT) return {}
  return { OPENCODE_CONFIG_CONTENT: JSON.stringify({ lsp: false }) }
}
