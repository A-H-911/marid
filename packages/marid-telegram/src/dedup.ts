import fs from "node:fs/promises"
import path from "node:path"

// update_id dedup + resume (FR-051, research §7). Long polling confirms updates
// by advancing getUpdates' offset, but a crash before confirming causes Telegram
// to redeliver; processing must therefore be idempotent per update_id. This store
// persists the highest processed update_id so the loop drops duplicates/lower ids
// and resumes from the right offset after a restart. update_id is NOT globally
// monotonic across >1 week of inactivity (research §7) — but within a live poll
// session it increases, and the resume offset only ever needs the last seen id.
//
// The long-poll loop is single-threaded (one update at a time), so no locking is
// needed. commit() is called AFTER the update's side effects succeed (at-least-
// once); a redelivery re-runs an idempotent prompt keyed by messageID = update_id.

export interface Dedup {
  last(): Promise<number>
  seen(updateId: number): Promise<boolean>
  commit(updateId: number): Promise<void>
}

export function createDedup(stateFile: string): Dedup {
  const read = async (): Promise<number> => {
    const text = await fs.readFile(stateFile, "utf8").catch(() => "")
    if (!text) return 0
    const value = (JSON.parse(text) as { lastUpdateId?: unknown }).lastUpdateId
    return typeof value === "number" && Number.isFinite(value) ? value : 0
  }

  return {
    last: read,
    async seen(updateId) {
      return updateId <= (await read())
    },
    async commit(updateId) {
      if (updateId <= (await read())) return
      await fs.mkdir(path.dirname(stateFile), { recursive: true })
      await fs.writeFile(stateFile, JSON.stringify({ lastUpdateId: updateId }), { mode: 0o600 })
    },
  }
}
