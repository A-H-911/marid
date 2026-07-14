// Visual harness for the TUI logo + /exit goodbye (Marid PH-8). The startup logo (cli/ui.ts `logo()`)
// and the goodbye (presentation.ts `sessionEpilogue()`) are pure functions that emit ANSI. This script
// forces the color gate on, captures their ANSI, parses SGR into a cell grid, and emits a self-contained
// HTML preview you can screenshot (headless Chrome) — so terminal art can be reviewed without a live TTY.
//
//   bun run packages/tui/script/render-logo.ts [--out preview.html]
//
// Then screenshot: chrome.exe --headless=new --screenshot=out.png --window-size=W,H file:///<abs preview.html>
//
// NOTE: this renders the CLI ANSI render (a faithful proxy of the opentui TUI for glyph shape/height;
// exact per-cell colors may differ slightly from opentui's RGBA compositing).

// The color gate: cli/ui.ts `logo()` only colorizes when stdout is a TTY and COLORTERM signals truecolor
// (logo.ts `supportsTrueColor()`). Force both BEFORE importing/calling so we capture the colored output.
process.env["COLORTERM"] = "truecolor"
Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })
Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true })

const { logo } = await import("../../opencode/src/cli/ui.ts")
const { sessionEpilogue } = await import("../src/util/presentation.ts")

type Cell = { ch: string; fg?: string; bg?: string; bold?: boolean }

const BASE16: [number, number, number][] = [
  [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0], [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
  [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0], [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
]
function xterm256(n: number): [number, number, number] {
  if (n < 16) return BASE16[n]
  if (n >= 232) { const g = 8 + 10 * (n - 232); return [g, g, g] }
  const i = n - 16
  const conv = (v: number) => (v === 0 ? 0 : 55 + v * 40)
  return [conv(Math.floor(i / 36)), conv(Math.floor((i % 36) / 6)), conv(i % 6)]
}
const rgb = (t: [number, number, number]) => `rgb(${t[0]},${t[1]},${t[2]})`

// Parse one line of ANSI (SGR only) into cells, threading state across the line.
function parseLine(line: string): Cell[] {
  const cells: Cell[] = []
  let fg: string | undefined
  let bg: string | undefined
  let bold = false
  let i = 0
  while (i < line.length) {
    if (line[i] === "\x1b" && line[i + 1] === "[") {
      const end = line.indexOf("m", i)
      if (end === -1) break
      const codes = line.slice(i + 2, end).split(";").map(Number)
      for (let c = 0; c < codes.length; c++) {
        const code = codes[c]
        if (code === 0) { fg = undefined; bg = undefined; bold = false }
        else if (code === 1) bold = true
        else if (code === 22) bold = false
        else if (code === 90) fg = rgb(BASE16[8])
        else if (code >= 30 && code <= 37) fg = rgb(BASE16[code - 30])
        else if (code >= 40 && code <= 47) bg = rgb(BASE16[code - 40])
        else if (code === 38 || code === 48) {
          const kind = codes[c + 1]
          if (kind === 2) { const t: [number, number, number] = [codes[c + 2], codes[c + 3], codes[c + 4]]; if (code === 38) fg = rgb(t); else bg = rgb(t); c += 4 }
          else if (kind === 5) { const t = xterm256(codes[c + 2]); if (code === 38) fg = rgb(t); else bg = rgb(t); c += 2 }
        }
      }
      i = end + 1
      continue
    }
    cells.push({ ch: line[i], fg, bg, bold })
    i++
  }
  return cells
}

function block(title: string, ansi: string): string {
  const rows = ansi.split(/\r?\n/).map(parseLine)
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const rowsHtml = rows
    .map((cells) => {
      const spans = cells
        .map((cell) => {
          const style = [
            cell.fg ? `color:${cell.fg}` : "color:#cfcfcf",
            cell.bg ? `background:${cell.bg}` : "",
            cell.bold ? "font-weight:700" : "",
          ].filter(Boolean).join(";")
          return `<span style="${style}">${esc(cell.ch === " " ? " " : cell.ch)}</span>`
        })
        .join("")
      return `<div class="row">${spans || "&nbsp;"}</div>`
    })
    .join("")
  return `<section><h2>${esc(title)}</h2><div class="term">${rowsHtml}</div></section>`
}

const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; background: #0a0a0a; color: #cfcfcf;
    font-family: "Cascadia Mono", "Consolas", "DejaVu Sans Mono", monospace; }
  main { padding: 28px 32px; display: flex; flex-direction: column; gap: 26px; }
  h2 { font: 600 12px/1 system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase;
    color: #6b6b6b; margin: 0 0 10px; }
  .term { display: inline-block; }
  .row { white-space: pre; line-height: 1; height: 1.02em; }
  .row span { display: inline-block; width: 1ch; }
</style><main>
  ${block("Startup logo — cli/ui.ts logo()", logo(""))}
  ${block("Exit goodbye — presentation.ts sessionEpilogue()", sessionEpilogue({ title: "Fix the TUI logo", sessionID: "ses_demo123" }))}
</main>`

const outArg = process.argv.indexOf("--out")
const out = outArg !== -1 ? process.argv[outArg + 1] : "logo-preview.html"
await Bun.write(out, html)
console.log(out)
