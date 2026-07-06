import { describe, expect, test } from "bun:test"
import { redact } from "../src/redact"

// INV-002 / RISK-007: the bot token must never reach a log line or a channel
// message. It appears raw in every Bot API URL and, critically, inside
// file-download URLs (https://api.telegram.org/file/bot<token>/<path>). redact()
// masks the token literal wherever it occurs.
const TOKEN = "123456789:AAExampleTokenValue_abcDEF-0987654321gh"

describe("redact", () => {
  test("masks the token literal wherever it appears", () => {
    expect(redact(`the token is ${TOKEN} ok`, TOKEN)).toBe("the token is <redacted> ok")
  })

  test("masks the token inside a Bot API method URL", () => {
    const url = `https://api.telegram.org/bot${TOKEN}/getUpdates`
    expect(redact(url, TOKEN)).toBe("https://api.telegram.org/bot<redacted>/getUpdates")
  })

  test("masks the token inside a file-download URL (the embedded-secret case)", () => {
    const url = `https://api.telegram.org/file/bot${TOKEN}/photos/file_42.jpg`
    expect(redact(url, TOKEN)).toBe("https://api.telegram.org/file/bot<redacted>/photos/file_42.jpg")
  })

  test("masks every occurrence, not just the first", () => {
    expect(redact(`${TOKEN} and again ${TOKEN}`, TOKEN)).toBe("<redacted> and again <redacted>")
  })

  test("leaves text without the token unchanged", () => {
    expect(redact("nothing secret here", TOKEN)).toBe("nothing secret here")
  })

  test("empty token is a no-op (never splits every character)", () => {
    expect(redact("a:b:c", "")).toBe("a:b:c")
  })
})
