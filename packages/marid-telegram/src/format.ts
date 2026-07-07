// Egress formatting for Telegram (WBS-4.2, research §3).
//
// The gateway sends in HTML parse mode, so only `< > &` need escaping. Markdown
// code fences (```) are inert text in HTML mode, so splitting never has to
// close/reopen a fence — line-boundary splitting is sufficient and safe. (Rich
// code rendering via <pre> is the upgrade path; not needed for KPI-002.)

const TELEGRAM_TEXT_LIMIT = 4096

// Escape order matters: & first, or it would double-escape the & in &lt;/&gt;.
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Split into parts each within Telegram's 4096-char limit, breaking on line
// boundaries (so an HTML entity like &lt; — which never spans a newline — is never
// cut in half). A single line longer than the limit is hard-chunked as a last
// resort; if that ever splits an entity, the caller's plain-text fallback on a 400
// recovers that part. (Telegram counts length after entity parsing, where &lt; is 1
// char, so measuring the escaped string is conservative — we may split slightly
// early, never late.)
export function splitMessage(text: string, limit: number = TELEGRAM_TEXT_LIMIT): string[] {
  if (text.length <= limit) return [text]
  const parts: string[] = []
  let current = ""

  const flush = () => {
    if (current !== "") parts.push(current)
    current = ""
  }

  for (let line of text.split("\n")) {
    // Hard-chunk any single line that alone exceeds the limit.
    while (line.length > limit) {
      flush()
      parts.push(line.slice(0, limit))
      line = line.slice(limit)
    }
    const addition = current === "" ? line : "\n" + line
    if (current !== "" && current.length + addition.length > limit) {
      flush()
      current = line
    } else {
      current += addition
    }
  }
  flush()
  return parts
}
