import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { add, list, pathOf, remove, validateName } from "../src/registry"
import { instanceDir, instanceRecordFile } from "../src/paths"

let home: string
let prevHome: string | undefined
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "marid-reg-"))
  prevHome = process.env.MARID_HOME
  process.env.MARID_HOME = home
})
afterEach(async () => {
  if (prevHome === undefined) delete process.env.MARID_HOME
  else process.env.MARID_HOME = prevHome
  await fs.rm(home, { recursive: true, force: true })
})

describe("registry: add / list / remove over the instances directory", () => {
  test("add creates the instance tree and rejects a duplicate", async () => {
    const dir = await add("work")
    expect(dir).toBe(instanceDir("work"))
    expect((await fs.stat(dir)).isDirectory()).toBe(true)
    await expect(add("work")).rejects.toThrow(/already exists/)
  })

  test("list reports every instance directory, running=false when never started", async () => {
    await add("alpha")
    await add("beta")
    const items = await list()
    expect(items.map((i) => i.name).sort()).toEqual(["alpha", "beta"])
    expect(items.every((i) => i.running === false)).toBe(true)
  })

  test("list is empty (not an error) when the root does not exist yet", async () => {
    expect(await list()).toEqual([])
  })

  test("remove deletes a stopped instance; a stale record does not block removal", async () => {
    const dir = await add("gone")
    // a leftover record pointing at a dead pid must not wedge removal
    await fs.writeFile(
      instanceRecordFile(dir),
      JSON.stringify({ name: "gone", port: 1, pid: 0x3fffffff, startedAt: 1, logFile: "x" }),
    )
    expect(await remove("gone")).toBe(true)
    expect(await fs.stat(dir).catch(() => null)).toBeNull()
    expect(await remove("gone")).toBe(false) // already gone
  })
})

describe("validateName: the trust boundary between a name and a filesystem path", () => {
  test.each(["ok", "a", "work-2", "a1b2"])("accepts %s", (name) => {
    expect(() => validateName(name)).not.toThrow()
  })

  // Path traversal, absolute paths, separators, dotfiles, spaces, uppercase.
  test.each(["..", "../etc", "a/b", "a\\b", ".hidden", "", "UPPER", "has space", "/abs"])(
    "rejects %p",
    (name) => {
      expect(() => validateName(name)).toThrow(/invalid instance name/)
      expect(() => pathOf(name)).toThrow(/invalid instance name/)
    },
  )

  test("pathOf on a bad name never escapes the instances root", () => {
    // Belt-and-suspenders: even the resolver refuses traversal before returning a path.
    expect(() => pathOf("../../etc/passwd")).toThrow()
  })
})
