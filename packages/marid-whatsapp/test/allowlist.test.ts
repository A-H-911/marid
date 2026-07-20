import { describe, expect, test } from "bun:test"
import { denialMessage, isAllowed, normalizeJid } from "../src/allowlist"

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

// F1 (EXP-012): modern WhatsApp delivers the sender as an opaque `@lid`, not the
// `@c.us` phone-JID, and the LID cannot be resolved to a number client-side. The gate
// stays exact-match; the operator lists the `@lid` (discoverable from the denial log).
describe("isAllowed — @lid senders (F1)", () => {
  const LID_ALLOW = new Set(["22222222222222@lid", "11111111111@c.us"])

  test("allows a listed @lid sender", () => {
    expect(isAllowed("22222222222222@lid", LID_ALLOW)).toBe(true)
  })

  test("a @c.us entry does NOT cover the same operator's @lid (no resolution)", () => {
    expect(isAllowed("22222222222222@lid", new Set(["11111111111@c.us"]))).toBe(false)
  })

  test("an unlisted @lid is denied", () => {
    expect(isAllowed("999999999999999@lid", LID_ALLOW)).toBe(false)
  })
})

// The only recovery surface for a denied operator is the gateway log (we cannot reply
// to a non-allowlisted sender — INV-001). It must name the exact JID to add.
describe("denialMessage — self-serve recovery", () => {
  test("names the exact JID and the env var to add it to", () => {
    const msg = denialMessage("22222222222222@lid")
    expect(msg).toContain("22222222222222@lid")
    expect(msg).toContain("MARID_WA_ALLOW")
  })
})

describe("normalizeJid", () => {
  test("trims and lowercases", () => {
    expect(normalizeJid("  11111111111@C.Us ")).toBe("11111111111@c.us")
  })
})
