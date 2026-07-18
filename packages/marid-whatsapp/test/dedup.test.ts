import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createDedup, dedupKey } from "../src/dedup"

// FR-051 replay protection. WAHA has no update_id offset, so this is a SET, not a
// watermark — the tests pin that difference deliberately.

let dir: string
let stateFile: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-wa-dedup-"))
  stateFile = path.join(dir, "nested", "seen.json")
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

const ID_A = "false_11111111111@c.us_AAAAAAAAAAAA"
const ID_B = "false_11111111111@c.us_BBBBBBBBBBBB"

describe("createDedup", () => {
  test("an unseen id is not seen; a committed id is", async () => {
    const d = createDedup(stateFile)
    expect(await d.seen(ID_A)).toBe(false)
    await d.commit(ID_A)
    expect(await d.seen(ID_A)).toBe(true)
    expect(await d.seen(ID_B)).toBe(false)
  })

  test("commit is idempotent", async () => {
    const d = createDedup(stateFile)
    await d.commit(ID_A)
    await d.commit(ID_A)
    expect(await d.size()).toBe(1)
  })

  test("survives a restart (durable across instances)", async () => {
    const first = createDedup(stateFile)
    await first.commit(ID_A)

    const second = createDedup(stateFile)
    expect(await second.seen(ID_A)).toBe(true)
  })

  test("creates the parent directory and the file at 0600", async () => {
    const d = createDedup(stateFile)
    await d.commit(ID_A)
    const stat = await fs.stat(stateFile)
    // Windows does not implement POSIX modes — assert only where it is meaningful.
    if (process.platform !== "win32") expect(stat.mode & 0o777).toBe(0o600)
  })

  test("a missing or corrupt state file degrades to empty, not a crash", async () => {
    await fs.mkdir(path.dirname(stateFile), { recursive: true })
    await fs.writeFile(stateFile, "{not json")
    const d = createDedup(stateFile)
    // JSON.parse throws inside read(); the store must not take the gateway down on a
    // torn write. If this ever throws, the process dies on boot after a bad shutdown.
    expect(await d.seen(ID_A).catch(() => "threw")).toBe(false)
  })

  test("ids are unordered — a 'lower' id is NOT implied seen (no watermark)", async () => {
    const d = createDedup(stateFile)
    await d.commit(ID_B)
    // Telegram's `id <= last` logic would wrongly call ID_A seen here. WAHA ids carry
    // no ordering, so only an exact hit counts.
    expect(await d.seen(ID_A)).toBe(false)
  })

  test("evicts FIFO past the cap and stays bounded", async () => {
    const d = createDedup(stateFile)
    for (let i = 0; i < 520; i++) await d.commit(`id_${i}`)
    expect(await d.size()).toBe(500)
    expect(await d.seen("id_0")).toBe(false) // evicted
    expect(await d.seen("id_519")).toBe(true) // newest retained
  })
})

describe("dedupKey", () => {
  test("scopes an id to its normalized chat", () => {
    expect(dedupKey("  11111111111@C.US ", ID_A)).toBe(`11111111111@c.us#${ID_A}`)
  })
})
