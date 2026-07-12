import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { EventManifest } from "@opencode-ai/schema/event-manifest"
import { createTokenStore } from "@marid/gateway"
import { Server } from "../../src/server/server"
import { maridServe, type MaridServer } from "../../src/marid/serve"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances } from "../fixture/fixture"

// TEST-CONTRACT (WBS-1.4): pins the gate-7 v1 route surface + event taxonomy that
// Marid commits to (api-event-contract.md). Fails on any breaking upstream change,
// so it is BLOCKING on sync PRs. Marid does not re-version v1 — it pins it.

// Committed v1 routes (ADR-0003: v1 behind marid-auth). OpenAPI path templates.
const COMMITTED_ROUTES = [
  "/session", // create + list/discover
  "/session/{sessionID}", // get
  "/session/{sessionID}/message", // history (paged) + prompt
  "/session/{sessionID}/prompt_async", // async prompt (client message id)
  "/session/{sessionID}/abort", // cancel/abort
  "/session/{sessionID}/fork", // branch
  "/session/{sessionID}/permissions/{permissionID}", // session-scoped permission
  "/event", // global SSE firehose (live)
  "/permission", // list pending
  "/permission/{requestID}/reply", // approve/deny
  "/config", // read config
  "/agent", // list agents
  "/provider", // list providers/models
  "/global/health", // meta health
]

// Committed event taxonomy (api-event-contract §"Event contract"). Reuses upstream
// event types; here we pin the families the contract names.
const COMMITTED_EVENTS = [
  "session.created",
  "session.updated",
  "session.deleted", // session lifecycle
  "message.updated",
  "message.part.updated",
  "message.part.delta", // message/part deltas
  "session.next.text.delta",
  "session.next.reasoning.delta", // text + reasoning deltas
  "session.next.tool.called",
  "session.next.tool.progress",
  "session.next.tool.success",
  "session.next.tool.failed", // tool lifecycle
  "session.next.step.started",
  "session.next.step.ended",
  "session.next.step.failed", // step lifecycle
  "session.status",
  "session.idle", // status / idle
  "permission.asked",
  "permission.replied", // permission asks
]

describe("TEST-CONTRACT: committed v1 route surface", () => {
  let paths: Set<string>
  beforeAll(async () => {
    const spec = (await Server.openapi()) as { paths?: Record<string, unknown> }
    paths = new Set(Object.keys(spec.paths ?? {}))
  })

  test.each(COMMITTED_ROUTES)("commits route %s", (route) => {
    expect(paths.has(route)).toBe(true)
  })
})

describe("TEST-CONTRACT: committed event taxonomy", () => {
  test.each(COMMITTED_EVENTS)("commits event type %s", (type) => {
    expect(EventManifest.Latest.has(type)).toBe(true)
  })

  test("per-aggregate durable replay set exists (seq/replay ordering guarantee)", () => {
    // Ordering/replay is guaranteed by per-aggregate sequence numbers; the durable
    // manifest is the set of events that support ?after=<seq> replay.
    expect(EventManifest.Durable.size).toBeGreaterThan(0)
  })

  test("every session-aggregated event exposes a top-level sessionID (marid-auth's isolation invariant)", () => {
    // marid-auth/event-filter isolates a client's stream by probing
    // properties.sessionID. That is safe only while every session-scoped event
    // carries sessionID at the top level — which it does, because sessionID is the
    // event-sourcing aggregate key. This pins that invariant: if an upstream sync
    // adds a session-aggregated event that hides its sessionID, this fails BEFORE it
    // becomes a silent cross-session leak (fail-open passes un-attributable frames).
    const offenders: string[] = []
    for (const def of EventManifest.Latest.values()) {
      if (def.durable?.aggregate !== "sessionID") continue
      const fields = (def.data as { fields?: Record<string, unknown> }).fields ?? {}
      if (!("sessionID" in fields)) offenders.push(def.type)
    }
    expect(offenders).toEqual([])
  })
})

describe("TEST-CONTRACT: live transport through marid (SSE only, DEC-002)", () => {
  let dir: string
  let server: MaridServer | undefined
  let secret: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-contract-"))
    secret = (await createTokenStore(dir).create("root", "admin")).secret
    server = maridServe({ hostname: "127.0.0.1", port: 0, dir })
  })
  afterEach(async () => {
    server?.stop()
    server = undefined
    await disposeAllInstances()
    await resetDatabase()
    await fs.rm(dir, { recursive: true, force: true })
  })

  test("GET /event streams server-sent events", async () => {
    const controller = new AbortController()
    const res = await fetch(new URL("/event", server!.url), {
      headers: { authorization: `Bearer ${secret}` },
      signal: controller.signal,
    })
    try {
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type") ?? "").toContain("text/event-stream")
    } finally {
      controller.abort()
    }
  })

  test("meta health returns a healthy payload through the authenticated wrapper", async () => {
    const res = await fetch(new URL("/global/health", server!.url), {
      headers: { authorization: `Bearer ${secret}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { healthy?: unknown }
    expect(body.healthy).toBe(true)
  })
})

describe("TEST-CONTRACT: client-scope session isolation through marid (live, real serialization)", () => {
  let dir: string
  let server: MaridServer | undefined
  let adminSecret: string
  let clientSecret: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-isolation-"))
    const store = createTokenStore(dir)
    adminSecret = (await store.create("root", "admin")).secret
    clientSecret = (await store.create("c", "client")).secret
    server = maridServe({ hostname: "127.0.0.1", port: 0, dir })
  })
  afterEach(async () => {
    server?.stop()
    server = undefined
    await disposeAllInstances()
    await resetDatabase()
    await fs.rm(dir, { recursive: true, force: true })
  })

  const createSession = async (secret: string): Promise<string> => {
    const res = await fetch(new URL("/session", server!.url), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    })
    expect(res.status).toBe(200)
    return ((await res.json()) as { id: string }).id
  }
  const listSessionIds = async (secret: string): Promise<string[]> => {
    // Send a real Accept-Encoding so the isolation path exercises the wrapper's
    // strip-then-filter against actual server serialization (would-be gzip).
    const res = await fetch(new URL("/session", server!.url), {
      headers: { authorization: `Bearer ${secret}`, "accept-encoding": "gzip, deflate" },
    })
    expect(res.status).toBe(200)
    return ((await res.json()) as Array<{ id: string }>).map((s) => s.id)
  }

  test("a client lists only the sessions it created; admin sees all", async () => {
    const mine = await createSession(clientSecret)
    const other = await createSession(adminSecret) // owned by nobody the client is
    expect(mine.startsWith("ses")).toBe(true)
    expect(other).not.toBe(mine)

    const clientIds = await listSessionIds(clientSecret)
    expect(clientIds).toContain(mine)
    expect(clientIds).not.toContain(other) // isolation: the other session is hidden

    const adminIds = await listSessionIds(adminSecret)
    expect(adminIds).toContain(mine)
    expect(adminIds).toContain(other) // admin is never filtered
  })
})
