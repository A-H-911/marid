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

// WBS-4.4 (INV-001) by-construction backstop: a channel:<name> token is bound to a
// single restricted agent and a minimal route set. It cannot select a different
// agent, cannot widen tools/permission, and cannot reach direct-execution routes —
// enforced at the server, independent of gateway correctness.

let dir: string
const AGENT = "telegram-channel"

async function build() {
  const tokens = createTokenStore(dir)
  const ownership = createOwnershipStore(dir)
  const bindings = createBindingStore(dir)
  const audit = createAuditLog(dir, { date: () => "2026-07-04" })
  const auth = createMaridAuth({ tokens, ownership, bindings, audit, limiter: createRateLimiter() })
  return { tokens, ownership, auth }
}
const bearer = (secret: string) => ({ authorization: `Bearer ${secret}`, "content-type": "application/json" })
const okNext = (body: unknown = { ok: true }) =>
  async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })

// Create a session owned by the token, returning its id.
async function seedSession(auth: Awaited<ReturnType<typeof build>>["auth"], secret: string, id = "ses_ch") {
  await auth.handle(new Request("http://x/session", { method: "POST", headers: bearer(secret) }), okNext({ id }))
  return id
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-auth-ch-"))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe("channel token binding (WBS-4.4)", () => {
  test("a prompt with the bound agent and no widening is allowed", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("tg", "channel:telegram", AGENT)
    const id = await seedSession(auth, secret)
    const res = await auth.handle(
      new Request(`http://x/session/${id}/prompt_async`, {
        method: "POST",
        headers: bearer(secret),
        body: JSON.stringify({ agent: AGENT, parts: [{ type: "text", text: "hello" }] }),
      }),
      okNext(),
    )
    expect(res.status).toBe(200)
  })

  test("a prompt selecting a DIFFERENT agent is 403 (cannot escape the restricted agent)", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("tg", "channel:telegram", AGENT)
    const id = await seedSession(auth, secret)
    const res = await auth.handle(
      new Request(`http://x/session/${id}/prompt_async`, {
        method: "POST",
        headers: bearer(secret),
        body: JSON.stringify({ agent: "build", parts: [{ type: "text", text: "escape" }] }),
      }),
      okNext(),
    )
    expect(res.status).toBe(403)
  })

  test("a prompt with no agent is 403 (must pin the bound agent)", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("tg", "channel:telegram", AGENT)
    const id = await seedSession(auth, secret)
    const res = await auth.handle(
      new Request(`http://x/session/${id}/prompt_async`, {
        method: "POST",
        headers: bearer(secret),
        body: JSON.stringify({ parts: [{ type: "text", text: "no agent" }] }),
      }),
      okNext(),
    )
    expect(res.status).toBe(403)
  })

  test("a prompt that widens tools or permission is 403", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("tg", "channel:telegram", AGENT)
    const id = await seedSession(auth, secret)
    for (const widen of [{ tools: { bash: true } }, { permission: { bash: "allow" } }]) {
      const res = await auth.handle(
        new Request(`http://x/session/${id}/prompt_async`, {
          method: "POST",
          headers: bearer(secret),
          body: JSON.stringify({ agent: AGENT, ...widen, parts: [{ type: "text", text: "widen" }] }),
        }),
        okNext(),
      )
      expect(res.status).toBe(403)
    }
  })

  test("a channel token created WITHOUT a bound agent cannot prompt at all (fail-closed)", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("tg", "channel:telegram") // no agent bound
    const id = await seedSession(auth, secret)
    const res = await auth.handle(
      new Request(`http://x/session/${id}/prompt_async`, {
        method: "POST",
        headers: bearer(secret),
        body: JSON.stringify({ agent: AGENT, parts: [{ type: "text", text: "hi" }] }),
      }),
      okNext(),
    )
    expect(res.status).toBe(403)
  })

  test("a channel token cannot reach /shell or /command even on a session it owns (403)", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("tg", "channel:telegram", AGENT)
    const id = await seedSession(auth, secret)
    let delegated = false
    for (const sub of ["shell", "command"]) {
      const res = await auth.handle(
        new Request(`http://x/session/${id}/${sub}`, { method: "POST", headers: bearer(secret), body: "{}" }),
        async () => {
          delegated = true
          return new Response("ran")
        },
      )
      expect(res.status).toBe(403)
    }
    expect(delegated).toBe(false) // never reached the execution route
  })

  test("the bound agent may still read history and reply to a permission (the allowed set works)", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("tg", "channel:telegram", AGENT)
    const id = await seedSession(auth, secret)
    const history = await auth.handle(
      new Request(`http://x/session/${id}/message`, { method: "GET", headers: bearer(secret) }),
      okNext([]),
    )
    expect(history.status).toBe(200)
    const reply = await auth.handle(
      new Request(`http://x/session/${id}/permissions/per_1`, {
        method: "POST",
        headers: bearer(secret),
        body: JSON.stringify({ response: "reject" }),
      }),
      okNext(true),
    )
    expect(reply.status).toBe(200)
  })
})
