import fs from "node:fs/promises"
import path from "node:path"

// Durable token→session ownership (operator decision, 2026-07-04): a `client`
// token keeps access to the sessions it created across a `marid serve` restart,
// so ownership is persisted, not in-memory. Same 0o600 sidecar pattern as the
// token store. Sessions are event-sourced upstream; this mirrors that durability.
export interface OwnershipStore {
  record(token: string, session: string): Promise<void>
  list(token: string): Promise<Set<string>>
  owns(token: string, session: string): Promise<boolean>
}

type OwnershipMap = Record<string, string[]>

function isMap(value: unknown): value is OwnershipMap {
  if (typeof value !== "object" || value === null) return false
  return Object.values(value as Record<string, unknown>).every(
    (v) => Array.isArray(v) && v.every((s) => typeof s === "string"),
  )
}

export function createOwnershipStore(dir: string): OwnershipStore {
  const file = path.join(dir, "ownership.json")

  const read = async (): Promise<OwnershipMap> => {
    const text = await fs.readFile(file, "utf8").catch(() => "")
    if (!text) return {}
    const parsed = JSON.parse(text)
    return isMap(parsed) ? parsed : {}
  }

  return {
    async record(token, session) {
      const map = await read()
      const owned = map[token] ?? []
      if (owned.includes(session)) return
      map[token] = [...owned, session]
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(file, JSON.stringify(map, null, 2), { mode: 0o600 })
    },
    async list(token) {
      return new Set((await read())[token] ?? [])
    },
    async owns(token, session) {
      return ((await read())[token] ?? []).includes(session)
    },
  }
}
