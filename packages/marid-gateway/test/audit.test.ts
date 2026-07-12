import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createAuditLog } from "../src/audit"
import { resolveRequestId } from "../src/request-id"

let dir: string
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-auth-audit-"))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe("audit log", () => {
  test("appends one JSONL line per entry to audit/audit-<date>.jsonl", async () => {
    const audit = createAuditLog(dir, { date: () => "2026-07-04", now: () => 1_720_000_000_000 })
    await audit.append({ token: "cli", route: "/session", session: "ses_1", decision: "allow", requestId: "r1" })
    await audit.append({ token: "cli", route: "/event", decision: "deny", requestId: "r2" })

    const file = path.join(dir, "audit", "audit-2026-07-04.jsonl")
    const lines = (await fs.readFile(file, "utf8")).trim().split("\n")
    expect(lines).toHaveLength(2)

    const first = JSON.parse(lines[0])
    expect(first).toMatchObject({
      token: "cli",
      route: "/session",
      session: "ses_1",
      decision: "allow",
      requestId: "r1",
    })
    expect(typeof first.time).toBe("string") // ISO timestamp
    const second = JSON.parse(lines[1])
    expect(second.decision).toBe("deny")
    expect(second.session).toBeUndefined()
  })

  test("audit file is written owner-only (0600) on posix", async () => {
    if (process.platform === "win32") return
    const audit = createAuditLog(dir, { date: () => "2026-07-04" })
    await audit.append({ token: "cli", route: "/x", decision: "429", requestId: "r" })
    const stat = await fs.stat(path.join(dir, "audit", "audit-2026-07-04.jsonl"))
    expect(stat.mode & 0o777).toBe(0o600)
  })
})

describe("request id", () => {
  test("echoes a client-supplied x-request-id", () => {
    const req = new Request("http://x/", { headers: { "x-request-id": "abc-123" } })
    expect(resolveRequestId(req)).toBe("abc-123")
  })

  test("generates one when absent", () => {
    const a = resolveRequestId(new Request("http://x/"))
    const b = resolveRequestId(new Request("http://x/"))
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })

  test("ignores a blank header", () => {
    const req = new Request("http://x/", { headers: { "x-request-id": "   " } })
    expect(resolveRequestId(req).trim()).not.toBe("")
  })
})
