// Gateway configuration from environment (fail-fast at startup). Secrets (the bot
// token) come from the environment, never a config file or code (INV-002). The
// instance URL, bearer token, bound agent, and state dir are supplied by the CLI
// (from `marid instance` discovery + flags), not from here.

export interface TelegramEnvConfig {
  botToken: string
  botApiBaseUrl?: string
  allow: ReadonlySet<number>
  cadenceMs?: number
  permissionTimeoutMs?: number
  pollTimeoutSec?: number
}

function parseIds(csv: string): Set<number> {
  const ids = csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const n = Number(s)
      if (!Number.isInteger(n)) throw new Error(`invalid Telegram user id "${s}" in MARID_TG_ALLOW`)
      return n
    })
  if (ids.length === 0) throw new Error("MARID_TG_ALLOW must list at least one operator user id")
  return new Set(ids)
}

function optionalInt(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer, got "${value}"`)
  return n
}

export function loadConfig(env: Record<string, string | undefined>): TelegramEnvConfig {
  const botToken = env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is required")
  const allowRaw = env.MARID_TG_ALLOW
  if (!allowRaw) throw new Error("MARID_TG_ALLOW (comma-separated operator user ids) is required")
  return {
    botToken,
    botApiBaseUrl: env.TELEGRAM_API_URL || undefined,
    allow: parseIds(allowRaw),
    cadenceMs: optionalInt(env.MARID_TG_CADENCE_MS, "MARID_TG_CADENCE_MS"),
    permissionTimeoutMs: optionalInt(env.MARID_TG_PERMISSION_TIMEOUT_MS, "MARID_TG_PERMISSION_TIMEOUT_MS"),
    pollTimeoutSec: optionalInt(env.MARID_TG_POLL_TIMEOUT_SEC, "MARID_TG_POLL_TIMEOUT_SEC"),
  }
}
