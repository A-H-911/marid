import { describe, expect, test } from "bun:test"
import { routeSlash } from "../src/slash"

const whitelist = new Set(["new", "help"])

describe("routeSlash (defect 3 — deny-by-default slash routing)", () => {
  test("a whitelisted command routes to its handler with args", () => {
    expect(routeSlash("/new", whitelist)).toEqual({ kind: "command", name: "new", args: "" })
    expect(routeSlash("/help me please", whitelist)).toEqual({ kind: "command", name: "help", args: "me please" })
  })

  test("command names are case-insensitive", () => {
    expect(routeSlash("/NEW", whitelist)).toEqual({ kind: "command", name: "new", args: "" })
  })

  test("a non-whitelisted /command is rejected, never prompted as text", () => {
    expect(routeSlash("/shell rm -rf /", whitelist)).toEqual({ kind: "rejected", name: "shell" })
    expect(routeSlash("/deploy", whitelist)).toEqual({ kind: "rejected", name: "deploy" })
  })

  test("a bare slash is rejected, not treated as a command", () => {
    expect(routeSlash("/", whitelist)).toEqual({ kind: "rejected", name: "" })
  })

  test("plain text is prompted normally", () => {
    expect(routeSlash("what is 2+2", whitelist)).toEqual({ kind: "prompt", text: "what is 2+2" })
  })
})
