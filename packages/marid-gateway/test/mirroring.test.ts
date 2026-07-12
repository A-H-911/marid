import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createMaridAuth, type MaridAuth, type MaridAuthDeps } from "../src/middleware"
import { createTokenStore } from "../src/token"
import { createOwnershipStore } from "../src/ownership"
import { createBindingStore, type BindingStore } from "../src/binding"
import { createAuditLog } from "../src/audit"
import { createRateLimiter } from "../src/ratelimit"

// WBS-6.3 / AC-019 / TEST-SYNC — full bidirectional cross-client mirroring, driven
// against the REAL middleware + real BindingStore + real filterSseStream (the
// production successor to the EXP-008 spike). Proves: view-via-binding mirrors an
// attached session both ways; an unattached session stays invisible (explicit-attach
// scope); acting stays gated on ownership (INV-001); a plain client is a no-op
// (blast radius); a registry fault degrades to non-mirrored (RISK-024).

let dir: string
async function build(overrides?: Partial<MaridAuthDeps>) {
  const tokens = createTokenStore(dir)
  const ownership = createOwnershipStore(dir)
  const bindings = createBindingStore(dir)
  const audit = createAuditLog(dir, { date: () => "2026-07-10" })
  const auth = createMaridAuth({ tokens, ownership, bindings, audit, limiter: createRateLimiter(), ...overrides })
  return { tokens, ownership, bindings, audit, auth }
}

const bearer = (secret: string) => ({ authorization: `Bearer ${secret}`, accept: "text/event-stream" })

const frame = (type: string, properties: Record<string, unknown>) =>
  `event: message\ndata: ${JSON.stringify({ id: "e", type, properties })}\n\n`

// An upstream /event handler: streams the given raw SSE frames then closes. This is
// the instance firehose — it carries EVERY session's frames to every subscriber; the
// middleware is what narrows them per-token.
const eventNext = (frames: string[]) => async () => {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(f))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } })
}

async function readBody(res: Response): Promise<string> {
  return res.body ? await new Response(res.body).text() : ""
}

// Subscribe to /event as `secret` and return the frames the token actually receives.
async function subscribe(auth: MaridAuth, secret: string, frames: string[]) {
  const res = await auth.handle(new Request("http://x/event", { headers: bearer(secret) }), eventNext(frames))
  return readBody(res)
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-auth-mirror-"))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe("WBS-6.3 · view-via-binding — an attached session mirrors, an unattached one does not", () => {
  test("an ATTACHED channel receives the web session's frames (mirroring works, both ways)", async () => {
    const { auth, tokens, ownership, bindings } = await build()
    const { secret } = await tokens.create("tg", "channel:tg")
    await ownership.record("tg", "ses_tg") // the channel owns its own session
    await bindings.attach("tg", "ses_web") // operator attaches it to the web session
    const out = await subscribe(auth, secret, [
      frame("server.connected", {}),
      frame("message.part.updated", { sessionID: "ses_web" }), // a web/TUI-driven turn
      frame("message.part.updated", { sessionID: "ses_tg" }), // its own turn
    ])
    expect(out).toContain("server.connected") // infra always passes
    expect(out).toContain("ses_web") // web turn mirrored INTO the channel
    expect(out).toContain("ses_tg") // own turn still visible
  })

  test("an UNATTACHED channel does NOT receive the web session (explicit-attach scope)", async () => {
    const { auth, tokens, ownership } = await build()
    const { secret } = await tokens.create("tg", "channel:tg")
    await ownership.record("tg", "ses_tg")
    // no attach: a fresh web session must not auto-appear
    const out = await subscribe(auth, secret, [
      frame("message.part.updated", { sessionID: "ses_web" }),
      frame("message.part.updated", { sessionID: "ses_tg" }),
    ])
    expect(out).not.toContain("ses_web")
    expect(out).toContain("ses_tg") // still sees its own
  })

  test("a permission.asked on a bound session mirrors to the attached surface (WBS-6.4 view)", async () => {
    // The cross-surface permission story: the ask EVENT is visible on every bound
    // surface (view-via-binding, same predicate as any session frame); only the OWNER
    // may reply (act-via-ownership, asserted below). Here the channel, attached to
    // ses_web, receives the permission.asked frame so its inline keyboard can render.
    const { auth, tokens, ownership, bindings } = await build()
    const { secret } = await tokens.create("tg", "channel:tg")
    await ownership.record("tg", "ses_tg")
    await bindings.attach("tg", "ses_web")
    const out = await subscribe(auth, secret, [
      frame("permission.asked", { id: "per_x", sessionID: "ses_web", permission: "bash" }),
    ])
    expect(out).toContain("per_x") // the ask reaches the bound surface
    expect(out).toContain("ses_web")
  })

  test("bidirectional: a web dashboard token attached to the channel session sees channel turns", async () => {
    const { auth, tokens, bindings } = await build()
    const { secret } = await tokens.create("dash", "client")
    await bindings.attach("dash", "ses_tg") // dashboard attaches to the Telegram session
    const out = await subscribe(auth, secret, [frame("session.next.text.delta", { sessionID: "ses_tg", delta: "hi" })])
    expect(out).toContain("ses_tg") // channel turn mirrored OUT to the other surface
  })
})

