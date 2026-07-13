import { describe, expect, test } from "bun:test"
import path from "node:path"
import {
  composeInstanceEnv,
  instanceConfigEnv,
  instanceDataDir,
  instanceDir,
  instanceMaridDir,
  instancePaths,
  instancesRoot,
} from "../src/paths"

const DIR = path.join("/marid-root", "instances", "work")

// Every filesystem row of the R-05 conflict inventory
// (docs/architecture/current-state/05-config-observability-lifecycle-packaging.md,
// as confirmed by EXP-002) must be isolated into the instance tree by the env
// composition. Each row names the resource and the env var that relocates it, so
// a regression that drops a lever fails against the specific row it broke. Row 1
// (HTTP port) is isolated by the OS-assigned `--port 0` at launch, not by env —
// it is proven in lifecycle.test.ts by two instances binding distinct ports.
const R05_ROWS: Array<{ row: number; resource: string; envVar: keyof ReturnType<typeof composeInstanceEnv>; base: keyof ReturnType<typeof instancePaths> }> = [
  { row: 2, resource: "SQLite DB ({data}/opencode.db)", envVar: "XDG_DATA_HOME", base: "data" },
  { row: 3, resource: "auth.json ({data}/auth.json)", envVar: "XDG_DATA_HOME", base: "data" },
  { row: 4, resource: "mcp-auth.json ({data}/mcp-auth.json)", envVar: "XDG_DATA_HOME", base: "data" },
  { row: 5, resource: "global config ({config}/opencode.json)", envVar: "XDG_CONFIG_HOME", base: "config" },
  { row: 6, resource: "log file ({data}/log/opencode.log)", envVar: "XDG_DATA_HOME", base: "data" },
  { row: 7, resource: "models.dev cache ({cache}/models.json)", envVar: "XDG_CACHE_HOME", base: "cache" },
  { row: 8, resource: "tool binaries ({cache}/bin)", envVar: "XDG_CACHE_HOME", base: "cache" },
  { row: 9, resource: "locks dir ({state}/locks)", envVar: "XDG_STATE_HOME", base: "state" },
  { row: 10, resource: "temp (os.tmpdir()/opencode)", envVar: "TMPDIR", base: "tmp" },
  { row: 11, resource: "snapshot/worktree/storage ({data}/...)", envVar: "XDG_DATA_HOME", base: "data" },
]

describe("composeInstanceEnv: every R-05 conflict-inventory row is namespaced into the instance tree", () => {
  const env = composeInstanceEnv(DIR)
  const bases = instancePaths(DIR)

  test.each(R05_ROWS)("R-05 row $row ($resource) is isolated by $envVar", ({ envVar, base }) => {
    const value = env[envVar]
    expect(value).toBe(bases[base])
    expect(value.startsWith(DIR + path.sep)).toBe(true) // inside this instance, nowhere shared
  })

  test("row 10 (temp) sets all three temp vars os.tmpdir() honors", () => {
    // os.tmpdir() reads TMPDIR (posix) / TMP / TEMP (win) — set all three.
    expect(env.TMPDIR).toBe(bases.tmp)
    expect(env.TMP).toBe(bases.tmp)
    expect(env.TEMP).toBe(bases.tmp)
  })

  test("composition contains no home override — real ~ reads stay real (EXP-002 audit)", () => {
    // Relocating home would hide the operator's ~/.claude etc.; those reads are
    // user intent, not instance state. No HOME/USERPROFILE/OPENCODE_TEST_HOME here.
    expect(env).not.toHaveProperty("HOME")
    expect(env).not.toHaveProperty("USERPROFILE")
    expect(env).not.toHaveProperty("OPENCODE_TEST_HOME")
  })

  test("no shared XDG root leaks between two instances", () => {
    const a = composeInstanceEnv(instanceDir("a"))
    const b = composeInstanceEnv(instanceDir("b"))
    for (const key of Object.keys(a) as Array<keyof typeof a>) {
      expect(a[key]).not.toBe(b[key]) // no two instances share a mutable path
    }
  })
})

describe("derived paths are a single source of truth for where the server writes", () => {
  test("the data dir (where the DB lands) is under XDG_DATA_HOME/marid", () => {
    // The server writes its DB inside instanceDataDir; keep that root aligned
    // with the composed XDG_DATA_HOME so the live test and the server agree.
    // Post-P-6 the app-name segment is "marid" (was "opencode").
    expect(instanceDataDir(DIR).startsWith(composeInstanceEnv(DIR).XDG_DATA_HOME)).toBe(true)
    expect(instanceDataDir(DIR)).toBe(path.join(DIR, "data", "marid"))
  })

  test("the marid token store resolves to {data}/marid/marid (matches serve.ts maridDir())", () => {
    // If this diverges by one segment the live test writes a token the server
    // never reads → infinite 401. Pin it to Global.Path.data/marid.
    expect(instanceMaridDir(DIR)).toBe(path.join(instanceDataDir(DIR), "marid"))
    expect(instanceMaridDir(DIR)).toBe(path.join(DIR, "data", "marid", "marid"))
  })

  test("instancesRoot honors MARID_HOME", () => {
    const prev = process.env.MARID_HOME
    process.env.MARID_HOME = path.join("/tmp", "custom-marid")
    try {
      expect(instancesRoot()).toBe(path.join("/tmp", "custom-marid", "instances"))
    } finally {
      if (prev === undefined) delete process.env.MARID_HOME
      else process.env.MARID_HOME = prev
    }
  })
})

// P-3: the marid distribution launches instances with LSP off by default, but never
// overrides an operator who set OPENCODE_CONFIG_CONTENT themselves.
describe("instanceConfigEnv: marid distribution config default (LSP off)", () => {
  test("injects lsp:false when the operator has not set OPENCODE_CONFIG_CONTENT", () => {
    const env = instanceConfigEnv({})
    expect(JSON.parse(env.OPENCODE_CONFIG_CONTENT!)).toEqual({ lsp: false })
  })

  test("defers entirely to an operator-set OPENCODE_CONFIG_CONTENT", () => {
    expect(instanceConfigEnv({ OPENCODE_CONFIG_CONTENT: '{"lsp":true}' })).toEqual({})
  })
})
