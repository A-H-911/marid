import fs from "node:fs/promises"
import path from "node:path"

export type Decision = "allow" | "deny" | "429"

export interface AuditEntry {
  token: string
  route: string
  session?: string
  decision: Decision
  requestId: string
}

export interface AuditLog {
  append(entry: AuditEntry): Promise<void>
}

function isoDate(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

// Append-only JSONL, one file per UTC day under <dir>/audit/. Separate from ops
// telemetry (FR-059). Kept best-effort: an audit write failure must never take
// down a request, so append swallows I/O errors after attempting the write.
export function createAuditLog(dir: string, opts?: { now?: () => number; date?: () => string }): AuditLog {
  const now = opts?.now ?? Date.now
  const date = opts?.date ?? (() => isoDate(now()))
  const auditDir = path.join(dir, "audit")

  return {
    async append(entry) {
      const line =
        JSON.stringify({
          time: new Date(now()).toISOString(),
          token: entry.token,
          route: entry.route,
          ...(entry.session ? { session: entry.session } : {}),
          decision: entry.decision,
          requestId: entry.requestId,
        }) + "\n"
      await fs.mkdir(auditDir, { recursive: true }).catch(() => {})
      await fs.appendFile(path.join(auditDir, `audit-${date()}.jsonl`), line, { mode: 0o600 }).catch(() => {})
    },
  }
}
