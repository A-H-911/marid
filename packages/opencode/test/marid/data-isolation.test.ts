// WBS-8.2 — total DATA isolation (P-6) + one-time migration (DEC-025 / AC-031).
//
// global.ts reads the app-name ONCE at module load, so isolation can't be toggled
// in-process — every case runs in a fresh subprocess with a controlled XDG root,
// exactly like the real binary. This proves: (1) __MARID_APP=marid nests every
// machine-global dir under `marid`; (2) upstream (unset) stays `opencode`
// (regression proof); (3) the one-time copy migrates a populated pre-isolation
// install, skips regenerable caches, never re-runs, and logs no secret contents.
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import path from "path"
import os from "os"
import fs from "fs/promises"

const OPENCODE_DIR = path.resolve(import.meta.dir, "../..")

let probeSeq = 0
async function run(script: string, env: Record<string, string>): Promise<{ stdout: string; stderr: string }> {
  // Probe lives INSIDE the package so both package imports (@opencode-ai/core/*)
  // and relative imports (./src/marid-migrate) resolve like the real entry does.
  const file = path.join(OPENCODE_DIR, `.marid-probe-${process.pid}-${probeSeq++}.ts`)
  await fs.writeFile(file, script)
  try {
    const proc = Bun.spawn([process.execPath, "run", "--conditions=browser", file], {
      cwd: OPENCODE_DIR,
      env: { ...process.env, ...env },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
    await proc.exited
    return { stdout, stderr }
  } finally {
    await fs.rm(file, { force: true }).catch(() => {})
  }
}

// Print the resolved Global.Path so we assert against what the server actually uses.
const PATHS_PROBE = `
import { Global } from "@opencode-ai/core/global"
console.log(JSON.stringify({ data: Global.Path.data, config: Global.Path.config, state: Global.Path.state }))
`

describe("P-6 app-name isolation seam", () => {
  let home: string
  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "marid-xdg-"))
  })
  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true }).catch(() => {})
  })

  const xdg = (root: string) => ({
    XDG_DATA_HOME: path.join(root, "data"),
    XDG_CONFIG_HOME: path.join(root, "config"),
    XDG_STATE_HOME: path.join(root, "state"),
    XDG_CACHE_HOME: path.join(root, "cache"),
  })

  test("__MARID_APP=marid nests data/config/state under `marid`", async () => {
    const { stdout } = await run(PATHS_PROBE, { ...xdg(home), __MARID_APP: "marid" })
    const p = JSON.parse(stdout.trim())
    expect(p.data).toBe(path.join(home, "data", "marid"))
    expect(p.config).toBe(path.join(home, "config", "marid"))
    expect(p.state).toBe(path.join(home, "state", "marid"))
  })

  test("unset __MARID_APP stays `opencode` (upstream regression proof)", async () => {
    const env = xdg(home) as Record<string, string>
    const { stdout } = await run(PATHS_PROBE, env)
    const p = JSON.parse(stdout.trim())
    expect(p.data).toBe(path.join(home, "data", "opencode"))
    expect(p.config).toBe(path.join(home, "config", "opencode"))
  })
})

// Drives the real maridMigrate() with __MARID_APP=marid and a controlled XDG root.
const MIGRATE_PROBE = `
import { maridMigrate } from "./src/marid-migrate"
await maridMigrate()
console.log("done")
`

describe("one-time migration (DEC-025 / AC-031)", () => {
  let home: string
  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "marid-mig-"))
  })
  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true }).catch(() => {})
  })

  async function seedOpencode() {
    const data = path.join(home, "data", "opencode")
    const state = path.join(home, "state", "opencode")
    await fs.mkdir(path.join(data, "marid"), { recursive: true })
    await fs.mkdir(path.join(data, "repos", "cache"), { recursive: true })
    await fs.mkdir(state, { recursive: true })
    await fs.writeFile(path.join(data, "auth.json"), '{"nvidia-custom":"SECRET_TOKEN"}')
    await fs.writeFile(path.join(data, "opencode.db"), "sqlite-bytes")
    await fs.writeFile(path.join(data, "marid", "tokens.json"), "gateway-token")
    await fs.writeFile(path.join(data, "repos", "cache", "big"), "regenerable")
    await fs.writeFile(path.join(state, "model.json"), '{"model":"glm"}')
  }

  const env = () => ({
    XDG_DATA_HOME: path.join(home, "data"),
    XDG_STATE_HOME: path.join(home, "state"),
    XDG_CONFIG_HOME: path.join(home, "config"),
    XDG_CACHE_HOME: path.join(home, "cache"),
    __MARID_APP: "marid",
  })

  test("copies auth/db/tokens/model into the marid dirs, skips repos, writes a marker", async () => {
    await seedOpencode()
    const { stdout, stderr } = await run(MIGRATE_PROBE, env())
    expect(stdout).toContain("done")

    const mdata = path.join(home, "data", "marid")
    const mstate = path.join(home, "state", "marid")
    expect(await Bun.file(path.join(mdata, "auth.json")).exists()).toBe(true)
    expect(await Bun.file(path.join(mdata, "opencode.db")).exists()).toBe(true)
    expect(await Bun.file(path.join(mdata, "marid", "tokens.json")).exists()).toBe(true)
    expect(await Bun.file(path.join(mstate, "model.json")).exists()).toBe(true)
    // Regenerable cache is NOT migrated.
    expect(await Bun.file(path.join(mdata, "repos", "cache", "big")).exists()).toBe(false)
    // Marker present → never re-runs.
    expect(await Bun.file(path.join(mdata, ".marid-migrated")).exists()).toBe(true)
    // INV-002: no secret contents leaked to logs (count only).
    expect(stderr).not.toContain("SECRET_TOKEN")
    expect(stderr).not.toContain("gateway-token")
  })

  test("does not re-run once the marker exists", async () => {
    await seedOpencode()
    await run(MIGRATE_PROBE, env())
    // A file added to the source AFTER the first run must NOT be copied.
    await fs.writeFile(path.join(home, "data", "opencode", "added-later.json"), "later")
    await run(MIGRATE_PROBE, env())
    expect(await Bun.file(path.join(home, "data", "marid", "added-later.json")).exists()).toBe(false)
  })

  test("fresh machine (no prior opencode) still writes the marker and copies nothing", async () => {
    const { stdout } = await run(MIGRATE_PROBE, env())
    expect(stdout).toContain("done")
    expect(await Bun.file(path.join(home, "data", "marid", ".marid-migrated")).exists()).toBe(true)
    expect(await Bun.file(path.join(home, "data", "marid", "auth.json")).exists()).toBe(false)
  })
})
