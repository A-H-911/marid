import { describe, expect, test } from "bun:test"
import { makeSafeLog, redact } from "../src/redact"

// INV-002. WAHA puts the API key in the WS query string, so the connection URL — the
// thing you log on every connect/reconnect/backoff — carries the secret inline.

describe("redact", () => {
  test("masks the literal key value", () => {
    expect(redact("connecting with sekret now", "sekret")).toBe("connecting with *** now")
  })

  test("masks every occurrence", () => {
    expect(redact("sekret and sekret", "sekret")).toBe("*** and ***")
  })

  // The load-bearing case: a URL can reach a log via a stack trace or a WAHA error body
  // without the key value ever passing through our code.
  test("masks the x-api-key query parameter even without knowing the value", () => {
    expect(redact("ws://waha:3000/ws?x-api-key=abc123&session=*")).toBe("ws://waha:3000/ws?x-api-key=***&session=*")
  })

  test("masks x-api-key as the first or a later parameter, any casing", () => {
    expect(redact("ws://w/ws?session=*&X-API-KEY=abc123")).toBe("ws://w/ws?session=*&X-API-KEY=***")
  })

  test("leaves other query parameters intact", () => {
    expect(redact("ws://w/ws?session=default&events=message")).toBe("ws://w/ws?session=default&events=message")
  })

  test("an undefined or empty key is a no-op (never shreds the line)", () => {
    expect(redact("plain line")).toBe("plain line")
    expect(redact("plain line", "")).toBe("plain line")
  })

  test("belt and braces: both shapes in one line", () => {
    expect(redact("GET ws://w/ws?x-api-key=sekret failed for key sekret", "sekret")).toBe(
      "GET ws://w/ws?x-api-key=*** failed for key ***",
    )
  })
})

describe("makeSafeLog", () => {
  test("wraps a sink so every line is redacted", () => {
    const lines: string[] = []
    const log = makeSafeLog((l) => lines.push(l), "sekret")
    log("using sekret")
    log("ws://w/ws?x-api-key=other")
    expect(lines).toEqual(["using ***", "ws://w/ws?x-api-key=***"])
  })
})
