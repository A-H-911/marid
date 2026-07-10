// Egress formatting for Telegram (WBS-4.2/6.2, research §3, ADR-0009).
//
// Assistant text is rendered as MarkdownV2 via telegramify-markdown (defect 1: raw
// `**bold**` used to reach the chat literally). telegramify escapes MarkdownV2
// specials and converts `**bold**`->`*bold*`, lists->•, preserving inline code and
// fences. `escapeHtml` remains for any HTML-mode surface; splitMessage still breaks
// on line boundaries — chunks are telegramified individually by the streamer.

import telegramify from "telegramify-markdown"

const TELEGRAM_TEXT_LIMIT = 4096

// Render assistant Markdown as Telegram MarkdownV2. telegramify appends a trailing
// newline we trim. Returns undefined if it throws (e.g. a malformed/partial fence
// arriving mid-stream) so the caller falls back to plain text; the streamer's
// 400->plain resend is the second net for a chunk Telegram rejects.
export function toMarkdownV2(text: string): string | undefined {
  try {
    return telegramify(text, "escape").replace(/\n$/, "")
  } catch {
    return undefined
  }
}

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
