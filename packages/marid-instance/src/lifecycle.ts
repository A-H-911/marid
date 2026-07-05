import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import fssync from "node:fs"
import { composeInstanceEnv, instanceLogFile, instanceRecordFile } from "./paths"

// How to launch a fresh `marid serve` for the current runtime. Injected so this
// package stays runtime-agnostic: the opencode CLI resolves it to the compiled
// binary (or `bun run src/marid.ts`), the isolation test to its own entry, and
// unit tests to a tiny fake server. The argv MUST end at `serve --port 0` — the
// OS assigns a free port and we read the actual one back from the log (race-free
// vs. pre-allocating a port and hoping it survives to bind time).
export type LaunchResolver = () => { command: string; args: string[] }

export interface InstanceRecord {
  name: string
  port: number
  pid: number
  startedAt: number
  logFile: string
}

export interface StartOptions {
  // Extra env overlaid on top of the composed isolation env (tests use this to
  // relocate HOME hermetically and disable network/plugins). Empty in production.
  env?: Record<string, string>
  // Readiness budget before start() gives up and reaps the child. Scaled by
  // OPENCODE_TIMING_SCALE for slow CI runners (P-CI-4).
  timeoutMs?: number
}

const READY_RE = /listening on (http:\/\/([^\s:]+):(\d+))/

// The one CI timing knob (P-CI-4): server boot on a cold 2-core Windows runner
// is far slower than a dev box, so scale the readiness budget by the same factor
// the opencode test harness uses instead of inventing a new one.
function timingScale(): number {
  const raw = Number(process.env.OPENCODE_TIMING_SCALE)
  return Number.isFinite(raw) && raw > 0 ? raw : 1
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// True iff a process with this pid exists. kill(pid, 0) sends no signal; it only
// probes. EPERM means "exists but not ours to signal" — still alive.
export function isAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM"
  }
}

// Terminate the instance server AND its descendants (MCP/LSP children).
export function killTree(pid: number): void {
  if (!pid || pid <= 0) return
  if (process.platform === "win32") {
    // ponytail: taskkill is an abrupt terminate — Windows has no catchable
    // SIGTERM, so there is no graceful drain here. /T reaps the whole tree.
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" }).on("error", () => {})
    return
  }
  // POSIX: the child is a process-group leader (spawned detached), so signalling
  // the negative pid delivers to the whole group and reaps descendants. Also
  // signal the bare pid: if this runtime did not actually establish a group
  // leader, -pid is ESRCH and only the direct hit lands — degrading to "children
  // may linger" instead of "server orphaned", which the caller can still detect.
  try {
    process.kill(-pid, "SIGTERM")
  } catch {
    // no such group
  }
  try {
    process.kill(pid, "SIGTERM")
  } catch {
    // already gone
  }
}

function isRecord(value: unknown): value is InstanceRecord {
  if (typeof value !== "object" || value === null) return false
  const r = value as Record<string, unknown>
  return (
    typeof r.name === "string" &&
    typeof r.port === "number" &&
    typeof r.pid === "number" &&
    typeof r.startedAt === "number" &&
    typeof r.logFile === "string"
  )
}

export async function readRecord(dir: string): Promise<InstanceRecord | undefined> {
  const text = await fs.readFile(instanceRecordFile(dir), "utf8").catch(() => "")
  if (!text) return undefined
  const parsed = await Promise.resolve()
    .then(() => JSON.parse(text) as unknown)
    .catch(() => undefined)
  return isRecord(parsed) ? parsed : undefined
}

// Poll the server log for the "listening on http://host:PORT" line the server
// prints once its handler is built and bound. That line is a strictly stronger
// readiness signal than a socket probe (the app is fully constructed before it
// prints) and carries the real OS-assigned port.
async function waitForPort(logFile: string, timeoutMs: number): Promise<number> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const text = await fs.readFile(logFile, "utf8").catch(() => "")
    const match = text.match(READY_RE)
    if (match) return Number(match[3])
    if (Date.now() >= deadline) {
      const tail = text.slice(-2000)
      throw new Error(`instance server did not become ready within ${timeoutMs}ms\nlog tail:\n${tail}`)
    }
    await delay(100)
  }
}

// Launch the instance server as a detached background process with a fully
// namespaced environment, wait until it is listening, and persist its record.
// On readiness failure the child is reaped so a failed start leaves no orphan.
export async function start(
  name: string,
  dir: string,
  launch: LaunchResolver,
  options: StartOptions = {},
): Promise<InstanceRecord> {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })

  // Idempotent guard: never spawn a second server for an already-running
  // instance. Without this, a second start() overwrites the record with the new
  // pid and orphans the first server (unkillable via stop/list). A stale record
  // (dead pid) falls through to a fresh launch.
  const existing = await readRecord(dir)
  if (existing && isAlive(existing.pid)) return existing

  const logFile = instanceLogFile(dir)
  await fs.writeFile(logFile, "") // truncate any prior run's log

  const { command, args } = launch()
  // Redirect stdio to the log file (not a pipe): the parent can exit while the
  // child keeps writing, and the operator gets a per-instance log for free.
  const out = fssync.openSync(logFile, "a")
  const child = spawn(command, args, {
    detached: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, ...composeInstanceEnv(dir), ...options.env },
    windowsHide: true,
  })
  fssync.closeSync(out)
  const pid = child.pid
  child.unref()
  // A post-spawn async spawn failure would otherwise throw an unhandled 'error'.
  child.on("error", () => {})
  if (!pid) throw new Error(`failed to spawn instance server for "${name}"`)

  const port = await waitForPort(logFile, (options.timeoutMs ?? 30_000) * timingScale()).catch((e) => {
    killTree(pid) // no orphan on a start that never became ready
    throw e
  })

  const record: InstanceRecord = { name, port, pid, startedAt: Date.now(), logFile }
  await fs.writeFile(instanceRecordFile(dir), JSON.stringify(record, null, 2), { mode: 0o600 })
  return record
}

async function waitDead(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true
    await delay(50)
  }
  return !isAlive(pid)
}

export interface StopResult {
  stopped: boolean // a running instance was terminated
  stale: boolean // a record existed but the process was already gone
}

// Terminate the instance and clear its record. SIGKILL is the POSIX fallback if
// the group ignores SIGTERM; on Windows taskkill /F is already forceful.
export async function stop(dir: string, timeoutMs = 5000): Promise<StopResult> {
  const record = await readRecord(dir)
  if (!record) return { stopped: false, stale: false }
  if (!isAlive(record.pid)) {
    await fs.rm(instanceRecordFile(dir), { force: true })
    return { stopped: false, stale: true }
  }
  killTree(record.pid)
  const dead = await waitDead(record.pid, timeoutMs * timingScale())
  if (!dead && process.platform !== "win32") {
    for (const target of [-record.pid, record.pid]) {
      try {
        process.kill(target, "SIGKILL")
      } catch {
        // already gone
      }
    }
    await waitDead(record.pid, 2000 * timingScale())
  }
  await fs.rm(instanceRecordFile(dir), { force: true })
  return { stopped: true, stale: false }
}

export interface InstanceStatus {
  running: boolean
  stale: boolean // record present but process dead
  port?: number
  pid?: number
  startedAt?: number
}

export async function status(dir: string): Promise<InstanceStatus> {
  const record = await readRecord(dir)
  if (!record) return { running: false, stale: false }
  const running = isAlive(record.pid)
  return { running, stale: !running, port: record.port, pid: record.pid, startedAt: record.startedAt }
}
