import { logo as brand } from "../logo"

// The /exit goodbye. Renders the SAME Marid mark as the startup logo (packages/tui/src/logo.ts — one
// source of truth, so a rebrand or a glyph-height change can never leave a stale wordmark here again),
// in an understated dim style rather than the startup's full color. Previously this file carried its own
// block-art logo that still spelled "OpenCode" — invisible to string greps, which is why it slipped.
const reset = "\x1b[0m"
const bold = "\x1b[1m"
const dim = "\x1b[90m"

function mark(pad = "") {
  const paint = (line: string) =>
    Array.from(line)
      .map((char) => (char === " " ? " " : `${dim}${char}${reset}`))
      .join("")
  return brand.left.map((line, index) => `${pad}${paint(line)} ${paint(brand.right[index] ?? "")}`)
}

export function sessionEpilogue(input: { title: string; sessionID?: string }) {
  const weak = (text: string) => `${dim}${text.padEnd(10, " ")}${reset}`
  return [
    ...mark("  "),
    "",
    `  ${weak("Session")}${bold}${input.title}${reset}`,
    `  ${weak("Continue")}${bold}marid -s ${input.sessionID}${reset}`,
    "",
  ].join("\n")
}
