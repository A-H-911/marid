// WBS-8.2 part 2 — AC-026 env-pierce disclosure. The marid binary isolates all
// machine-global dirs (P-6), but inherited OPENCODE_* data-layer env vars still
// pierce that isolation by design (DEC-022 keeps the env). This proves the
// disclosure names each active var — and, per INV-002, never prints its value.
import { describe, test, expect } from "bun:test"
import { pierceMessage } from "../../src/marid-pierce"

describe("AC-026 env-pierce disclosure", () => {
  test("no piercing env → no message", () => {
    expect(pierceMessage({})).toBeUndefined()
  })

  test("names each active piercing var", () => {
    const msg = pierceMessage({ OPENCODE_DB: "/tmp/x.db", OPENCODE_CONFIG_DIR: "/tmp/cfg" })
    expect(msg).toContain("OPENCODE_DB")
    expect(msg).toContain("OPENCODE_CONFIG_DIR")
    expect(msg).toContain("pierced")
    // Inactive vars are not mentioned.
    expect(msg).not.toContain("OPENCODE_AUTH_CONTENT")
  })

  test("INV-002: discloses the var NAME but never its (secret) VALUE", () => {
    const msg = pierceMessage({
      OPENCODE_AUTH_CONTENT: '{"nvidia":"SECRET_TOKEN"}',
      OPENCODE_CONFIG_CONTENT: '{"model":"SECRET_MODEL"}',
    })
    expect(msg).toContain("OPENCODE_AUTH_CONTENT")
    expect(msg).toContain("OPENCODE_CONFIG_CONTENT")
    expect(msg).not.toContain("SECRET_TOKEN")
    expect(msg).not.toContain("SECRET_MODEL")
  })

  test("empty-string env value is treated as unset", () => {
    expect(pierceMessage({ OPENCODE_DB: "" })).toBeUndefined()
  })
})
