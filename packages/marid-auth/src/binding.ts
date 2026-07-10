import fs from "node:fs/promises"
import path from "node:path"

// Durable session<->surface bindings (WBS-6.3, ADR-0012). The explicit-attach
// registry behind full bidirectional mirroring: a token sees its OWN sessions
// (ownership.ts) PLUS the sessions the operator has explicitly ATTACHED it to.
// Same 0o600 sidecar pattern as ownership.ts / the token store, and durable for
// the same reason — an attach survives a `marid serve` restart; sessions are
// event-sourced upstream and this mirrors that durability.
//
// Mutable by design (ADR-0012 docking-style rebinding): attach/detach, not
// append-only. Read as a whole set by the /event filter (middleware.ts), which
// composes it with ownership into the binding-aware `isVisible` predicate —
// VIEW-via-binding. The ACTING path (scope.ts) stays on ownership, so a bound
// surface can never approve/prompt a session it does not own (INV-001, EXP-008).
//
// Not self-serve: the write path (attach) is an operator/admin action. A
// `channel:` token attaching ITSELF to an arbitrary session would defeat the
// explicit-attach guarantee (a restricted channel could self-observe a
// privileged session), so exposing attach over HTTP is deferred to WBS-6.4's
// admin-gated endpoint. Here the store is called in-process only.
export interface BindingStore {
  attach(token: string, session: string): Promise<void>
  detach(token: string, session: string): Promise<void>
  list(token: string): Promise<Set<string>>
}

type BindingMap = Record<string, string[]>

function isMap(value: unknown): value is BindingMap {
  if (typeof value !== "object" || value === null) return false
  return Object.values(value as Record<string, unknown>).every(
    (v) => Array.isArray(v) && v.every((s) => typeof s === "string"),
  )
}

export function createBindingStore(dir: string): BindingStore {
  const file = path.join(dir, "binding.json")

  const read = async (): Promise<BindingMap> => {
    const text = await fs.readFile(file, "utf8").catch(() => "")
    if (!text) return {}
    const parsed = JSON.parse(text)
    return isMap(parsed) ? parsed : {}
  }

  const write = async (map: BindingMap): Promise<void> => {
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(file, JSON.stringify(map, null, 2), { mode: 0o600 })
  }

  return {
    async attach(token, session) {
      const map = await read()
      const bound = map[token] ?? []
      if (bound.includes(session)) return
      map[token] = [...bound, session]
      await write(map)
    },
    async detach(token, session) {
      const map = await read()
      const bound = map[token] ?? []
      if (!bound.includes(session)) return
      map[token] = bound.filter((s) => s !== session)
      await write(map)
    },
    async list(token) {
      return new Set((await read())[token] ?? [])
    },
  }
}
