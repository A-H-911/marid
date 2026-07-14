import { afterEach, expect, test } from "bun:test"
import { supportsTrueColor, WORDMARK_SPLIT, logo } from "../src/logo"

const original = process.env["COLORTERM"]
afterEach(() => {
  if (original === undefined) delete process.env["COLORTERM"]
  else process.env["COLORTERM"] = original
})

test("supportsTrueColor is true for truecolor / 24bit", () => {
  process.env["COLORTERM"] = "truecolor"
  expect(supportsTrueColor()).toBe(true)
  process.env["COLORTERM"] = "24bit"
  expect(supportsTrueColor()).toBe(true)
})

test("supportsTrueColor is false when COLORTERM is absent or 256-color (mono fallback path)", () => {
  delete process.env["COLORTERM"]
  expect(supportsTrueColor()).toBe(false)
  process.env["COLORTERM"] = "256color"
  expect(supportsTrueColor()).toBe(false)
})

test("logo halves are equal height so all three renderers zip row-for-row", () => {
  expect(logo.right.length).toBe(logo.left.length)
  expect(logo.leftCore.length).toBe(logo.left.length)
})

test("leftCore is a strict subset of left's filled cells (no core color on a blank cell)", () => {
  logo.leftCore.forEach((coreRow, r) => {
    Array.from(coreRow).forEach((ch, c) => {
      if (ch !== " ") expect(logo.left[r]?.[c]).not.toBe(" ")
    })
  })
})

test("wordmark split column lands within the letter rows (blue MAR | orange ID boundary)", () => {
  expect(WORDMARK_SPLIT).toBeGreaterThan(0)
  const letters = logo.right[2] ?? ""
  expect(letters.length).toBeGreaterThanOrEqual(WORDMARK_SPLIT)
})