describe("WBS-6.3 · act-via-ownership — mirroring opens VIEW, never ACT (INV-001)", () => {
  test("a bound-but-not-owner channel is DENIED replying to a permission on the bound session", async () => {
    const { auth, tokens, ownership, bindings } = await build()
    const { secret } = await tokens.create("tg", "channel:tg")
    await ownership.record("tg", "ses_tg")
    await bindings.attach("tg", "ses_web") // can VIEW ses_web...
    const res = await auth.handle(
      // ...but acting on it is gated by ownership, not the binding
      new Request("http://x/session/ses_web/permissions/per_x", { method: "POST", headers: { authorization: `Bearer ${secret}` } }),
      async () => new Response("{}", { status: 200 }),
    )
    expect(res.status).toBe(403) // view-via-binding, act-via-ownership
  })

  test("the channel CAN still act on the session it actually owns", async () => {
    const { auth, tokens, ownership } = await build()
    const { secret } = await tokens.create("tg", "channel:tg")
    await ownership.record("tg", "ses_tg")
    const res = await auth.handle(
      new Request("http://x/session/ses_tg/permissions/per_x", { method: "POST", headers: { authorization: `Bearer ${secret}` } }),
      async () => new Response("{}", { status: 200 }),
    )
    expect(res.status).toBe(200)
  })
})

describe("WBS-6.3 · blast radius — no-op for plain clients, degrades safely (RISK-024/AC-024)", () => {
  test("with nothing attached, /event is byte-identical to today's owns-only filter", async () => {
    const { auth, tokens, ownership } = await build()
    const { secret } = await tokens.create("web", "client")
    await ownership.record("web", "ses_web")
    const out = await subscribe(auth, secret, [
      frame("message.part.updated", { sessionID: "ses_web" }), // owned
      frame("message.part.updated", { sessionID: "ses_other" }), // not owned
    ])
    expect(out).toContain("ses_web")
    expect(out).not.toContain("ses_other") // plain-client isolation unchanged
  })

  test("a THROWING binding registry degrades to owns-only, never crashes the stream", async () => {
    const faulty: BindingStore = {
      attach: async () => {},
      detach: async () => {},
      list: async () => {
        throw new Error("registry fault injected")
      },
    }
    const { auth, tokens, ownership } = await build({ bindings: faulty })
    const { secret } = await tokens.create("tg", "channel:tg")
    await ownership.record("tg", "ses_tg")
    const out = await subscribe(auth, secret, [
      frame("message.part.updated", { sessionID: "ses_tg" }), // owned — still delivered
      frame("message.part.updated", { sessionID: "ses_web" }), // mirror unavailable — silently dropped
    ])
    expect(out).toContain("ses_tg") // auth/stream path unbroken under the fault
    expect(out).not.toContain("ses_web")
  })
})
