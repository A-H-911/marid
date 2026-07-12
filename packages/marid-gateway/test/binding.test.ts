import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createBindingStore } from "../src/binding"

let dir: string
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-auth-bind-"))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe("binding store (durable session<->surface registry)", () => {
  test("attaches and lists bound sessions per token", async () => {
    const store = createBindingStore(dir)
    await store.attach("channel:tg", "ses_web")
    await store.attach("channel:tg", "ses_other")
    expect([...(await store.list("channel:tg"))].sort()).toEqual(["ses_other", "ses_web"])
    expect(await store.list("dash")).toEqual(new Set()) // an unrelated token is bound to nothing
  })

  test("bindings survive across a fresh store instance (restart durability)", async () => {
    await createBindingStore(dir).attach("channel:tg", "ses_web")
    // simulate a `marid serve` restart: brand-new store over the same dir
    const reopened = createBindingStore(dir)
    expect(await reopened.list("channel:tg")).toEqual(new Set(["ses_web"]))
  })

  test("attaching the same session twice is idempotent", async () => {
    const store = createBindingStore(dir)
    await store.attach("channel:tg", "ses_web")
    await store.attach("channel:tg", "ses_web")
    expect([...(await store.list("channel:tg"))]).toEqual(["ses_web"])
  })

  test("detach removes a binding; mirroring is mutable (ADR-0012 rebinding)", async () => {
    const store = createBindingStore(dir)
    await store.attach("channel:tg", "ses_web")
    await store.attach("channel:tg", "ses_two")
    await store.detach("channel:tg", "ses_web")
    expect([...(await store.list("channel:tg"))]).toEqual(["ses_two"])
  })

  test("detaching an unbound session is a no-op", async () => {
    const store = createBindingStore(dir)
    await store.attach("channel:tg", "ses_web")
    await store.detach("channel:tg", "ses_absent")
    expect([...(await store.list("channel:tg"))]).toEqual(["ses_web"])
  })

  test("binding.json is written owner-only (0600) on posix", async () => {
    if (process.platform === "win32") return
    await createBindingStore(dir).attach("channel:tg", "ses_web")
    const stat = await fs.stat(path.join(dir, "binding.json"))
    expect(stat.mode & 0o777).toBe(0o600)
  })
})
