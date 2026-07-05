import fs from "node:fs/promises"
import { instanceDir, instancesRoot } from "./paths"
import { isAlive, readRecord } from "./lifecycle"

// An instance name becomes a filesystem path segment, so it is a trust boundary:
// this pattern blocks path traversal ("..", "/"), absolute paths, and dotfiles.
// Lowercase alnum + dash, must start alnum, <= 64 chars.
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

export function validateName(name: string): void {
  if (!NAME_RE.test(name)) {
    throw new Error(`invalid instance name "${name}" (use lowercase a-z, 0-9, dash; start alphanumeric; max 64)`)
  }
}

async function exists(target: string): Promise<boolean> {
  return fs
    .stat(target)
    .then(() => true)
    .catch(() => false)
}

// Create an instance's tree (0700). Errors if it already exists so a second
// `add` never silently clobbers a live instance.
export async function add(name: string): Promise<string> {
  validateName(name)
  const dir = instanceDir(name)
  if (await exists(dir)) throw new Error(`instance "${name}" already exists`)
  await fs.mkdir(dir, { recursive: true, mode: 0o700 })
  return dir
}

// Resolve (and validate) an instance's directory without creating it.
export function pathOf(name: string): string {
  validateName(name)
  return instanceDir(name)
}

export interface InstanceSummary {
  name: string
  dir: string
  running: boolean
  port?: number
  pid?: number
}

// The registry IS the directory listing (ADR-0006) — no separate index file.
export async function list(): Promise<InstanceSummary[]> {
  const entries = await fs.readdir(instancesRoot(), { withFileTypes: true }).catch(() => [])
  const dirs = entries.filter((e) => e.isDirectory())
  return Promise.all(
    dirs.map(async (entry) => {
      const dir = instanceDir(entry.name)
      const record = await readRecord(dir)
      const running = record ? isAlive(record.pid) : false
      return {
        name: entry.name,
        dir,
        running,
        port: record?.port,
        pid: running ? record?.pid : undefined,
      }
    }),
  )
}

// Delete an instance's tree. Refuses while it is running — stop it first, so we
// never orphan a live server by yanking its directory out from under it.
export async function remove(name: string): Promise<boolean> {
  validateName(name)
  const dir = instanceDir(name)
  if (!(await exists(dir))) return false
  const record = await readRecord(dir)
  if (record && isAlive(record.pid)) throw new Error(`instance "${name}" is running; stop it first`)
  await fs.rm(dir, { recursive: true, force: true })
  return true
}
