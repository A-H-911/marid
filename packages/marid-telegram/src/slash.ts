// Slash-command routing (WBS-6.2, ADR-0009 defect 3). Deny-by-default: a whitelisted
// /command routes to its handler; ANY other /command is refused (never silently
// prompted to the agent as text); plain text prompts the agent as before. The
// operator is already allowlisted upstream (router.ts) — this is UX + hygiene, so a
// stray "/deploy" is rejected rather than fed to the model as a literal prompt.

export type SlashRoute =
  | { kind: "command"; name: string; args: string }
  | { kind: "rejected"; name: string }
  | { kind: "prompt"; text: string }

export function routeSlash(text: string, whitelist: ReadonlySet<string>): SlashRoute {
  if (!text.startsWith("/")) return { kind: "prompt", text }
  const body = text.slice(1)
  const sp = body.search(/\s/)
  const name = (sp === -1 ? body : body.slice(0, sp)).toLowerCase()
  const args = sp === -1 ? "" : body.slice(sp + 1).trim()
  if (!name) return { kind: "rejected", name: "" } // a bare "/" is not a command
  return whitelist.has(name) ? { kind: "command", name, args } : { kind: "rejected", name }
}
