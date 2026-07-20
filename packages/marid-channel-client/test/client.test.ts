import { describe, expect, test } from "bun:test"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { createChannelClient, parseAskEvent, type PermissionAsk, type Streamer } from "../src/client"

// A minimal async event queue: next() blocks until an item is pushed or the queue is
// closed, mirroring an SSE stream.
function eventQueue() {
  const items: unknown[] = []
  let waiting: ((r: IteratorResult<unknown>) => void) | null = null
  let closed = false
  return {
    push(v: unknown) {
      if (waiting) {
        const w = waiting
        waiting = null
        w({ value: v, done: false })
      } else items.push(v)
    },
    close() {
      closed = true
      if (waiting) {
        const w = waiting
        waiting = null
        w({ value: undefined, done: true })
      }
    },
    iterator(): AsyncIterator<unknown> {
      return {
        next() {
          if (items.length) return Promise.resolve({ value: items.shift()!, done: false })
          if (closed) return Promise.resolve({ value: undefined, done: true })
          return new Promise((res) => (waiting = res))
        },
        return() {
          closed = true
          return Promise.resolve({ value: undefined, done: true })
        },
      }
    },
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true
    await new Promise((r) => setTimeout(r, 5))
  }
  return predicate()
}

// Records every streamer created, keyed by the session it was made for, and the pushes /
// finishes each streamer saw — the channel-supplied sink.
function recordingStreamers() {
  const created: Array<{ sessionID: string; pushes: string[]; finishes: string[] }> = []
  const createStreamer = (sessionID: string): Streamer => {
    const rec = { sessionID, pushes: [] as string[], finishes: [] as string[] }
    created.push(rec)
    return {
      push: async (t) => void rec.pushes.push(t),
      finish: async (t) => void rec.finishes.push(t),
    }
  }
  return { created, createStreamer }
}

function fakeSdk(events: ReturnType<typeof eventQueue>): OpencodeClient {
  return { global: { event: async () => ({ stream: events.iterator() }) } } as unknown as OpencodeClient
}

describe("parseAskEvent", () => {
  test("extracts id/sessionID/title from a permission.asked frame", () => {
    expect(
      parseAskEvent({ type: "permission.asked", properties: { id: "per_1", sessionID: "ses_1", permission: "bash" } }),
    ).toEqual({ id: "per_1", sessionID: "ses_1", title: "bash" })
  })
  test("accepts permission.updated too", () => {
    expect(parseAskEvent({ type: "permission.updated", properties: { id: "per_2", sessionID: "ses_2" } })?.id).toBe("per_2")
  })
  test("returns undefined for a non-ask event or a frame missing id/sessionID", () => {
    expect(parseAskEvent({ type: "message.part.updated", properties: { id: "x", sessionID: "s" } })).toBeUndefined()
    expect(parseAskEvent({ type: "permission.asked", properties: { sessionID: "ses_x" } })).toBeUndefined()
    expect(parseAskEvent({ type: "permission.asked", properties: { id: "per_x" } })).toBeUndefined()
  })
})

