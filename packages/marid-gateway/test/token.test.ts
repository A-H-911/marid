import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createTokenStore, generateSecret, isValidScope } from "../src/token"

let dir: string
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-auth-token-"))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe("token store", () => {
  test("create returns a mar_-prefixed secret once and stores only the hash", async () => {
    const store = createTokenStore(dir)
    const { secret, info } = await store.create("cli", "admin")
    expect(secret.startsWith("mar_")).toBe(true)
    expect(info).toEqual({ name: "cli", scope: "admin", created: expect.any(Number) })

    const raw = await fs.readFile(path.join(dir, "tokens.json"), "utf8")
    expect(raw).not.toContain(secret) // secret is never persisted
    expect(raw).not.toContain(secret.slice(4))
  })

  test("verify matches a valid secret and returns its record", async () => {
    const store = createTokenStore(dir)
    const { secret } = await store.create("cli", "client")
    const record = await store.verify(secret)
    expect(record).toMatchObject({ name: "cli", scope: "client" })
  })

  test("verify rejects an unknown/garbage secret", async () => {
    const store = createTokenStore(dir)
    await store.create("cli", "admin")
    expect(await store.verify("mar_not-a-real-token")).toBeUndefined()
    expect(await store.verify("")).toBeUndefined()
  })

  test("list omits hashes; revoke removes the token", async () => {
    const store = createTokenStore(dir)
    const { secret } = await store.create("a", "admin")
    await store.create("b", "client")
    const list = await store.list()
    expect(list.map((t) => t.name).sort()).toEqual(["a", "b"])
    expect(list.every((t) => !("hash" in t))).toBe(true)

    expect(await store.revoke("a")).toBe(true)
    expect(await store.verify(secret)).toBeUndefined()
    expect(await store.revoke("missing")).toBe(false)
  })

  test("create rejects a duplicate name", async () => {
    const store = createTokenStore(dir)
    await store.create("dup", "admin")
    await expect(store.create("dup", "client")).rejects.toThrow(/exists/i)
  })

  test("tokens.json is written with owner-only permissions (0600) on posix", async () => {
    if (process.platform === "win32") return
    const store = createTokenStore(dir)
    await store.create("cli", "admin")
    const stat = await fs.stat(path.join(dir, "tokens.json"))
    expect(stat.mode & 0o777).toBe(0o600)
  })

  test("scope validation", () => {
    expect(isValidScope("admin")).toBe(true)
    expect(isValidScope("client")).toBe(true)
    expect(isValidScope("channel:telegram")).toBe(true)
    expect(isValidScope("channel:")).toBe(false)
    expect(isValidScope("root")).toBe(false)
  })

  test("generateSecret is unpredictable and prefixed", () => {
    const a = generateSecret()
    const b = generateSecret()
    expect(a).not.toBe(b)
    expect(a.startsWith("mar_")).toBe(true)
    expect(a.length).toBeGreaterThan(20)
  })
})
