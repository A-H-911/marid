// WBS-8.2 Phase 3 — agent identity (DEC-026, AC-028). The marid distribution must
// not present itself as OpenCode. This proves the choke-point transform rebrands
// identity + URLs, leaves the upstream `opencode` app byte-unchanged (regression),
// and — the CI GUARD — that NO shipped prompt (including any sync-added one) emits
// the opencode brand once transformed.
import { describe, test, expect } from "bun:test"
import { readdirSync, readFileSync } from "fs"
import path from "path"
import { maridizePrompt } from "../../src/session/marid-identity"

const PROMPT_DIR = path.resolve(import.meta.dir, "../../src/session/prompt")
// A kept `.opencode/` reference must NOT be rebranded (DEC-024).
const BRAND = /(?<!\.)\bopencode\b/i

describe("maridizePrompt (marid app)", () => {
  test("rebrands the identity statement", () => {
    expect(maridizePrompt("You are OpenCode, the best coding agent.", "marid")).toBe(
      "You are Marid, the best coding agent.",
    )
    expect(maridizePrompt("Your name is opencode", "marid")).toBe("Your name is marid")
  })

  test("repoints the feedback repo + doc-fetch URLs to the Marid repo", () => {
    expect(maridizePrompt("report at https://github.com/anomalyco/opencode/issues", "marid")).toContain(
      "https://github.com/A-H-911/marid/issues",
    )
    expect(maridizePrompt("docs at https://opencode.ai/docs", "marid")).toContain("https://github.com/A-H-911/marid")
  })

  test("preserves the kept .opencode project dir name (DEC-024)", () => {
    expect(maridizePrompt("place agents in .opencode/agents", "marid")).toContain(".opencode/agents")
  })
})

describe("regression: upstream opencode app is byte-unchanged", () => {
  test("app=opencode returns the text verbatim", () => {
    const t = "You are OpenCode. See https://github.com/anomalyco/opencode and https://opencode.ai/docs"
    expect(maridizePrompt(t, "opencode")).toBe(t)
  })
})

describe("CI GUARD: no shipped prompt leaks the opencode brand once transformed", () => {
  const files = readdirSync(PROMPT_DIR).filter((f) => f.endsWith(".txt"))
  test("prompt dir is non-empty (the guard actually runs)", () => {
    expect(files.length).toBeGreaterThan(0)
  })
  for (const file of files) {
    test(`${file} → no \\bopencode\\b after rebrand`, () => {
      const emitted = maridizePrompt(readFileSync(path.join(PROMPT_DIR, file), "utf8"), "marid")
      expect(emitted).not.toMatch(BRAND)
    })
  }
})
