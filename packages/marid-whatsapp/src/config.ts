import { normalizeJid } from "./allowlist"

// Gateway configuration from environment (fail-fast at startup). Secrets — the WAHA API
// key — come from the environment, never a config file or code (INV-002). The instance
// URL, bearer token, bound agent, and state dir are supplied by the CLI (from `marid
// instance` discovery + flags), not from here. Mirrors marid-telegram/config.ts.

export interface WhatsAppEnvConfig {
  wahaUrl: string
  wahaApiKey?: string
  session: string
  allow: ReadonlySet<string>
  cadenceMs?: number
  permissionTimeoutMs?: number
  approvalTtlMs?: number
}

// A JID is "<number>@c.us" (direct) or "<id>@g.us" (group). Validated at the boundary
// so a typo in the allowlist fails at boot rather than silently denying the operator
// forever — a deny-by-default gate with a bad list looks identical to a working one.
const JID = /^[0-9a-z._-]+@(c\.us|g\.us|lid)$/

function parseJids(csv: string): Set<string> {
  const jids = csv
    .split(",")
    .map((s) => normalizeJid(s))
    .filter((s) => s.length > 0)
    .map((s) => {
      if (!JID.test(s)) throw new Error(`invalid WhatsApp JID "${s}" in MARID_WA_ALLOW (expected e.g. 11111111111@c.us)`)
      return s
    })
  if (jids.length === 0) throw new Error("MARID_WA_ALLOW must list at least one operator JID")
  return new Set(jids)
}

function optionalInt(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer, got "${value}"`)
  return n
}

export function loadConfig(env: Record<string, string | undefined>): WhatsAppEnvConfig {
  const wahaUrl = env.MARID_WA_WAHA_URL
  if (!wahaUrl) throw new Error("MARID_WA_WAHA_URL is required (e.g. http://127.0.0.1:3000)")
  const allowRaw = env.MARID_WA_ALLOW
  if (!allowRaw) throw new Error("MARID_WA_ALLOW (comma-separated operator JIDs) is required")
  return {
    wahaUrl: wahaUrl.replace(/\/+$/, ""),
    // Optional: WAHA can run without a key on a private network, but if the operator
    // set one we must carry it. It goes in the WS query string (WAHA's design), which
    // is exactly why every log line is redacted — see redact.ts.
    wahaApiKey: env.MARID_WA_WAHA_API_KEY || undefined,
    session: env.MARID_WA_SESSION || "default",
    allow: parseJids(allowRaw),
    cadenceMs: optionalInt(env.MARID_WA_CADENCE_MS, "MARID_WA_CADENCE_MS"),
    permissionTimeoutMs: optionalInt(env.MARID_WA_PERMISSION_TIMEOUT_MS, "MARID_WA_PERMISSION_TIMEOUT_MS"),
    approvalTtlMs: optionalInt(env.MARID_WA_APPROVAL_TTL_MS, "MARID_WA_APPROVAL_TTL_MS"),
  }
}
