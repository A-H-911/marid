import { describe, expect, test } from "bun:test"
import { loadConfig } from "../src/config"

const base = { TELEGRAM_BOT_TOKEN: "123:abc", MARID_TG_ALLOW: "111, 222" }

describe("loadConfig", () => {
  test("parses a valid environment", () => {
    const cfg = loadConfig({ ...base, TELEGRAM_API_URL: "http://localhost:9", MARID_TG_CADENCE_MS: "2000" })
    expect(cfg.botToken).toBe("123:abc")
    expect([...cfg.allow].sort()).toEqual([111, 222])
    expect(cfg.botApiBaseUrl).toBe("http://localhost:9")
    expect(cfg.cadenceMs).toBe(2000)
  })

  test("fails fast without a bot token", () => {
    expect(() => loadConfig({ MARID_TG_ALLOW: "111" })).toThrow(/TELEGRAM_BOT_TOKEN/)
  })

  test("fails fast without an allowlist", () => {
    expect(() => loadConfig({ TELEGRAM_BOT_TOKEN: "t" })).toThrow(/MARID_TG_ALLOW/)
  })

  test("rejects a non-numeric user id", () => {
    expect(() => loadConfig({ ...base, MARID_TG_ALLOW: "111,abc" })).toThrow(/invalid Telegram user id/)
  })

  test("rejects an empty allowlist", () => {
    expect(() => loadConfig({ TELEGRAM_BOT_TOKEN: "t", MARID_TG_ALLOW: " , " })).toThrow(/at least one/)
  })

  test("rejects a malformed numeric tunable", () => {
    expect(() => loadConfig({ ...base, MARID_TG_CADENCE_MS: "soon" })).toThrow(/MARID_TG_CADENCE_MS/)
  })
})
