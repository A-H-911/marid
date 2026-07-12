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

let dir: string
async function build() {
  const tokens = createTokenStore(dir)
  const ownership = createOwnershipStore(dir)
  const bindings = createBindingStore(dir)
  const audit = createAuditLog(dir, { date: () => "2026-07-04" })
  const auth = createMaridAuth({ tokens, ownership, bindings, audit, limiter: createRateLimiter() })
  return { tokens, ownership, bindings, audit, auth }
}
const bearer = (secret: string) => ({ authorization: `Bearer ${secret}` })
// The upstream web UI (utils/server.ts) can only send Basic auth with the token as the password.
const basic = (secret: string, user = "opencode") => ({
  authorization: `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}`,
})
const okNext = (body: unknown = { ok: true }) =>
  async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-auth-mw-"))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe("marid-auth middleware", () => {
  test("401 when no token is presented (server refuses unauthenticated even on localhost)", async () => {
    const { auth } = await build()
    let delegated = false
    const res = await auth.handle(new Request("http://x/session"), async () => {
      delegated = true
      return new Response("ok")
    })
    expect(res.status).toBe(401)
    expect(delegated).toBe(false) // never reached upstream
    const body = (await res.json()) as { name: string; message: string; requestId: string }
    expect(typeof body.name).toBe("string")
    expect(typeof body.message).toBe("string")
    expect(typeof body.requestId).toBe("string")
    expect(res.headers.get("x-request-id")).toBe(body.requestId) // header echoes the body's request id
  })

  test("401 on an unknown token", async () => {
    const { auth } = await build()
    const res = await auth.handle(new Request("http://x/session", { headers: bearer("mar_bogus") }), okNext())
    expect(res.status).toBe(401)
  })

  test("CORS preflight (OPTIONS) passes through un-authed so the browser can send the real request", async () => {
    const { auth } = await build()
    let delegated = false
    const res = await auth.handle(new Request("http://x/global/config", { method: "OPTIONS" }), async () => {
      delegated = true
      return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } })
    })
    expect(delegated).toBe(true) // preflight reached the upstream CORS handler, not a 401
    expect(res.status).toBe(204)
  })

  test("error responses echo CORS headers (a cross-origin browser reads the 401, not an opaque CORS failure)", async () => {
    const { auth } = await build()
    const res = await auth.handle(
      new Request("http://x/global/config", { headers: { origin: "http://localhost:3001" } }),
      okNext(),
    )
    expect(res.status).toBe(401)
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3001")
  })

  test("accepts the token via Basic auth (password is the token) — the web UI can only send Basic", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("web", "client")
    const res = await auth.handle(new Request("http://x/config", { headers: basic(secret) }), okNext())
    expect(res.status).toBe(200)
  })

  test("401 on a wrong token presented via Basic (no auth bypass)", async () => {
    const { auth } = await build()
    const res = await auth.handle(new Request("http://x/config", { headers: basic("mar_bogus") }), okNext())
    expect(res.status).toBe(401)
  })

  test("admin token is delegated and gets its request id echoed", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("root", "admin")
    const res = await auth.handle(
      new Request("http://x/config", { headers: { ...bearer(secret), "x-request-id": "req-42" } }),
      okNext(),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("x-request-id")).toBe("req-42")
  })

  test("client is denied a session it does not own (403)", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("c", "client")
    const res = await auth.handle(
      new Request("http://x/session/ses_other/message", { method: "GET", headers: bearer(secret) }),
      okNext(),
    )
    expect(res.status).toBe(403)
  })

  test("client create records ownership, then it may act on that session", async () => {
    const { auth, tokens, ownership } = await build()
    const { secret } = await tokens.create("c", "client")
    const created = await auth.handle(
      new Request("http://x/session", { method: "POST", headers: bearer(secret) }),
      okNext({ id: "ses_new" }),
    )
    expect(created.status).toBe(200)
    expect(await ownership.owns("c", "ses_new")).toBe(true)

    const followup = await auth.handle(
      new Request("http://x/session/ses_new/message", { method: "POST", headers: bearer(secret) }),
      okNext(),
    )
    expect(followup.status).toBe(200)
  })

  test("429 with retry-after when the request bucket is drained", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("c", "admin")
    let last: Response | undefined
    for (let i = 0; i < 40; i++) {
      last = await auth.handle(new Request("http://x/config", { headers: bearer(secret) }), okNext())
      if (last.status === 429) break
    }
    expect(last!.status).toBe(429)
    expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0)
  })

  test("SSE requests are exempt from the bucket but capped per token", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("c", "admin")
    // drain the request bucket
    for (let i = 0; i < 40; i++) await auth.handle(new Request("http://x/config", { headers: bearer(secret) }), okNext())

    const openStream = () =>
      auth.handle(
        new Request("http://x/event", { headers: { ...bearer(secret), accept: "text/event-stream" } }),
        async () => new Response(new ReadableStream({ start() {} }), { headers: { "content-type": "text/event-stream" } }),
      )

    const held: Response[] = []
    for (let i = 0; i < 4; i++) held.push(await openStream()) // exempt: still 200 despite empty bucket
    expect(held.every((r) => r.status === 200)).toBe(true)
    const over = await openStream()
    expect(over.status).toBe(429) // 5th exceeds the SSE cap
  })

  test("client forking an owned session records the new child session", async () => {
    const { auth, tokens, ownership } = await build()
    const { secret } = await tokens.create("c", "client")
    await auth.handle(new Request("http://x/session", { method: "POST", headers: bearer(secret) }), okNext({ id: "ses_parent" }))

    const forked = await auth.handle(
      new Request("http://x/session/ses_parent/fork", { method: "POST", headers: bearer(secret) }),
      okNext({ id: "ses_child" }),
    )
    expect(forked.status).toBe(200)
    expect(await ownership.owns("c", "ses_child")).toBe(true)

    // the client can now act on the forked child session
    const onChild = await auth.handle(
      new Request("http://x/session/ses_child/message", { method: "POST", headers: bearer(secret) }),
      okNext(),
    )
    expect(onChild.status).toBe(200)
  })

  test("client GET /session list is filtered to the sessions it owns", async () => {
    const { auth, tokens, ownership } = await build()
    const { secret } = await tokens.create("c", "client")
    await ownership.record("c", "ses_mine")
    const res = await auth.handle(
      new Request("http://x/session", { method: "GET", headers: bearer(secret) }),
      okNext([{ id: "ses_mine", title: "a" }, { id: "ses_other", title: "b" }]),
    )
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{ id: string }>
    expect(list.map((s) => s.id)).toEqual(["ses_mine"])
  })

  test("client GET /permission list is filtered by the permission's sessionID", async () => {
    const { auth, tokens, ownership } = await build()
    const { secret } = await tokens.create("c", "client")
    await ownership.record("c", "ses_mine")
    const res = await auth.handle(
      new Request("http://x/permission", { method: "GET", headers: bearer(secret) }),
      okNext([
        { id: "per_1", sessionID: "ses_mine" },
        { id: "per_2", sessionID: "ses_other" },
      ]),
    )
    expect(res.status).toBe(200)
    const list = (await res.json()) as Array<{ id: string }>
    expect(list.map((p) => p.id)).toEqual(["per_1"])
  })

  test("strips accept-encoding before delegating a filtered list route (so upstream returns uncompressed JSON)", async () => {
    const { auth, tokens, ownership } = await build()
    const { secret } = await tokens.create("c", "client")
    await ownership.record("c", "ses_mine")
    let seen: string | null = "unset"
    await auth.handle(
      new Request("http://x/session", { method: "GET", headers: { ...bearer(secret), "accept-encoding": "gzip, deflate" } }),
      async (req) => {
        seen = req.headers.get("accept-encoding")
        return new Response(JSON.stringify([{ id: "ses_mine" }]), { status: 200, headers: { "content-type": "application/json" } })
      },
    )
    expect(seen).toBeNull() // upstream never sees accept-encoding, so it cannot gzip the body the filter must parse
  })

  test("admin keeps accept-encoding (compression is only sacrificed on filtered non-admin routes)", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("root", "admin")
    let seen: string | null = "unset"
    await auth.handle(
      new Request("http://x/session", { method: "GET", headers: { ...bearer(secret), "accept-encoding": "gzip" } }),
      async (req) => {
        seen = req.headers.get("accept-encoding")
        return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
      },
    )
    expect(seen).toBe("gzip")
  })

  test("admin GET /session list is never filtered", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("root", "admin")
    const res = await auth.handle(
      new Request("http://x/session", { method: "GET", headers: bearer(secret) }),
      okNext([{ id: "ses_a" }, { id: "ses_b" }]),
    )
    const list = (await res.json()) as Array<{ id: string }>
    expect(list.map((s) => s.id)).toEqual(["ses_a", "ses_b"])
  })

  test("client /event stream drops other sessions' frames but keeps its own + infrastructure", async () => {
    const { auth, tokens, ownership } = await build()
    const { secret } = await tokens.create("c", "client")
    await ownership.record("c", "ses_mine")
    const evt = (type: string, properties: Record<string, unknown>) =>
      `event: message\ndata: ${JSON.stringify({ id: "e", type, properties })}\n\n`
    const frames =
      evt("server.connected", {}) +
      evt("message.part.updated", { sessionID: "ses_mine" }) +
      evt("message.part.updated", { sessionID: "ses_other" })
    const res = await auth.handle(
      new Request("http://x/event", { headers: { ...bearer(secret), accept: "text/event-stream" } }),
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(frames))
              controller.close()
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        ),
    )
    const out = await res.text()
    expect(out).toContain("server.connected")
    expect(out).toContain("ses_mine")
    expect(out).not.toContain("ses_other")
  })

  test("audit lines carry the session id for session-scoped routes", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("root", "admin")
    await auth.handle(new Request("http://x/session/ses_42/message", { headers: bearer(secret) }), okNext())

    const file = path.join(dir, "audit", "audit-2026-07-04.jsonl")
    const lines = (await fs.readFile(file, "utf8")).trim().split("\n").map((l) => JSON.parse(l) as { session?: string; route: string })
    expect(lines.some((l) => l.session === "ses_42" && l.route === "/session/ses_42/message")).toBe(true)
  })

  test("writes an audit line for allow and deny decisions", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("root", "admin")
    await auth.handle(new Request("http://x/config", { headers: bearer(secret) }), okNext())
    await auth.handle(new Request("http://x/session"), async () => new Response("no")) // 401, no token

    const file = path.join(dir, "audit", "audit-2026-07-04.jsonl")
    const lines = (await fs.readFile(file, "utf8"))
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { decision: string; token: string; requestId: unknown })
    expect(lines.some((l) => l.decision === "allow" && l.token === "root")).toBe(true)
    expect(lines.some((l) => l.decision === "deny")).toBe(true)
    expect(lines.every((l) => typeof l.requestId === "string")).toBe(true)
  })
})
