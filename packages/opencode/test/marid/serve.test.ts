import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createTokenStore } from "@marid/gateway"
import { maridServe, type MaridServer } from "../../src/marid/serve"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances } from "../fixture/fixture"

let dir: string
let server: MaridServer | undefined

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-serve-"))
})
afterEach(async () => {
  server?.stop()
  server = undefined
  await disposeAllInstances()
  await resetDatabase()
  await fs.rm(dir, { recursive: true, force: true })
})

function start() {
  server = maridServe({ hostname: "127.0.0.1", port: 0, dir })
  return server
}

describe("marid serve (authenticated wrapper over Server.Default)", () => {
  test("refuses an unauthenticated request with 401", async () => {
    const s = start()
    const res = await fetch(new URL("/global/health", s.url))
    expect(res.status).toBe(401)
    expect(res.headers.get("x-request-id")).toBeTruthy()
  })

  test("delegates an admin-token request to the v1 handler and echoes request id", async () => {
    const { secret } = await createTokenStore(dir).create("root", "admin")
    const s = start()
    const res = await fetch(new URL("/global/health", s.url), {
      headers: { authorization: `Bearer ${secret}`, "x-request-id": "smoke-1" },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("x-request-id")).toBe("smoke-1")
    const body = (await res.json()) as { status?: unknown }
    expect(body).toBeTruthy()
  })

  test("rejects a bad token with 401", async () => {
    const s = start()
    const res = await fetch(new URL("/global/health", s.url), {
      headers: { authorization: "Bearer mar_not-real" },
    })
    expect(res.status).toBe(401)
  })

  test("marid Bearer is honored even when OPENCODE_SERVER_PASSWORD is set (no upstream double-auth)", async () => {
    const previous = process.env.OPENCODE_SERVER_PASSWORD
    process.env.OPENCODE_SERVER_PASSWORD = "should-be-ignored-by-marid"
    try {
      const { secret } = await createTokenStore(dir).create("root", "admin")
      const s = start() // createMaridHandler clears the upstream password
      const res = await fetch(new URL("/global/health", s.url), {
        headers: { authorization: `Bearer ${secret}` },
      })
      expect(res.status).toBe(200) // delegated, not rejected by upstream Basic auth
    } finally {
      if (previous === undefined) delete process.env.OPENCODE_SERVER_PASSWORD
      else process.env.OPENCODE_SERVER_PASSWORD = previous
    }
  })
})
