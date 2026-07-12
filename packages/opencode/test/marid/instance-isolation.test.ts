import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import fssync from "node:fs"
import os from "node:os"
import path from "node:path"
import { createTokenStore } from "@marid/gateway"
import {
  composeInstanceEnv,
  instanceDataDir,
  instanceMaridDir,
  start,
  status,
  stop,
  type InstanceRecord,
  type LaunchResolver,
} from "@marid/instance"

// The DB filename is channel-dependent, so assert a .db landed in the instance's
// data dir rather than trusting an exact name (see paths.ts).
async function hasDb(dir: string): Promise<boolean> {
  const entries = await fs.readdir(instanceDataDir(dir)).catch(() => [] as string[])
  return entries.some((e) => e.endsWith(".db"))
}

// TEST-INST (WBS-2.3 / KPI-003): the DEFERRED EXP-002 live two-instance diff,
// now runnable (bun is available). Launches two REAL authenticated `marid serve`
// instances with fully composed isolation env and proves zero cross-instance
// interference against the R-05 conflict inventory: distinct ports, per-instance
// DB/session state, and no state write escaping the composed XDG roots.
//
// Heavy (two full server boots) — gated to the 3-OS `marid-isolation` CI job via
// MARID_ISOLATION=1 so it does not slow the 2-OS PR unit job.
const RUN = process.env.MARID_ISOLATION === "1"
const suite = RUN ? describe : describe.skip

const maridEntry = path.resolve(import.meta.dir, "../../src/marid.ts")

// Faithful to `marid instance start`'s dev launch path.
const launch: LaunchResolver = () => ({
  command: process.execPath,
  args: ["run", "--conditions=browser", maridEntry, "serve", "--port", "0"],
})

async function post(url: string, token: string): Promise<Response> {
  return fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}` } })
}
async function get(url: string, token: string): Promise<Response> {
  return fetch(url, { headers: { authorization: `Bearer ${token}` } })
}

suite("TEST-INST: two isolated instances run without cross-interference (live, real serialization)", () => {
  let root: string
  let dirA: string
  let dirB: string
  let overlay: Record<string, string>
  const running: string[] = []

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "marid-iso-"))
    dirA = path.join(root, "a")
    dirB = path.join(root, "b")
    // Hermetic home overlay on top of the PRODUCTION composeInstanceEnv: a fake,
    // shared home so a stray write that bypasses XDG lands here (and is caught),
    // and the boot stays offline. USERPROFILE covers os.homedir() on Windows.
    const fakeHome = path.join(root, "home")
    await fs.mkdir(fakeHome, { recursive: true })
    overlay = {
      HOME: fakeHome,
      USERPROFILE: fakeHome,
      OPENCODE_TEST_HOME: fakeHome,
      OPENCODE_PURE: "1",
      OPENCODE_DISABLE_AUTOUPDATE: "1",
      OPENCODE_DISABLE_AUTOCOMPACT: "1",
      OPENCODE_DISABLE_MODELS_FETCH: "1",
      OPENCODE_AUTH_CONTENT: "{}",
      // The opencode test preload forces OPENCODE_DB=:memory:; a spawned child
      // would inherit it and never write a DB. Pin a real on-disk DB (relative →
      // resolved under the composed XDG_DATA_HOME) so the isolation is observable.
      OPENCODE_DB: "opencode.db",
    }
  })

  afterEach(async () => {
    for (const dir of running.splice(0)) await stop(dir).catch(() => {})
    await fs.rm(root, { recursive: true, force: true }).catch(() => {})
  })

  // Pre-seed an admin token into the instance's OWN marid store — the same path
  // the server resolves (instanceMaridDir derives it from composeInstanceEnv, so
  // a one-segment drift can't cause a silent 401 loop).
  async function seedToken(dir: string): Promise<string> {
    const { secret } = await createTokenStore(instanceMaridDir(dir)).create("root", "admin")
    return secret
  }

  async function launchInstance(name: string, dir: string): Promise<{ record: InstanceRecord; token: string }> {
    const token = await seedToken(dir)
    const record = await start(name, dir, launch, { env: overlay, timeoutMs: 60_000 })
    running.push(dir)
    return { record, token }
  }

  test(
    "distinct ports, per-instance DB/sessions, and no state written outside the composed XDG roots",
    async () => {
      const a = await launchInstance("a", dirA)
      const b = await launchInstance("b", dirB)

      // R-05 row 1: two live servers on distinct OS-assigned ports.
      expect(a.record.port).toBeGreaterThan(0)
      expect(b.record.port).toBeGreaterThan(0)
      expect(a.record.port).not.toBe(b.record.port)

      const urlA = `http://127.0.0.1:${a.record.port}`
      const urlB = `http://127.0.0.1:${b.record.port}`

      // Both answer authed health checks (AC-001) through the real auth wrapper.
      for (const [url, token] of [
        [urlA, a.token],
        [urlB, b.token],
      ] as const) {
        const health = await get(`${url}/global/health`, token)
        expect(health.status).toBe(200)
        expect(((await health.json()) as { healthy?: unknown }).healthy).toBe(true)
      }

      // Each token only works against its own instance (separate token stores).
      expect((await get(`${urlB}/global/health`, a.token)).status).toBe(401)

      // Create a session on each — real writes into each instance's own DB.
      const sesA = ((await (await post(`${urlA}/session`, a.token)).json()) as { id: string }).id
      const sesB = ((await (await post(`${urlB}/session`, b.token)).json()) as { id: string }).id
      expect(sesA.startsWith("ses")).toBe(true)
      expect(sesB.startsWith("ses")).toBe(true)

      // R-05 rows 2/3/6/11: each instance's DB is its own file, in its own tree.
      expect(await hasDb(dirA)).toBe(true)
      expect(await hasDb(dirB)).toBe(true)

      // Session state does not cross: A's list has sesA and not sesB; vice versa.
      const listA = (await (await get(`${urlA}/session`, a.token)).json()) as Array<{ id: string }>
      const listB = (await (await get(`${urlB}/session`, b.token)).json()) as Array<{ id: string }>
      const idsA = listA.map((s) => s.id)
      const idsB = listB.map((s) => s.id)
      expect(idsA).toContain(sesA)
      expect(idsA).not.toContain(sesB)
      expect(idsB).toContain(sesB)
      expect(idsB).not.toContain(sesA)

      // The EXP-002 negative claim, now testable: NO opencode state materialized
      // under the (shared, fake) home — every XDG root was relocated into the
      // instance trees, so a write reaching raw ~ would appear here and fail this.
      for (const leak of [".local/share/opencode", ".config/opencode", ".cache/opencode"]) {
        expect(fssync.existsSync(path.join(root, "home", leak))).toBe(false)
      }
      // And each instance's data dir really is under its composed XDG_DATA_HOME.
      expect(instanceDataDir(dirA).startsWith(composeInstanceEnv(dirA).XDG_DATA_HOME)).toBe(true)

      // Clean shutdown: both stop, neither stays running (no orphaned servers).
      expect((await stop(dirA)).stopped).toBe(true)
      expect((await stop(dirB)).stopped).toBe(true)
      running.length = 0
      expect((await status(dirA)).running).toBe(false)
      expect((await status(dirB)).running).toBe(false)
    },
    300_000,
  )
})
