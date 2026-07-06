// Secret redaction for the Telegram gateway (INV-002 / RISK-007).
//
// The bot token can control the bot, and it is embedded raw in every Bot API URL
// and — the easy-to-miss case — in file-download URLs
// (https://api.telegram.org/file/bot<token>/<path>). Any string that MIGHT reach a
// log line or a channel message is passed through redact() first, so the token
// never lands in logs, session history, or diagnostics.

const MASK = "<redacted>"

// Literal (non-regex) replacement of every occurrence of the token. A bot token
// contains a ":" and "-", which are harmless to String.split's literal matching,
// so no escaping is needed. An empty token is a no-op — splitting on "" would
// otherwise explode the string into characters.
export function redact(text: string, token: string): string {
  if (!token) return text
  return text.split(token).join(MASK)
}
