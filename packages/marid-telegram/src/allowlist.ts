// INV-001 trust boundary (threat model B1). A Telegram bot is reachable by anyone
// who finds it, and the Bot API has no built-in allowlist, so the gateway must
// gate every inbound update by sender id — deny-by-default. This predicate is
// applied to BOTH message.from.id and callback_query.from.id in router.ts.
export function isAllowed(userId: number, allow: ReadonlySet<number>): boolean {
  return allow.has(userId)
}
