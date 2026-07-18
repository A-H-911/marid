// INV-001 trust boundary (threat model B1). A WhatsApp number is reachable by anyone
// who knows it, and WAHA has no built-in allowlist, so the gateway must gate every
// inbound message by sender JID — deny-by-default (FR-050, AC-018 "stranger ignored").
//
// A JID is WhatsApp's address ("11111111111@c.us" for a direct chat, "...@g.us" for a
// group). Compared case-insensitively after trim: the same address can arrive with
// different casing across engines, and a case flip must not silently deny the operator.
export function isAllowed(jid: string, allow: ReadonlySet<string>): boolean {
  return allow.has(jid.trim().toLowerCase())
}

export function normalizeJid(jid: string): string {
  return jid.trim().toLowerCase()
}
