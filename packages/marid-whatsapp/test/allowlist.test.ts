import { describe, expect, test } from "bun:test"
import { isAllowed, normalizeJid } from "../src/allowlist"

// AC-018 "stranger ignored" / FR-050 / INV-001 threat-model B1.

const ALLOW = new Set(["11111111111@c.us", "9999@g.us"])

describe("isAllowed — deny by default", () => {
  test("allows a listed JID", () => {
    expect(isAllowed("11111111111@c.us", ALLOW)).toBe(true)
  })

  test("ignores a stranger", () => {
    expect(isAllowed("22222222222@c.us", ALLOW)).toBe(false)
  })

  test("an empty allowlist denies everyone", () => {
    expect(isAllowed("11111111111@c.us", new Set())).toBe(false)
  })

  // Engines differ on JID casing; a case flip must not lock the operator out.
  test("is case-insensitive and whitespace-tolerant", () => {
    expect(isAllowed("  11111111111@C.US  ", ALLOW)).toBe(true)
  })

  // A near-miss must not pass — no prefix/suffix matching.
  test.each(["11111111111@c.usx", "111111111110@c.us", "1111111111@c.us", "11111111111", "@c.us", ""])(
    "rejects near-miss %p",
    (jid) => {
      expect(isAllowed(jid, ALLOW)).toBe(false)
    },
  )
})

describe("normalizeJid", () => {
  test("trims and lowercases", () => {
    expect(normalizeJid("  11111111111@C.Us ")).toBe("11111111111@c.us")
  })
})
