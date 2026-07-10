import { describe, expect, test } from "bun:test"
import { escapeHtml, splitMessage, toMarkdownV2 } from "../src/format"

describe("escapeHtml", () => {
  test("escapes &, <, > in the right order", () => {
    expect(escapeHtml("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d")
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;")
    // & is escaped first so an existing entity-looking sequence is not double-escaped wrongly
    expect(escapeHtml("&lt;")).toBe("&amp;lt;")
  })
})

describe("toMarkdownV2 (defect 1)", () => {
  test("converts bold, inline code, and lists to MarkdownV2 markup", () => {
    const out = toMarkdownV2("Here is **bold**, `code`:\n- one\n- two")
    expect(out).toBeDefined()
    expect(out).toContain("*bold*") // MarkdownV2 bold is single asterisks
    expect(out).toContain("`code`") // inline code preserved
    expect(out).toContain("•") // list bulletized
    expect(out).not.toContain("**bold**") // the raw Markdown is gone
  })

  test("preserves fenced code blocks", () => {
    const out = toMarkdownV2("```js\nconst x = 1\n```")
    expect(out).toContain("```")
    expect(out).toContain("const x = 1")
  })

  test("escapes MarkdownV2 special characters in plain text", () => {
    expect(toMarkdownV2("Done.")).toBe("Done\\.") // a lone dot must be escaped for MarkdownV2
  })

  test("trims the trailing newline telegramify appends", () => {
    expect(toMarkdownV2("hello")).toBe("hello") // not "hello\n"
  })
})

describe("splitMessage", () => {
  test("returns a single part when within the limit", () => {
    expect(splitMessage("short", 4096)).toEqual(["short"])
  })

  test("splits on line boundaries and reconstructs with newlines", () => {
    const text = ["aaaa", "bbbb", "cccc", "dddd"].join("\n") // 4 lines of 4 = 19 chars w/ newlines
    const parts = splitMessage(text, 10)
    expect(parts.every((p) => p.length <= 10)).toBe(true)
    expect(parts.join("\n")).toBe(text) // clean line-boundary split reconstructs
    expect(parts.length).toBeGreaterThan(1)
  })

  test("never emits a part longer than the limit, even for a single over-long line", () => {
    const longLine = "x".repeat(45)
    const parts = splitMessage(`intro\n${longLine}\noutro`, 20)
    expect(parts.every((p) => p.length <= 20)).toBe(true)
    expect(parts.join("").includes("x".repeat(45))).toBe(true) // no characters dropped
  })

  test("code fences are inert text (HTML mode) — split on lines, no fence handling", () => {
    const text = "```ts\nconst a = 1\nconst b = 2\n```"
    const parts = splitMessage(text, 15)
    expect(parts.every((p) => p.length <= 15)).toBe(true)
    expect(parts.join("\n")).toBe(text) // content preserved verbatim
  })
})
