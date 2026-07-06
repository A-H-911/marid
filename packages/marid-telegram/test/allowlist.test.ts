import { describe, expect, test } from "bun:test"
import { isAllowed } from "../src/allowlist"

// INV-001 trust boundary: only the operator's Telegram user id(s) may reach the
// agent. Everyone else is dropped (deny-by-default). Anyone can discover and
// message a bot, so this check is mandatory and the Bot API has no built-in
// allowlist.
describe("isAllowed", () => {
  const allow = new Set([111, 222])

  test("an allowlisted id passes", () => {
    expect(isAllowed(111, allow)).toBe(true)
    expect(isAllowed(222, allow)).toBe(true)
  })

  test("a non-allowlisted id is rejected", () => {
    expect(isAllowed(333, allow)).toBe(false)
  })

  test("an empty allowlist rejects everyone (deny-by-default)", () => {
    expect(isAllowed(111, new Set())).toBe(false)
  })
})
