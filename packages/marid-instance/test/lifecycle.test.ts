import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { instanceLogFile, instanceRecordFile } from "../src/paths"
import { isAlive, readRecord, start, status, stop, type LaunchResolver } from "../src/lifecycle"

// A stand-in "server": binds a REAL free port (so the OS-assigns-a-free-port
// isolation is genuinely exercised), prints the exact readiness line the real
// server prints, spawns a grandchild (MCP/LSP stand-in, so tree-kill has a
// descendant to reap), then blocks forever like MaridServeCommand. Using
// process.execPath (the real bun binary) avoids the Windows npm-shim spawn trap.
const FAKE_SERVER = [
  `const net = require("node:net")`,
  `const s = net.createServer()`,
  `s.listen(0, "127.0.0.1", () => console.log("marid server listening on http://127.0.0.1:" + s.address().port + "/"))`,
  `require("node:child_process").spawn(process.execPath, ["-e", "await new Promise(()=>{})"], { stdio: "ignore" })`,
  `await new Promise(() => {})`,
].join("\n")

const fakeLaunch: LaunchResolver = () => ({ command: process.execPath, args: ["-e", FAKE_SERVER] })

const dirs: string[] = []
async function tmpInstance(name: string): Promise<string> {
  const dir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "marid-inst-")), name)
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await stop(dir).catch(() => {})
    await fs.rm(path.dirname(dir), { recursive: true, force: true }).catch(() => {})
  }
})

describe("lifecycle: launch → logfile readiness → PID record", () => {
  test("start spawns a detached server, records the real OS-assigned port and a live pid", async () => {
    const dir = await tmpInstance("a")
    const record = await start("a", dir, fakeLaunch)
    expect(record.name).toBe("a")
    expect(record.port).toBeGreaterThan(0)
    expect(isAlive(record.pid)).toBe(true)

    // The record is persisted and the readiness line is in the per-instance log.
    const persisted = await readRecord(dir)
    expect(persisted?.pid).toBe(record.pid)
    expect(persisted?.port).toBe(record.port)
    const log = await fs.readFile(instanceLogFile(dir), "utf8")
    expect(log).toContain("listening on http://127.0.0.1:")
  })

  test("status reports running, then stopped after stop", async () => {
    const dir = await tmpInstance("b")
    const record = await start("b", dir, fakeLaunch)
    const up = await status(dir)
    expect(up).toMatchObject({ running: true, stale: false, port: record.port, pid: record.pid })

    const result = await stop(dir)
    expect(result).toEqual({ stopped: true, stale: false })
    expect(isAlive(record.pid)).toBe(false) // process (and its group/tree) is gone
    const down = await status(dir)
    expect(down.running).toBe(false)
    // the record file is cleared on stop
    expect(await fs.readFile(instanceRecordFile(dir), "utf8").catch(() => null)).toBeNull()
  })

  test("a record pointing at a dead pid is reported stale, not running", async () => {
    const dir = await tmpInstance("c")
    await fs.mkdir(dir, { recursive: true })
    // 0x3fffffff — a pid that cannot be live on any runner.
    const ghost = { name: "c", port: 40000, pid: 0x3fffffff, startedAt: 1, logFile: instanceLogFile(dir) }
    await fs.writeFile(instanceRecordFile(dir), JSON.stringify(ghost))
    const s = await status(dir)
    expect(s).toMatchObject({ running: false, stale: true })

    const result = await stop(dir)
    expect(result).toEqual({ stopped: false, stale: true }) // nothing to kill; record cleared
    expect(await fs.readFile(instanceRecordFile(dir), "utf8").catch(() => null)).toBeNull()
  })

  test("stop on an instance that was never started is a no-op", async () => {
    const dir = await tmpInstance("d")
    await fs.mkdir(dir, { recursive: true })
    expect(await stop(dir)).toEqual({ stopped: false, stale: false })
  })

  test("starting an already-running instance is idempotent — no second server, no orphan", async () => {
    const dir = await tmpInstance("f")
    const first = await start("f", dir, fakeLaunch)
    const second = await start("f", dir, fakeLaunch)
    // Same process reused — a second server was NOT spawned (which would orphan
    // the first, since the record would point only at the new pid).
    expect(second.pid).toBe(first.pid)
    expect(second.port).toBe(first.port)
    expect(isAlive(first.pid)).toBe(true)

    await stop(dir)
    expect(isAlive(first.pid)).toBe(false) // the one and only server is gone
  })

  test("two instances bind distinct ports (R-05 row 1: HTTP-port isolation)", async () => {
    const dirA = await tmpInstance("e1")
    const dirB = await tmpInstance("e2")
    const a = await start("e1", dirA, fakeLaunch)
    const b = await start("e2", dirB, fakeLaunch)
    expect(a.port).toBeGreaterThan(0)
    expect(b.port).toBeGreaterThan(0)
    expect(a.port).not.toBe(b.port) // OS never hands out the same free port twice
  })
})
