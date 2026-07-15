import { describe, expect, test } from "bun:test"
import { authFromToken, authTokenFromCredentials, isLoopbackUrl } from "./server"

describe("authFromToken", () => {
  test("decodes basic auth credentials from auth_token", () => {
    expect(authFromToken(btoa("kit:secret"))).toEqual({ username: "kit", password: "secret" })
  })

  test("defaults blank username to opencode", () => {
    expect(authFromToken(btoa(":secret"))).toEqual({ username: "opencode", password: "secret" })
  })

  test("ignores malformed tokens", () => {
    expect(authFromToken("not base64")).toBeUndefined()
    expect(authFromToken(btoa("missing-separator"))).toBeUndefined()
  })
})

describe("authTokenFromCredentials", () => {
  test("encodes credentials with the default username", () => {
    expect(authTokenFromCredentials({ password: "secret" })).toBe(btoa("opencode:secret"))
  })
})

describe("isLoopbackUrl", () => {
  // Guards the persisted-token fallback in createSdkForServer: the token is only injected for
  // loopback servers, so it can never leak to a remote (desktop) server the app connects to.
  test("is true for loopback hosts regardless of port or scheme", () => {
    expect(isLoopbackUrl("http://localhost:4096")).toBe(true)
    expect(isLoopbackUrl("http://127.0.0.1:4096")).toBe(true)
    expect(isLoopbackUrl("https://127.0.0.1")).toBe(true)
    expect(isLoopbackUrl("http://[::1]:4096")).toBe(true)
  })

  test("is false for remote hosts and malformed input", () => {
    expect(isLoopbackUrl("https://marid.example.com")).toBe(false)
    expect(isLoopbackUrl("http://192.168.1.10:4096")).toBe(false)
    expect(isLoopbackUrl("not a url")).toBe(false)
  })
})
