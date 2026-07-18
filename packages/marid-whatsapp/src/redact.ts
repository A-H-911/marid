// INV-002: secrets never land in logs or diagnostics.
//
// WhatsApp raises a hazard Telegram does not. WAHA's WebSocket takes its API key in the
// QUERY STRING (`ws://waha:3000/ws?x-api-key=...&session=*`), and the HTTP API takes it
// in a header. So the connection URL — the exact thing you reflexively log on connect,
// reconnect, and every backoff retry — carries the secret inline. Same for any error
// that echoes the request URL.
//
// So this redacts BOTH shapes: the literal value (like marid-telegram/redact.ts) and
// the `x-api-key=<anything>` query parameter, because a URL can reach a log via a
// stack trace or a WAHA error body without the value ever passing through our hands.

const API_KEY_PARAM = /([?&]x-api-key=)[^&\s"']+/gi

export function redact(text: string, apiKey?: string): string {
  const masked = text.replace(API_KEY_PARAM, "$1***")
  // Empty/undefined key is a no-op: an empty split() would shred the whole string.
  if (!apiKey) return masked
  return masked.split(apiKey).join("***")
}

// Wrap every log line at the composition root: `const safeLog = makeSafeLog(console.log, key)`.
export function makeSafeLog(sink: (line: string) => void, apiKey?: string): (line: string) => void {
  return (line: string) => sink(redact(line, apiKey))
}
