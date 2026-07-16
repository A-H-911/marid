// marid brand mark (P-2, WBS-8.4). Rendered in color by two consumers — component/logo.tsx (TUI,
// opentui RGBA) and packages/opencode/src/cli/ui.ts (CLI, raw ANSI) — and dimmed by
// util/presentation.ts for the /exit goodbye. All three zip `left[i]` with `right[i]`, so both
// halves are 3 rows — the flame is the SAME height as the wordmark letters (operator call: the
// earlier 6-row flame towered over the words). `left` is the flame glyph; `leftCore` marks the inner
// cells that take the brighter core gradient (a strict subset of `left`'s filled cells — same column,
// block char). `right` is the "MARID" wordmark, one row per letter band, flush with the flame.
// Block chars only (█ ▀ ▄ ▟ ▙ ▜ ▛ space) so every renderer agrees; no shadow marks (they muddy it).
//
// Retuning the mark is data-only: edit the glyph rows, the core mask, the gradients, or the split
// column below — the render logic in the two consumers is generic.
export const logo = {
  left: [
    " ▟█▙ ",
    "▐███▌",
    " ▜█▛ ",
  ],
  leftCore: [
    "     ",
    "  █  ",
    "  █  ",
  ],
  right: [
    "█▄ ▄█ ▄▀▀▄ █▀▀▄ ▀█▀ █▀▀▄",
    "█ ▀ █ █▄▄█ █▄▄▀  █  █  █",
    "█   █ █  █ █ ▀▄ ▄█▄ █▄▄▀",
  ],
}

// Compact 3-row flame badge for the run-mode scrollback splash (cli/cmd/run/splash.ts), where the
// full 6-row mark is too tall. Same flame DNA, block chars only.
export const badge = ["▟█▙", "▜█▛", " ▀ "]

// Flame gradient, top -> base (one hex per `left` row). Edge = outer flame; core = the brighter
// inner highlight applied where `leftCore` is filled.
export const FLAME_EDGE = ["#FBD24A", "#F5901E", "#DC2A16"]
export const FLAME_CORE = ["#FDEFB0", "#FAD062", "#F8B73C"]

// Two-tone wordmark: columns < WORDMARK_SPLIT render blue ("MAR"), the rest orange ("ID"). Applied
// only when the terminal signals truecolor (see supportsTrueColor); otherwise the wordmark renders
// in a single tone (crisp-mono fallback — the AC-029 render gate).
export const WORDMARK_BLUE = "#2F6BFF"
export const WORDMARK_ORANGE = "#F0731F"
export const WORDMARK_SPLIT = 16

// AC-029 render gate: the blue/orange split can muddy when downsampled to 256 colors, so only apply
// it where 24-bit color is signalled. Uses the COLORTERM convention the theme docs document.
export function supportsTrueColor(): boolean {
  const colorterm = process.env["COLORTERM"]
  return colorterm === "truecolor" || colorterm === "24bit"
}

// hex "#RRGGBB" -> [r, g, b]. Shared by the ANSI (cli/ui.ts) and any other raw consumer.
export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
