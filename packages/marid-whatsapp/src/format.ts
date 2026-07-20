// Markdown → WhatsApp text formatting (F3, EXP-012). The agent emits CommonMark-ish
// markdown; WhatsApp uses a different, lightweight syntax, so `**bold**` / `_italic_` /
// fenced code render literally without this. The Telegram channel has the analogue
// (marid-telegram/src/format.ts via telegramify-markdown); no comparable CommonMark→WhatsApp
// library exists on npm (the "whatsapp-markdown" packages parse WhatsApp text, they don't
// emit it), so this is a small hand-rolled transform.
//
// WhatsApp's documented syntax: *bold*, _italic_, ~strikethrough~, ```monospace``` (triple
// backtick — there is NO single-backtick inline). The load-bearing subtlety is the asterisk:
// markdown `*x*` is ITALIC but WhatsApp `*x*` is BOLD, so a naive pass would flip meaning.
// We convert bold FIRST into a sentinel, then italic, then restore — so the two never collide.
//
// Applied by the streamer to the FULL accumulated text on every edit (stream.ts reconcile),
// and always to the RAW markdown (the streamer stores converted text only for its
// no-op-edit check, never feeding it back), so re-conversion of our own output never happens
// — strict idempotency is therefore not required. Partial/unclosed markdown mid-stream (a
// lone `**`) is left literal and resolves once the closing marker streams in.

// Control-char sentinels (computed, so no literal control byte lives in this source). They
// stand in for produced markup during the passes so a later pass can't re-interpret it.
const BOLD = String.fromCharCode(1) // WhatsApp bold `*`, kept out of the italic pass
const CODE = String.fromCharCode(2) // marks an extracted code span, restored last

export function toWhatsApp(md: string): string {
  const codes: string[] = []
  const out = md
    // 1. Protect code (fenced ```…``` and inline `…`) from every other transform.
    .replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => `${CODE}${codes.push(m) - 1}${CODE}`)
    // 2. List markers `* ` / `+ ` → `- ` (a leading `*` would otherwise read as bold).
    .replace(/^([ \t]*)[*+] +/gm, "$1- ")
    // 3. Bold **x** / __x__ → sentinel (before italic so the produced `*` isn't re-read).
    .replace(/\*\*([^*\n]+)\*\*/g, `${BOLD}$1${BOLD}`)
    .replace(/__([^_\n]+)__/g, `${BOLD}$1${BOLD}`)
    // 4. Italic *x* → _x_ (markdown `_x_` already equals WhatsApp italic, left as-is).
    .replace(/\*([^*\n]+)\*/g, "_$1_")
    // 5. Strikethrough ~~x~~ → ~x~.
    .replace(/~~([^~\n]+)~~/g, "~$1~")
    // 6. Headings `# …` → *bold line*; links [text](url) → text (url).
    .replace(/^#{1,6}[ \t]+(.+)$/gm, "*$1*")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    // 7. Restore the bold sentinel as WhatsApp `*`.
    .split(BOLD)
    .join("*")
  // 8. Restore code: inline `x` → ```x``` (WhatsApp monospace); fenced keeps ``` but drops
  //    any language tag on the opening line.
  return out.replace(new RegExp(`${CODE}(\\d+)${CODE}`, "g"), (_, i: string) => {
    const c = codes[Number(i)]!
    if (c.startsWith("```")) return c.replace(/^```[^\n]*\n?/, "```\n")
    return "```" + c.slice(1, -1) + "```"
  })
}
