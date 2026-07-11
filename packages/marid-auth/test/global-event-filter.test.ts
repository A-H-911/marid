import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { owningSessionGlobal } from "../src/event-filter"
import { createMaridAuth, type MaridAuth } from "../src/middleware"
import { createTokenStore } from "../src/token"
import { createOwnershipStore } from "../src/ownership"
import { createBindingStore } from "../src/binding"
import { createAuditLog } from "../src/audit"
import { createRateLimiter } from "../src/ratelimit"

// PART 2 (WBS-6.1 slice b) / TEST-SEC — fine-filter the ROUTING-WRAPPED /global/event
// firehose with the same binding-aware isVisible = owns∪bound as /event. web, TUI, AND
// the channel all ride /global/event, so this closes the pre-existing INV-001 gap
// (/global/event was UNFILTERED for every non-admin token) AND delivers mirroring.
//
// The subtlety this suite pins: /global/event carries the durable "sync" TWIN of every
// session event (event-v2-bridge.ts emits both a regular frame AND a sync frame with the
// SAME data). The regular twin owns via payload.properties.sessionID; the sync twin owns
// via payload.syncEvent.aggregateID (durable aggregate = "sessionID" → ses-prefixed).
// Filtering only the regular twin would leak the durable copy of another session's data.

describe("owningSessionGlobal: wrapped /global/event frame ownership (regular + sync twin)", () => {
  test("regular twin owns via payload.properties.sessionID", () => {
    expect(
      owningSessionGlobal({ directory: "d", payload: { id: "e", type: "session.next.text.delta", properties: { sessionID: "ses_a" } } }),
    ).toBe("ses_a")
  })
  test("sync twin owns via payload.syncEvent.aggregateID (durable aggregate = sessionID)", () => {
    expect(
      owningSessionGlobal({
        directory: "d",
        payload: { type: "sync", syncEvent: { id: "e", type: "session.next.text.ended.v1", seq: 1, aggregateID: "ses_a", data: { text: "secret" } } },
      }),
    ).toBe("ses_a")
  })
  test("a non-session sync aggregate (non-ses id) is session-less → passes", () => {
    expect(
      owningSessionGlobal({
        directory: "d",
        payload: { type: "sync", syncEvent: { id: "e", type: "x", seq: 1, aggregateID: "prj_x", data: {} } },
      }),
    ).toBeUndefined()
  })
  test("InstanceDisposed (server.instance.disposed) is session-less → passes", () => {
    expect(
      owningSessionGlobal({ directory: "d", payload: { id: "e", type: "server.instance.disposed", properties: { directory: "d" } } }),
    ).toBeUndefined()
  })
  test("server.connected / heartbeat control frame is session-less → passes", () => {
    expect(owningSessionGlobal({ directory: "d", payload: { id: "e", type: "server.connected", properties: {} } })).toBeUndefined()
  })
  test("malformed / unwrapped frame has no owning session", () => {
    expect(owningSessionGlobal(null)).toBeUndefined()
    expect(owningSessionGlobal({ payload: null })).toBeUndefined()
  })
})

// ── middleware integration: the real wrapper narrows a non-admin /global/event stream ──
let dir: string
async function build() {
  const tokens = createTokenStore(dir)
  const ownership = createOwnershipStore(dir)
  const bindings = createBindingStore(dir)
  const audit = createAuditLog(dir, { date: () => "2026-07-11" })
  const auth = createMaridAuth({ tokens, ownership, bindings, audit, limiter: createRateLimiter() })
  return { tokens, ownership, bindings, auth }
}

const bearer = (secret: string) => ({ authorization: `Bearer ${secret}`, accept: "text/event-stream" })

// A ROUTING-WRAPPED /global/event frame: { directory, payload: { id, type, properties } }.
const wrapped = (type: string, properties: Record<string, unknown>) =>
  `event: message\ndata: ${JSON.stringify({ directory: "d", payload: { id: "e", type, properties } })}\n\n`
// The durable sync TWIN for a session event — same data, addressed by aggregateID.
const syncTwin = (aggregateID: string, data: Record<string, unknown> = {}) =>
  `event: message\ndata: ${JSON.stringify({ directory: "d", payload: { type: "sync", syncEvent: { id: "e", type: "session.next.text.ended.v1", seq: 1, aggregateID, data } } })}\n\n`

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

async function subscribeGlobal(auth: MaridAuth, secret: string, frames: string[]): Promise<string> {
  const res = await auth.handle(new Request("http://x/global/event", { headers: bearer(secret) }), eventNext(frames))
  return res.body ? await new Response(res.body).text() : ""
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-auth-global-"))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe("PART 2 · /global/event is fine-filtered owns∪bound (INV-001) for non-admin", () => {
  test("a non-admin client sees ONLY its own session frames; another session's regular AND sync twin drop", async () => {
    const { auth, tokens, ownership } = await build()
    const { secret } = await tokens.create("web", "client")
    await ownership.record("web", "ses_web")
    const out = await subscribeGlobal(auth, secret, [
      wrapped("server.connected", {}),
      wrapped("message.part.updated", { sessionID: "ses_web" }), // owned
      wrapped("message.part.updated", { sessionID: "ses_other" }), // not owned
      syncTwin("ses_other", { text: "leaked-secret" }), // the durable twin of ses_other — MUST drop
    ])
    expect(out).toContain("server.connected") // infra always passes
    expect(out).toContain("ses_web") // owned session visible
    expect(out).not.toContain("ses_other") // regular twin dropped
    expect(out).not.toContain("leaked-secret") // sync twin dropped (no durable leak)
  })

  test("an ATTACHED (bound, non-owned) session mirrors into the channel on /global/event", async () => {
    const { auth, tokens, ownership, bindings } = await build()
    const { secret } = await tokens.create("tg", "channel:tg")
    await ownership.record("tg", "ses_tg")
    await bindings.attach("tg", "ses_web") // operator attaches the channel to the web session
    const out = await subscribeGlobal(auth, secret, [
      wrapped("message.part.updated", { sessionID: "ses_web" }), // web/TUI-driven turn
      wrapped("message.part.updated", { sessionID: "ses_tg" }), // its own turn
    ])
    expect(out).toContain("ses_web") // mirrored IN via the binding
    expect(out).toContain("ses_tg") // own turn still visible
  })

  test("session-less control frames pass so web/TUI keep working (InstanceDisposed, config)", async () => {
    const { auth, tokens, ownership } = await build()
    const { secret } = await tokens.create("web", "client")
    await ownership.record("web", "ses_web")
    const out = await subscribeGlobal(auth, secret, [
      wrapped("server.instance.disposed", { directory: "d" }),
      wrapped("installation.updated", { version: "1.2.3" }),
    ])
    expect(out).toContain("server.instance.disposed")
    expect(out).toContain("installation.updated")
  })

  test("admin is never filtered on /global/event (full firehose)", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("root", "admin")
    const out = await subscribeGlobal(auth, secret, [
      wrapped("message.part.updated", { sessionID: "ses_a" }),
      wrapped("message.part.updated", { sessionID: "ses_b" }),
    ])
    expect(out).toContain("ses_a")
    expect(out).toContain("ses_b")
  })
})
