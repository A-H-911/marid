// MARID env-pierce disclosure (WBS-8.2, AC-026). The marid binary isolates all
// machine-global dirs (P-6), but a handful of inherited OPENCODE_* data-layer env
// vars still *pierce* that isolation by design — DEC-022 keeps the OPENCODE_* env
// for plugin/ecosystem compat. Rather than silently defeat isolation, we disclose
// it: warn once at boot, naming each piercing var and what it redirects. The vars
// are still fully honored downstream — this is disclosure, not enforcement.
//
// INV-002: only the var NAME and a static description are printed, NEVER its value
// (OPENCODE_AUTH_CONTENT / OPENCODE_CONFIG_CONTENT carry secrets).
const PIERCE: ReadonlyArray<readonly [string, string]> = [
  ["OPENCODE_CONFIG_DIR", "global config dir"],
  ["OPENCODE_CONFIG", "global config file"],
  ["OPENCODE_CONFIG_CONTENT", "config content (inline)"],
  ["OPENCODE_AUTH_CONTENT", "auth credentials (inline)"],
  ["OPENCODE_DB", "sessions database path"],
]

export function pierceMessage(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const active = PIERCE.filter(([key]) => env[key] !== undefined && env[key] !== "")
  if (active.length === 0) return undefined
  const lines = active.map(([key, what]) => `  ${key} → ${what}`).join("\n")
  return (
    "[marid] data isolation pierced by environment (intentional, still honored):\n" +
    lines +
    "\n[marid] these OPENCODE_* overrides redirect state OUTSIDE the isolated marid dirs."
  )
}

export function disclosePierce(env: NodeJS.ProcessEnv = process.env): void {
  const msg = pierceMessage(env)
  if (msg) process.stderr.write(msg + "\n")
}
