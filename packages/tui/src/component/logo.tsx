import { RGBA, TextAttributes } from "@opentui/core"
import { For, type JSX } from "solid-js"
import { useTheme } from "../context/theme"
import {
  logo,
  FLAME_EDGE,
  FLAME_CORE,
  WORDMARK_BLUE,
  WORDMARK_ORANGE,
  WORDMARK_SPLIT,
  supportsTrueColor,
} from "../logo"

// One RGBA per flame row: EDGE for the outer flame, CORE for the brighter inner highlight.
const EDGE = FLAME_EDGE.map((hex) => RGBA.fromHex(hex))
const CORE = FLAME_CORE.map((hex) => RGBA.fromHex(hex))
const BLUE = RGBA.fromHex(WORDMARK_BLUE)
const ORANGE = RGBA.fromHex(WORDMARK_ORANGE)

const at = <T,>(list: T[], index: number): T => list[index] ?? list[list.length - 1]

export function Logo() {
  const { theme } = useTheme()
  // Render gate: only split the wordmark blue/orange on truecolor terminals; else a single tone.
  const truecolor = supportsTrueColor()

  const cell = (char: string, fg: RGBA, bold: boolean): JSX.Element => (
    <text fg={fg} attributes={bold ? TextAttributes.BOLD : undefined} selectable={false}>
      {char === " " ? " " : char}
    </text>
  )

  const flameRow = (line: string, core: string, row: number): JSX.Element[] =>
    Array.from(line).map((char, col) => {
      if (char === " ") return cell(" ", EDGE[0], false)
      const isCore = core[col] !== undefined && core[col] !== " "
      return cell(char, isCore ? at(CORE, row) : at(EDGE, row), false)
    })

  const wordmarkRow = (line: string): JSX.Element[] =>
    Array.from(line).map((char, col) => {
      if (char === " ") return cell(" ", theme.text, false)
      const fg = truecolor ? (col < WORDMARK_SPLIT ? BLUE : ORANGE) : theme.text
      return cell(char, fg, true)
    })

  return (
    <box>
      <For each={logo.left}>
        {(line, index) => (
          <box flexDirection="row" gap={1}>
            <box flexDirection="row">{flameRow(line, logo.leftCore[index()] ?? "", index())}</box>
            <box flexDirection="row">{wordmarkRow(logo.right[index()] ?? "")}</box>
          </box>
        )}
      </For>
    </box>
  )
}
