import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

// Scope model (api-event-contract §"AuthZ scopes"):
//   admin           — everything
//   client          — sessions it created + its own events (ownership tracked separately)
//   channel:<name>  — bound to a channel's dedicated agent/policy/sessions (PH-4 wires the policy)
export type Scope = "admin" | "client" | `channel:${string}`

export interface TokenInfo {
  name: string
  scope: Scope
  created: number
  // PH-4 (WBS-4.4): a channel token is bound to exactly one restricted agent. The
  // middleware rejects a prompt whose body.agent is not this value, so a channel
  // token physically cannot run any other agent (INV-001, by construction). Unset
  // for admin/client tokens (and for a channel token created without --agent, which
  // then cannot prompt at all — fail-closed).
  agent?: string
}

export interface TokenRecord extends TokenInfo {
  hash: string
}

const SECRET_PREFIX = "mar_"
const CHANNEL_PREFIX = "channel:"

function isRecord(value: unknown): value is TokenRecord {
  if (typeof value !== "object" || value === null) return false
  const r = value as Record<string, unknown>
  return (
    typeof r.name === "string" &&
    typeof r.scope === "string" &&
    typeof r.hash === "string" &&
    typeof r.created === "number" &&
    (r.agent === undefined || typeof r.agent === "string") &&
    isValidScope(r.scope)
  )
}

export function isValidScope(scope: string): scope is Scope {
  if (scope === "admin" || scope === "client") return true
  return scope.startsWith(CHANNEL_PREFIX) && scope.length > CHANNEL_PREFIX.length
}

export function generateSecret(): string {
  return SECRET_PREFIX + randomBytes(32).toString("base64url")
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

// Constant-time comparison over the fixed-width hex digests — never over the
// raw secrets — so a mismatch leaks neither length nor content of any token.
function hashesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex")
  const bb = Buffer.from(b, "hex")
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export interface TokenStore {
  create(name: string, scope: Scope, agent?: string): Promise<{ secret: string; info: TokenInfo }>
  list(): Promise<TokenInfo[]>
  revoke(name: string): Promise<boolean>
  verify(secret: string): Promise<TokenRecord | undefined>
}

export function createTokenStore(dir: string): TokenStore {
  const file = path.join(dir, "tokens.json")

  const read = async (): Promise<TokenRecord[]> => {
    const text = await fs.readFile(file, "utf8").catch(() => "")
    if (!text) return []
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed.filter(isRecord) : []
  }

  const write = async (records: TokenRecord[]): Promise<void> => {
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(file, JSON.stringify(records, null, 2), { mode: 0o600 })
  }

  return {
    async create(name, scope, agent) {
      const records = await read()
      if (records.some((r) => r.name === name)) throw new Error(`token "${name}" already exists`)
      const secret = generateSecret()
      const info: TokenInfo = { name, scope, created: Date.now(), ...(agent ? { agent } : {}) }
      await write([...records, { ...info, hash: hashSecret(secret) }])
      return { secret, info }
    },
    async list() {
      return (await read()).map(({ name, scope, created, agent }) => ({ name, scope, created, ...(agent ? { agent } : {}) }))
    },
    async revoke(name) {
      const records = await read()
      const next = records.filter((r) => r.name !== name)
      if (next.length === records.length) return false
      await write(next)
      return true
    },
    async verify(secret) {
      if (!secret) return undefined
      const hash = hashSecret(secret)
      const records = await read()
      return records.find((r) => hashesEqual(r.hash, hash))
    },
  }
}
