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

// F1 (EXP-012): modern WhatsApp addresses the operator by an opaque `@lid`, not their
// `@c.us` phone-JID, and the LID cannot be resolved to a number client-side (WAHA docs:
// it is a "hidden user ID"; no phone field on the frame, no resolver). Deny-by-default
// (INV-001) also forbids replying to the un-allowlisted sender, so the *only* recovery
// surface is this log line — it must name the exact JID the operator has to allow-list.
// ponytail: log-based self-serve is the ceiling; auto-resolve only if a stable LID→PN
// mapping ever appears on the transport.
export function denialMessage(jid: string): string {
  return `ignored message from non-allowlisted ${jid} — if this is you, add "${jid}" to MARID_WA_ALLOW`
}
