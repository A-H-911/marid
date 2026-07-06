import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createDedup } from "../src/dedup"

// FR-051: update_id dedup. Telegram redelivers an update if it was not confirmed
// (crash-before-confirm), so the gateway persists the last processed update_id,
// drops duplicates/lower ids, and resumes from it after a restart.
describe("createDedup", () => {
  let dir: string
  let file: string
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-dedup-"))
    file = path.join(dir, "dedup.json")
  })
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  test("fresh state reports last() = 0", async () => {
    expect(await createDedup(file).last()).toBe(0)
  })

  test("commit advances last(); an equal-or-lower id is then seen (dropped)", async () => {
    const d = createDedup(file)
    await d.commit(100)
    expect(await d.last()).toBe(100)
    expect(await d.seen(100)).toBe(true) // duplicate
    expect(await d.seen(99)).toBe(true) // lower (out of order / redelivered)
    expect(await d.seen(101)).toBe(false) // new
  })

  test("commit never regresses last() to a lower id", async () => {
    const d = createDedup(file)
    await d.commit(100)
    await d.commit(50)
    expect(await d.last()).toBe(100)
  })

  test("state persists across instances on the same file (restart resume)", async () => {
    await createDedup(file).commit(4242)
    expect(await createDedup(file).last()).toBe(4242)
    expect(await createDedup(file).seen(4242)).toBe(true)
  })
})
