import { EOL } from "os"
import { Schema } from "effect"
import {
  logo as glyphs,
  FLAME_EDGE,
  FLAME_CORE,
  WORDMARK_BLUE,
  WORDMARK_ORANGE,
  WORDMARK_SPLIT,
  supportsTrueColor,
  hexToRgb,
} from "./logo"

export class CancelledError extends Schema.TaggedErrorClass<CancelledError>()("UICancelledError", {}) {}

export const Style = {
  TEXT_HIGHLIGHT: "\x1b[96m",
  TEXT_HIGHLIGHT_BOLD: "\x1b[96m\x1b[1m",
  TEXT_DIM: "\x1b[90m",
  TEXT_DIM_BOLD: "\x1b[90m\x1b[1m",
  TEXT_NORMAL: "\x1b[0m",
  TEXT_NORMAL_BOLD: "\x1b[1m",
  TEXT_WARNING: "\x1b[93m",
  TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m",
  TEXT_DANGER: "\x1b[91m",
  TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m",
  TEXT_SUCCESS: "\x1b[92m",
  TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m",
  TEXT_INFO: "\x1b[94m",
  TEXT_INFO_BOLD: "\x1b[94m\x1b[1m",
}

export function println(...message: string[]) {
  print(...message)
  process.stderr.write(EOL)
}

export function print(...message: string[]) {
  blank = false
  process.stderr.write(message.join(" "))
}

let blank = false
export function empty() {
  if (blank) return
  println("" + Style.TEXT_NORMAL)
  blank = true
}

export function logo(pad?: string) {
  const tty = process.stdout.isTTY || process.stderr.isTTY
  // Render gate: only split the wordmark blue/orange where 24-bit color is signalled.
  const truecolor = tty && supportsTrueColor()
  const reset = "\x1b[0m"
  const bold = "\x1b[1m"
  const ansi = (hex: string) => {
    const [r, g, b] = hexToRgb(hex)
    return `\x1b[38;2;${r};${g};${b}m`
  }
  const EDGE = FLAME_EDGE.map(ansi)
  const CORE = FLAME_CORE.map(ansi)
  const BLUE = ansi(WORDMARK_BLUE)
  const ORANGE = ansi(WORDMARK_ORANGE)
  const at = (list: string[], index: number) => list[index] ?? list[list.length - 1]

  const flame = (line: string, core: string, row: number) =>
    Array.from(line)
      .map((char, col) => {
        if (char === " ") return " "
        if (!tty) return char
        const fg = core[col] && core[col] !== " " ? at(CORE, row) : at(EDGE, row)
        return `${fg}${char}${reset}`
      })
      .join("")

  const word = (line: string) =>
    Array.from(line)
      .map((char, col) => {
        if (char === " ") return " "
        if (!truecolor) return char
        return `${bold}${col < WORDMARK_SPLIT ? BLUE : ORANGE}${char}${reset}`
      })
      .join("")

  const result: string[] = []
  glyphs.left.forEach((row, index) => {
    if (pad) result.push(pad)
    result.push(flame(row, glyphs.leftCore[index] ?? "", index))
    result.push(" ")
    result.push(word(glyphs.right[index] ?? ""))
    result.push(EOL)
  })
  return result.join("").trimEnd()
}

export async function input(prompt: string): Promise<string> {
  const readline = require("readline")
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export function error(message: string) {
  if (message.startsWith("Error: ")) {
    message = message.slice("Error: ".length)
  }
  println(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message)
}

export function markdown(text: string): string {
  return text
}

export * as UI from "./ui"
