import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createOwnershipStore } from "../src/ownership"

let dir: string
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-auth-own-"))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe("ownership store (durable sidecar)", () => {
  test("records and reports ownership per token", async () => {
    const store = createOwnershipStore(dir)
    await store.record("cli", "ses_1")
    await store.record("cli", "ses_2")
    expect(await store.owns("cli", "ses_1")).toBe(true)
    expect(await store.owns("cli", "ses_2")).toBe(true)
    expect(await store.owns("cli", "ses_3")).toBe(false)
    expect(await store.owns("other", "ses_1")).toBe(false)
  })

  test("ownership survives across a fresh store instance (restart durability)", async () => {
    await createOwnershipStore(dir).record("cli", "ses_persist")
    // simulate a `marid serve` restart: brand-new store over the same dir
    const reopened = createOwnershipStore(dir)
    expect(await reopened.owns("cli", "ses_persist")).toBe(true)
  })

  test("recording the same session twice is idempotent", async () => {
    const store = createOwnershipStore(dir)
    await store.record("cli", "ses_1")
    await store.record("cli", "ses_1")
    const set = await store.list("cli")
    expect([...set]).toEqual(["ses_1"])
  })

  test("ownership.json is written owner-only (0600) on posix", async () => {
    if (process.platform === "win32") return
    await createOwnershipStore(dir).record("cli", "ses_1")
    const stat = await fs.stat(path.join(dir, "ownership.json"))
    expect(stat.mode & 0o777).toBe(0o600)
  })
})
