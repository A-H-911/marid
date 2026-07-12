import { describe, expect, test } from "bun:test"
import {
  filterOwnedArray,
  filterSseStream,
  keepFrame,
  owningSession,
  pickPermissionSessionId,
  pickSessionId,
} from "../src/event-filter"

const frame = (type: string, properties: Record<string, unknown>) =>
  `event: message\ndata: ${JSON.stringify({ id: "e", type, properties })}\n\n`

function byteStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let out = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }
  return out
}

describe("owningSession: sessionID is the top-level aggregate key (v1 + v2)", () => {
  test("v1 message.part.updated carries sessionID at top level", () => {
    expect(owningSession({ type: "message.part.updated", properties: { sessionID: "ses_a", part: {} } })).toBe("ses_a")
  })
  test("v2 session.next.text.delta carries sessionID at top level", () => {
    expect(owningSession({ type: "session.next.text.delta", properties: { sessionID: "ses_b", delta: "x" } })).toBe(
      "ses_b",
    )
  })
  test("session-less infrastructure frame has no owning session", () => {
    expect(owningSession({ type: "server.heartbeat", properties: {} })).toBeUndefined()
  })
  test("session.error with an omitted sessionID has no owning session", () => {
    expect(owningSession({ type: "session.error", properties: { error: { name: "X" } } })).toBeUndefined()
  })
  test("non-object / malformed frame has no owning session", () => {
    expect(owningSession(null)).toBeUndefined()
    expect(owningSession({ properties: { sessionID: 42 } })).toBeUndefined()
  })
})

describe("keepFrame: session-less passes, session frames gated by ownership", () => {
  const owns = (id: string) => id === "ses_mine"
  test("keeps an owned session frame", async () => {
    expect(await keepFrame({ type: "session.status", properties: { sessionID: "ses_mine" } }, owns)).toBe(true)
  })
  test("drops a non-owned session frame", async () => {
    expect(await keepFrame({ type: "session.status", properties: { sessionID: "ses_other" } }, owns)).toBe(false)
  })
  test("keeps a session-less frame (infrastructure the client needs)", async () => {
    expect(await keepFrame({ type: "server.connected", properties: {} }, owns)).toBe(true)
  })
})

describe("filterSseStream: drops non-owned frames, buffers across chunk boundaries", () => {
  const owns = (id: string) => id === "ses_mine"

  test("keeps owned + infrastructure frames, drops others (single chunk)", async () => {
    const input =
      frame("server.connected", {}) +
      frame("message.part.updated", { sessionID: "ses_mine" }) +
      frame("message.part.updated", { sessionID: "ses_other" })
    const out = await readAll(filterSseStream(byteStream([input]), owns))
    expect(out).toContain("server.connected")
    expect(out).toContain("ses_mine")
    expect(out).not.toContain("ses_other")
  })

  test("reassembles a frame split across two chunks", async () => {
    const full = frame("message.part.updated", { sessionID: "ses_other" }) + frame("session.status", { sessionID: "ses_mine" })
    const cut = Math.floor(full.length / 2)
    const out = await readAll(filterSseStream(byteStream([full.slice(0, cut), full.slice(cut)]), owns))
    expect(out).toContain("ses_mine")
    expect(out).not.toContain("ses_other")
  })

  test("passes an unparseable data frame through unchanged (fail-open on parse)", async () => {
    const out = await readAll(filterSseStream(byteStream(["event: message\ndata: not-json\n\n"]), owns))
    expect(out).toContain("not-json")
  })
})

describe("filterOwnedArray: keeps only owned entries", () => {
  const owns = (id: string) => id === "ses_mine"
  test("session list is filtered by entry id", async () => {
    const body = JSON.stringify([{ id: "ses_mine", title: "a" }, { id: "ses_other", title: "b" }])
    const kept = JSON.parse(await filterOwnedArray(body, pickSessionId, owns)) as Array<{ id: string }>
    expect(kept.map((s) => s.id)).toEqual(["ses_mine"])
  })
  test("permission list is filtered by entry sessionID (not the permission id)", async () => {
    const body = JSON.stringify([
      { id: "per_1", sessionID: "ses_mine", permission: "bash" },
      { id: "per_2", sessionID: "ses_other", permission: "bash" },
    ])
    const kept = JSON.parse(await filterOwnedArray(body, pickPermissionSessionId, owns)) as Array<{ id: string }>
    expect(kept.map((p) => p.id)).toEqual(["per_1"])
  })
  test("a non-array body passes through unchanged", async () => {
    const body = JSON.stringify({ error: "nope" })
    expect(await filterOwnedArray(body, pickSessionId, owns)).toBe(body)
  })
})
