import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createMaridAuth } from "../src/middleware"
import { createTokenStore } from "../src/token"
import { createOwnershipStore } from "../src/ownership"
import { createBindingStore } from "../src/binding"
import { createAuditLog } from "../src/audit"
import { createRateLimiter } from "../src/ratelimit"

// WBS-6.1 slice b part 1 (AC-024, ADR-0011/0012): the admin-gated attach endpoint that
// makes the mirroring binding registry OPERATOR-REACHABLE. Served entirely by the
// marid-auth wrapper (never reaches upstream); admin-scope ONLY — a channel token
// self-attaching to an arbitrary session would defeat explicit-attach (INV-001 landmine).
// The endpoint is OpenAPI-documented by merging a Marid fragment into the intercepted
// GET /doc response (EXP-014).

let dir: string
const bearer = (secret: string) => ({ authorization: `Bearer ${secret}`, "content-type": "application/json" })

async function build() {
  const tokens = createTokenStore(dir)
  const ownership = createOwnershipStore(dir)
  const bindings = createBindingStore(dir)
  const audit = createAuditLog(dir, { date: () => "2026-07-11" })
  const auth = createMaridAuth({ tokens, ownership, bindings, audit, limiter: createRateLimiter() })
  return { tokens, bindings, auth }
}

const neverNext = () => async () => {
  throw new Error("gateway route must NOT reach the upstream handler")
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-auth-gw-"))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe("gateway attach endpoint (WBS-6.1b, AC-024)", () => {
  test("admin POST /marid/attach writes the binding and never reaches upstream", async () => {
    const { auth, tokens, bindings } = await build()
    const { secret } = await tokens.create("adm", "admin")
    const res = await auth.handle(
      new Request("http://x/marid/attach", {
        method: "POST",
        headers: bearer(secret),
        body: JSON.stringify({ token: "tg", session: "ses_1" }),
      }),
      neverNext(),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ attached: true, token: "tg", session: "ses_1" })
    expect(await bindings.list("tg")).toEqual(new Set(["ses_1"]))
  })

  test("a channel token cannot attach (403, INV-001 self-attach landmine) and writes nothing", async () => {
    const { auth, tokens, bindings } = await build()
    const { secret } = await tokens.create("tg", "channel:telegram", "telegram-channel")
    const res = await auth.handle(
      new Request("http://x/marid/attach", {
        method: "POST",
        headers: bearer(secret),
        body: JSON.stringify({ token: "tg", session: "ses_secret" }),
      }),
      neverNext(),
    )
    expect(res.status).toBe(403)
    expect(await bindings.list("tg")).toEqual(new Set())
  })

  test("a plain client token cannot attach (403)", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("web", "client")
    const res = await auth.handle(
      new Request("http://x/marid/attach", { method: "POST", headers: bearer(secret), body: JSON.stringify({ token: "web", session: "ses_1" }) }),
      neverNext(),
    )
    expect(res.status).toBe(403)
  })

  test("attach is idempotent and detach removes", async () => {
    const { auth, tokens, bindings } = await build()
    const { secret } = await tokens.create("adm", "admin")
    const attach = (session: string) =>
      auth.handle(new Request("http://x/marid/attach", { method: "POST", headers: bearer(secret), body: JSON.stringify({ token: "tg", session }) }), neverNext())
    await attach("ses_1")
    await attach("ses_1") // idempotent
    await attach("ses_2")
    expect(await bindings.list("tg")).toEqual(new Set(["ses_1", "ses_2"]))
    const detach = await auth.handle(
      new Request("http://x/marid/detach", { method: "POST", headers: bearer(secret), body: JSON.stringify({ token: "tg", session: "ses_1" }) }),
      neverNext(),
    )
    expect(detach.status).toBe(200)
    expect(await bindings.list("tg")).toEqual(new Set(["ses_2"]))
  })

  test("GET /marid/bindings lists an admin token's bound sessions; non-admin is 403", async () => {
    const { auth, tokens } = await build()
    const { secret: admin } = await tokens.create("adm", "admin")
    await auth.handle(new Request("http://x/marid/attach", { method: "POST", headers: bearer(admin), body: JSON.stringify({ token: "tg", session: "ses_9" }) }), neverNext())
    const list = await auth.handle(new Request("http://x/marid/bindings?token=tg", { method: "GET", headers: bearer(admin) }), neverNext())
    expect(list.status).toBe(200)
    expect(await list.json()).toEqual({ token: "tg", sessions: ["ses_9"] })

    const { secret: chan } = await tokens.create("tg", "channel:telegram", "telegram-channel")
    const denied = await auth.handle(new Request("http://x/marid/bindings?token=tg", { method: "GET", headers: bearer(chan) }), neverNext())
    expect(denied.status).toBe(403)
  })

  test("a malformed attach body (missing session) is 400", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("adm", "admin")
    const res = await auth.handle(
      new Request("http://x/marid/attach", { method: "POST", headers: bearer(secret), body: JSON.stringify({ token: "tg" }) }),
      neverNext(),
    )
    expect(res.status).toBe(400)
  })

  test("an unauthenticated attach is 401 (auth still applies to gateway routes)", async () => {
    const { auth } = await build()
    const res = await auth.handle(
      new Request("http://x/marid/attach", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
      neverNext(),
    )
    expect(res.status).toBe(401)
  })
})

describe("GET /doc augmentation (WBS-6.1b, AC-024, EXP-014)", () => {
  const UPSTREAM_SPEC = { openapi: "3.0.1", info: { title: "opencode", version: "1.0.0" }, paths: { "/session": { get: {} } } }

  test("the merged /doc documents /marid/attach and strips accept-encoding upstream", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("web", "client")
    let seenAcceptEncoding: string | null = "unset"
    const res = await auth.handle(
      new Request("http://x/doc", { method: "GET", headers: { ...bearer(secret), "accept-encoding": "gzip" } }),
      async (req) => {
        seenAcceptEncoding = req.headers.get("accept-encoding")
        return new Response(JSON.stringify(UPSTREAM_SPEC), { status: 200, headers: { "content-type": "application/json" } })
      },
    )
    expect(res.status).toBe(200)
    // accept-encoding stripped so upstream returns plain JSON the merge can read (gzip gotcha)
    expect(seenAcceptEncoding).toBeNull()
    const spec = (await res.json()) as { paths: Record<string, { post?: unknown; get?: unknown }> }
    expect(spec.paths["/session"]).toBeDefined() // upstream paths preserved
    expect(spec.paths["/marid/attach"]?.post).toBeDefined() // Marid path merged in
    expect(spec.paths["/marid/detach"]?.post).toBeDefined()
    expect(spec.paths["/marid/bindings"]?.get).toBeDefined()
  })
})
