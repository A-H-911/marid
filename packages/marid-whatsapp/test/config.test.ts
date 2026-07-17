import { describe, expect, test } from "bun:test"
import { loadConfig } from "../src/config"

const BASE = { MARID_WA_WAHA_URL: "http://127.0.0.1:3000", MARID_WA_ALLOW: "11111111111@c.us" }

describe("loadConfig — fail fast at boot", () => {
  test("loads the minimum viable config", () => {
    const c = loadConfig(BASE)
    expect(c.wahaUrl).toBe("http://127.0.0.1:3000")
    expect(c.session).toBe("default")
    expect([...c.allow]).toEqual(["11111111111@c.us"])
    expect(c.wahaApiKey).toBeUndefined()
  })

  test("requires MARID_WA_WAHA_URL", () => {
    expect(() => loadConfig({ MARID_WA_ALLOW: "1@c.us" })).toThrow(/MARID_WA_WAHA_URL is required/)
  })

  test("requires MARID_WA_ALLOW", () => {
    expect(() => loadConfig({ MARID_WA_WAHA_URL: "http://x" })).toThrow(/MARID_WA_ALLOW/)
  })

  test("rejects an empty allowlist rather than denying everyone silently", () => {
    expect(() => loadConfig({ ...BASE, MARID_WA_ALLOW: " , " })).toThrow(/at least one operator JID/)
  })

  // A typo'd JID in a deny-by-default gate is indistinguishable from a working one at
  // runtime — the operator is just never allowed. So it must fail at boot.
  test.each(["not-a-jid", "11111111111", "11111111111@s.whatsapp.net", "@c.us"])(
    "rejects malformed JID %p at boot",
    (jid) => {
      expect(() => loadConfig({ ...BASE, MARID_WA_ALLOW: jid })).toThrow(/invalid WhatsApp JID/)
    },
  )

  test("accepts direct, group and lid JIDs, normalized", () => {
    const c = loadConfig({ ...BASE, MARID_WA_ALLOW: " 11111111111@C.US , 9999@g.us,123@lid " })
    expect([...c.allow]).toEqual(["11111111111@c.us", "9999@g.us", "123@lid"])
  })

  test("strips trailing slashes from the WAHA url", () => {
    expect(loadConfig({ ...BASE, MARID_WA_WAHA_URL: "http://127.0.0.1:3000///" }).wahaUrl).toBe("http://127.0.0.1:3000")
  })

  test("carries the optional api key and session", () => {
    const c = loadConfig({ ...BASE, MARID_WA_WAHA_API_KEY: "sekret", MARID_WA_SESSION: "marid" })
    expect(c.wahaApiKey).toBe("sekret")
    expect(c.session).toBe("marid")
  })

  test.each([
    ["MARID_WA_CADENCE_MS", "cadenceMs"],
    ["MARID_WA_PERMISSION_TIMEOUT_MS", "permissionTimeoutMs"],
    ["MARID_WA_APPROVAL_TTL_MS", "approvalTtlMs"],
  ])("%s parses as a non-negative integer", (envName, field) => {
    expect(loadConfig({ ...BASE, [envName]: "1500" })[field as "cadenceMs"]).toBe(1500)
    expect(() => loadConfig({ ...BASE, [envName]: "-1" })).toThrow(new RegExp(envName))
    expect(() => loadConfig({ ...BASE, [envName]: "abc" })).toThrow(new RegExp(envName))
  })
})
