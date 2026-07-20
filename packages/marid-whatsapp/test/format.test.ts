import { describe, expect, test } from "bun:test"
import { toWhatsApp } from "../src/format"

// F3 (EXP-012): the agent emits markdown; WhatsApp uses *bold* / _italic_ / ~strike~ /
// ```mono```. The asterisk is the trap — markdown *x* is italic but WhatsApp *x* is bold.
describe("toWhatsApp", () => {
  test.each([
    ["**bold**", "*bold*"],
    ["__bold__", "*bold*"],
    ["*italic*", "_italic_"], // markdown italic → WhatsApp italic (NOT bold)
    ["_italic_", "_italic_"], // already WhatsApp italic
    ["~~strike~~", "~strike~"],
    ["**b** and *i*", "*b* and _i_"], // bold + italic together, no collision
    ["## Heading", "*Heading*"],
    ["[text](https://x.io)", "text (https://x.io)"],
    ["plain text", "plain text"],
  ])("converts %p → %p", (input, expected) => {
    expect(toWhatsApp(input)).toBe(expected)
  })

  test("inline `code` becomes triple-backtick monospace", () => {
    expect(toWhatsApp("run `npm i` now")).toBe("run ```npm i``` now")
  })

  test("a fenced block keeps ``` and drops the language tag", () => {
    expect(toWhatsApp("```js\nconst x = 1\n```")).toBe("```\nconst x = 1\n```")
  })

  test("markdown INSIDE code is not converted (code is protected)", () => {
    expect(toWhatsApp("`**not bold**`")).toBe("```**not bold**```")
  })

  test("a `* ` list marker becomes `- ` (not read as bold)", () => {
    expect(toWhatsApp("* first\n* second")).toBe("- first\n- second")
  })

  // Partial/unclosed markdown mid-stream must be left literal (it resolves when the closing
  // marker streams in) — never mangled.
  test("unclosed bold is left literal", () => {
    expect(toWhatsApp("here is **bold that never clo")).toBe("here is **bold that never clo")
  })
})
