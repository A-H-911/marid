// marid brand mark (P-2, WBS-5.4). `left` is the flame glyph (rendered red-orange by
// the consumers — see component/logo.tsx and packages/opencode/src/cli/ui.ts), `right`
// is the "marid" wordmark rendered bright with the same drop-shadow the upstream banner
// used. The shadow lives in the mark chars below (`marks`), applied by both renderers.
// NOTE: only `_ ^ ~` are safe here — the CLI renderer (cli/ui.ts draw()) does not
// special-case `,`, so a `,` would print literally. Keep both halves 4 rows.
export const logo = {
  left: ["  ▟▙  ", " ▟██▙ ", " ▜██▛ ", "  ▀▀  "],
  right: ["                     ", "█▄ ▄█ █▀█ █▀█ █ █▀▀▄  ", "█ ▀ █ █^█ █▀▄ █ █__█  ", "▀   ▀ ▀~▀ ▀ ▀▀ ▀ ▀~~▀ "],
}

export const go = {
  left: ["    ", "█▀▀▀", "█_^█", "▀▀▀▀"],
  right: ["    ", "█▀▀█", "█__█", "▀▀▀▀"],
}

export const marks = "_^~,"
