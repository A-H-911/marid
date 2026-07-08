// marid brand mark (P-2, WBS-5.4). `left` is the flame glyph (rendered red-orange by the
// consumers — see component/logo.tsx and packages/opencode/src/cli/ui.ts), `right` is the
// "MARID" wordmark rendered bright. Deliberately NO shadow marks (`_ ^ ~ ,`) in the wordmark:
// in-terminal they render as grey filled blocks that muddy the letters. The elegant
// drop-shadow lives in the SVG/PNG logo (docs/branding); the terminal stays crisp. Block
// chars only (█ ▀ ▄ space) so both renderers agree. Both halves are 4 rows.
export const logo = {
  left: ["  ▟▙  ", " ▟██▙ ", " ▜██▛ ", "  ▀▀  "],
  right: ["                        ", "█▄ ▄█ ▄▀▀▄ █▀▀▄ ▀█▀ █▀▀▄", "█ ▀ █ █▄▄█ █▄▄▀  █  █  █", "█   █ █  █ █ ▀▄ ▄█▄ █▄▄▀"],
}

export const go = {
  left: ["    ", "█▀▀▀", "█_^█", "▀▀▀▀"],
  right: ["    ", "█▀▀█", "█__█", "▀▀▀▀"],
}

export const marks = "_^~,"
