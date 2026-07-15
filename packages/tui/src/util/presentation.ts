import {
  logo as brand,
  FLAME_EDGE,
  FLAME_CORE,
  WORDMARK_BLUE,
  WORDMARK_ORANGE,
  WORDMARK_SPLIT,
  hexToRgb,
  supportsTrueColor,
} from "../logo"

// The /exit goodbye. Renders the SAME Marid mark as the startup logo (one source of truth in logo.ts,
// so a rebrand or glyph change can't leave a stale goodbye), in FULL COLOR — flame gradient + two-tone
// "MARID" wordmark, matching the startup banner rather than a dim monochrome.
const reset = "\x1b[0m"
const bold = "\x1b[1m"
const dim = "\x1b[90m"
const ansi = (hex: string) => {
  const [r, g, b] = hexToRgb(hex)
  return `\x1b[38;2;${r};${g};${b}m`
}
const EDGE = FLAME_EDGE.map(ansi)
const CORE = FLAME_CORE.map(ansi)
const BLUE = ansi(WORDMARK_BLUE)
const ORANGE = ansi(WORDMARK_ORANGE)
const at = (list: string[], index: number) => list[index] ?? list[list.length - 1]

function mark(pad = "") {
  const truecolor = supportsTrueColor()
  const flame = (line: string, core: string, row: number) =>
    Array.from(line)
      .map((char, col) =>
        char === " " ? " " : `${core[col] && core[col] !== " " ? at(CORE, row) : at(EDGE, row)}${char}${reset}`,
      )
      .join("")
  const word = (line: string) =>
    Array.from(line)
      .map((char, col) => (char === " " ? " " : `${bold}${truecolor ? (col < WORDMARK_SPLIT ? BLUE : ORANGE) : ""}${char}${reset}`))
      .join("")
  return brand.left.map(
    (line, index) => `${pad}${flame(line, brand.leftCore[index] ?? "", index)} ${word(brand.right[index] ?? "")}`,
  )
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