describe("createChannelClient pump", () => {
  type CapturedFile = { sessionID: string; url: string; mime: string; filename?: string }
  async function withClient(
    body: (ctx: {
      events: ReturnType<typeof eventQueue>
      created: ReturnType<typeof recordingStreamers>["created"]
      asks: PermissionAsk[]
      files: CapturedFile[]
      begin: (id: string) => void
    }) => Promise<void>,
  ) {
    const events = eventQueue()
    const { created, createStreamer } = recordingStreamers()
    const asks: PermissionAsk[] = []
    const files: CapturedFile[] = []
    const controller = new AbortController()
    const client = createChannelClient({
      sdk: fakeSdk(events),
      signal: controller.signal,
      createStreamer,
      onAsk: (ask) => void asks.push(ask),
      onFile: (sessionID, file) => void files.push({ sessionID, ...file }),
    })
    const { done } = await client.start()
    try {
      await body({ events, created, asks, files, begin: (id) => client.beginTurn(id) })
    } finally {
      controller.abort()
      events.close()
      await done.catch(() => {})
    }
  }

  // DISTINCT text parts of one message still render as SEPARATE channel messages — the
  // deliberate Telegram "defect-4" behavior (multi-part replies must not be joined). Only
  // exact duplicates are suppressed (next test); distinct content is never dropped.
  test("distinct text parts of one message each render as their own message (defect-4 preserved)", async () => {
    await withClient(async ({ events, created, begin }) => {
      begin("ses_1")
      events.push({ payload: { type: "message.part.updated", properties: { sessionID: "ses_1", part: { id: "p1", type: "text", text: "First", messageID: "m1" } } } })
      events.push({ payload: { type: "message.part.updated", properties: { sessionID: "ses_1", part: { id: "p2", type: "text", text: "Second", messageID: "m1" } } } })
      expect(await waitFor(() => created.length === 2)).toBe(true)
      expect(created.map((c) => c.pushes.at(-1)).sort()).toEqual(["First", "Second"])
    })
  })

  // F2 (EXP-012): a reasoning model re-emits the FULL answer under several new part.ids in one
  // assistant message — those exact duplicates are suppressed so the reply is not multiplied.
  test("duplicate text parts (reasoning re-emit) dedup to one message — F2 regression", async () => {
    await withClient(async ({ events, created, begin }) => {
      begin("ses_1")
      // The observed bug: GLM-5.2 re-emitted the full answer under 3 distinct part.ids in ONE
      // assistant message, tripling the WhatsApp reply. It must render exactly once.
      for (const id of ["p1", "p2", "p3"]) {
        events.push({ payload: { type: "message.part.updated", properties: { sessionID: "ses_1", part: { id, type: "text", text: "The answer is 391.", messageID: "m1" } } } })
      }
      expect(await waitFor(() => created.length === 1)).toBe(true)
      // Shown once — never "391...391...391".
      expect(await waitFor(() => created[0]!.pushes.at(-1) === "The answer is 391.")).toBe(true)
    })
  })

  test("different messageIDs still get separate streamers (one per assistant message)", async () => {
    await withClient(async ({ events, created, begin }) => {
      begin("ses_1")
      events.push({ payload: { type: "message.part.updated", properties: { sessionID: "ses_1", part: { id: "p1", type: "text", text: "A", messageID: "m1" } } } })
      events.push({ payload: { type: "message.part.updated", properties: { sessionID: "ses_1", part: { id: "p2", type: "text", text: "B", messageID: "m2" } } } })
      expect(await waitFor(() => created.length === 2)).toBe(true)
      expect(created.map((c) => c.pushes.at(-1)).sort()).toEqual(["A", "B"])
    })
  })

  test("a done event force-finishes each part's final text", async () => {
    await withClient(async ({ events, created, begin }) => {
      begin("ses_1")
      events.push({ payload: { type: "message.part.updated", properties: { sessionID: "ses_1", part: { id: "p1", type: "text", text: "Answer", messageID: "m1" } } } })
      expect(await waitFor(() => created.length === 1)).toBe(true)
      events.push({ payload: { type: "session.idle", properties: { sessionID: "ses_1" } } })
      expect(await waitFor(() => created[0]!.finishes.at(-1) === "Answer")).toBe(true)
    })
  })

  test("delta-style events accumulate into one part", async () => {
    await withClient(async ({ events, created, begin }) => {
      begin("ses_1")
      events.push({ payload: { type: "session.next.text.delta", properties: { sessionID: "ses_1", textID: "t1", delta: "Hel" } } })
      events.push({ payload: { type: "session.next.text.delta", properties: { sessionID: "ses_1", textID: "t1", delta: "lo" } } })
      expect(await waitFor(() => created.length === 1 && created[0]!.pushes.at(-1) === "Hello")).toBe(true)
    })
  })

  test("the operator's own (user) text is never streamed back", async () => {
    await withClient(async ({ events, created, begin }) => {
      begin("ses_1")
      events.push({ payload: { type: "message.updated", properties: { sessionID: "ses_1", info: { id: "m_user", role: "user" } } } })
      events.push({ payload: { type: "message.part.updated", properties: { sessionID: "ses_1", part: { id: "p_user", type: "text", text: "echo me", messageID: "m_user" } } } })
      // Give the pump a beat; the user part must NOT produce a streamer.
      await new Promise((r) => setTimeout(r, 50))
      expect(created.length).toBe(0)
    })
  })

  // WBS-6.1b PART 3 (ADR-0012): mirroring-IN. A bound (operator-attached, non-owned)
  // session's turn originates on web/TUI — the channel never calls beginTurn for it. After
  // the server's owns∪bound /global/event filter, a frame for such a session still arrives;
  // the client must lazily create tracking + a streamer so it mirrors into the channel.
  test("a bound session with NO beginTurn lazily creates a streamer (mirroring-in)", async () => {
    await withClient(async ({ events, created }) => {
      events.push({ payload: { type: "message.part.updated", properties: { sessionID: "ses_bound", part: { id: "p1", type: "text", text: "mirrored-in", messageID: "m1" } } } })
      expect(
        await waitFor(() => created.length === 1 && created[0]!.sessionID === "ses_bound" && created[0]!.pushes.at(-1) === "mirrored-in"),
      ).toBe(true)
    })
  })

  // WBS-6.2 residual (AC-017): an assistant FILE part mirrors to the channel via onFile,
  // exactly once (a file part.updated can fire more than once: empty → ready).
  test("an assistant file part is surfaced to onFile once (deduped by part.id)", async () => {
    await withClient(async ({ events, files, begin }) => {
      begin("ses_1")
      const filePart = { id: "pf1", type: "file", url: "https://inst/file/report.pdf", mime: "application/pdf", filename: "report.pdf", messageID: "m1" }
      events.push({ payload: { type: "message.part.updated", properties: { sessionID: "ses_1", part: filePart } } })
      events.push({ payload: { type: "message.part.updated", properties: { sessionID: "ses_1", part: filePart } } })
      expect(await waitFor(() => files.length === 1)).toBe(true)
      expect(files[0]).toEqual({ sessionID: "ses_1", url: "https://inst/file/report.pdf", mime: "application/pdf", filename: "report.pdf" })
      // A beat to prove the duplicate frame produced no second onFile.
      await new Promise((r) => setTimeout(r, 30))
      expect(files.length).toBe(1)
    })
  })

  test("the operator's own inbound file (user message) is never echoed to onFile", async () => {
    await withClient(async ({ events, files, begin }) => {
      begin("ses_1")
      events.push({ payload: { type: "message.updated", properties: { sessionID: "ses_1", info: { id: "m_user", role: "user" } } } })
      events.push({ payload: { type: "message.part.updated", properties: { sessionID: "ses_1", part: { id: "pf_user", type: "file", url: "https://inst/file/in.jpg", mime: "image/jpeg", messageID: "m_user" } } } })
      await new Promise((r) => setTimeout(r, 50))
      expect(files.length).toBe(0)
    })
  })

  test("a session-less frame (no sessionID, not an ask) still creates no streamer", async () => {
    await withClient(async ({ events, created }) => {
      events.push({ payload: { type: "server.connected", properties: {} } })
      events.push({ payload: { type: "server.heartbeat", properties: {} } })
      await new Promise((r) => setTimeout(r, 50))
      expect(created.length).toBe(0)
    })
  })

  test("a permission ask is handed to onAsk (even without beginTurn — surfacing is session-independent)", async () => {
    await withClient(async ({ events, asks }) => {
      events.push({ payload: { type: "permission.asked", properties: { id: "per_9", sessionID: "ses_1", permission: "bash" } } })
      expect(await waitFor(() => asks.length === 1)).toBe(true)
      expect(asks[0]).toEqual({ id: "per_9", sessionID: "ses_1", title: "bash" })
    })
  })

  test("raw /event frames (no payload wrapper) are handled too", async () => {
    await withClient(async ({ events, created, begin }) => {
      begin("ses_1")
      // Unwrapped shape: type/properties at the top level.
      events.push({ type: "message.part.updated", properties: { sessionID: "ses_1", part: { id: "p1", type: "text", text: "Raw", messageID: "m1" } } })
      expect(await waitFor(() => created.length === 1 && created[0]!.pushes.at(-1) === "Raw")).toBe(true)
    })
  })
})
