import { describe, expect, test } from "bun:test"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { createChannelClient, type Streamer } from "../src/client"

// WBS-6.5 (FR-036/043, RISK-006): the channel client reconnects a dropped firehose with
// backoff, re-fetches authoritative state for OWNED sessions on reconnect (a turn that
// finished during the gap is recovered; a BOUND non-owned session is NOT re-fetched —
// owns-gated route, INV-001 — it resumes live only), and re-subscribes when an
// operator attach/detach changes its bindings mid-stream (poll → fresh binding snapshot).

// Same minimal async queue as client.test.ts, but the fake SDK below hands out a FRESH
// queue on every global.event() call so a test can count re-subscribes and close a
// stream to simulate a drop.
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

function recordingStreamers() {
  const created: Array<{ sessionID: string; pushes: string[]; finishes: string[] }> = []
  const createStreamer = (sessionID: string): Streamer => {
    const rec = { sessionID, pushes: [] as string[], finishes: [] as string[] }
    created.push(rec)
    return { push: async (t) => void rec.pushes.push(t), finish: async (t) => void rec.finishes.push(t) }
  }
  return { created, createStreamer }
}

type SessionMessage = { info: { role: string; id?: string }; parts: Array<{ id: string; type: string; text: string }> }

// A reconnectable fake SDK: every global.event() yields a new queue (counted in `queues`);
// session.messages() records the sessionID it was asked for and returns scripted history.
function reconnectableSdk() {
  const queues: ReturnType<typeof eventQueue>[] = []
  const messagesCalls: string[] = []
  let messagesFor: (sessionID: string) => SessionMessage[] = () => []
  const sdk = {
    global: {
      event: async () => {
        const q = eventQueue()
        queues.push(q)
        return { stream: q.iterator() }
      },
    },
    session: {
      messages: async ({ sessionID }: { sessionID: string }) => {
        messagesCalls.push(sessionID)
        return { data: messagesFor(sessionID) }
      },
    },
  } as unknown as OpencodeClient
  return { sdk, queues, messagesCalls, setMessages: (fn: (s: string) => SessionMessage[]) => (messagesFor = fn) }
}

// Cap every sleep (backoff + poll cadence) at ~1ms so timing is deterministic and fast,
// while still yielding to the macrotask queue (so the poll loop and pump interleave).
const fastSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.min(ms, 1)))

describe("createChannelClient reconnect (WBS-6.5a)", () => {
  test("re-subscribes after the firehose drops", async () => {
    const { sdk, queues } = reconnectableSdk()
    const { createStreamer } = recordingStreamers()
    const controller = new AbortController()
    const client = createChannelClient({ sdk, signal: controller.signal, createStreamer, onAsk: () => {}, sleep: fastSleep })
    const { done } = await client.start()
    expect(await waitFor(() => queues.length === 1)).toBe(true)
    queues[0]!.close() // simulate a dropped SSE stream
    expect(await waitFor(() => queues.length === 2)).toBe(true) // auto-recovered
    controller.abort()
    queues.at(-1)!.close()
    await done.catch(() => {})
  })

  test("shutdown resolves done promptly even with a non-abort-aware injected sleep and a long poll interval", async () => {
    const { sdk, queues } = reconnectableSdk()
    const { createStreamer } = recordingStreamers()
    const controller = new AbortController()
    // Production-style sleep (marid-telegram.ts) — NOT abort-aware. Without an internal
    // shutdown race, the 5s poll interval would park `done` for ~5s after abort.
    const naiveSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
    const client = createChannelClient({
      sdk,
      signal: controller.signal,
      createStreamer,
      onAsk: () => {},
      sleep: naiveSleep,
      bindingPollMs: 5000,
      pollBindings: async () => new Set(),
    })
    const { done } = await client.start()
    expect(await waitFor(() => queues.length === 1)).toBe(true)
    controller.abort()
    queues.at(-1)!.close()
    const resolved = await Promise.race([
      done.then(() => true),
      new Promise<boolean>((r) => setTimeout(() => r(false), 800)),
    ])
    expect(resolved).toBe(true) // resolves well under the 5s poll interval
  })

  test("aborting stops the pump, resolves done, and does not re-subscribe again", async () => {
    const { sdk, queues } = reconnectableSdk()
    const { createStreamer } = recordingStreamers()
    const controller = new AbortController()
    const client = createChannelClient({ sdk, signal: controller.signal, createStreamer, onAsk: () => {}, sleep: fastSleep })
    const { done } = await client.start()
    expect(await waitFor(() => queues.length === 1)).toBe(true)
    controller.abort()
    queues[0]!.close()
    await done // resolves on shutdown
    const settled = queues.length
    await new Promise((r) => setTimeout(r, 40))
    expect(queues.length).toBe(settled) // no reconnect after abort
  })
})

describe("createChannelClient re-fetch recovery (WBS-6.5b)", () => {
  test("re-fetches OWNED sessions on reconnect and flushes the latest assistant text; never re-fetches a BOUND session", async () => {
    const { sdk, queues, messagesCalls, setMessages } = reconnectableSdk()
    setMessages((sid) =>
      sid === "ses_owned"
        ? [
            { info: { role: "user", id: "u" }, parts: [] },
            { info: { role: "assistant", id: "a" }, parts: [{ id: "p1", type: "text", text: "recovered" }] },
          ]
        : [],
    )
    const { created, createStreamer } = recordingStreamers()
    const controller = new AbortController()
    const client = createChannelClient({ sdk, signal: controller.signal, createStreamer, onAsk: () => {}, sleep: fastSleep })
    const { done } = await client.start()
    expect(await waitFor(() => queues.length === 1)).toBe(true)

    client.beginTurn("ses_owned") // OWNED (operator-initiated)
    // A BOUND (non-owned) session: it never got beginTurn — a mirrored-in frame lazily tracks it.
    queues[0]!.push({
      payload: { type: "message.part.updated", properties: { sessionID: "ses_bound", part: { id: "pb", type: "text", text: "x", messageID: "mb" } } },
    })
    expect(await waitFor(() => created.some((c) => c.sessionID === "ses_bound"))).toBe(true)

    queues[0]!.close() // drop → reconnect → refetchOwned
    expect(await waitFor(() => messagesCalls.includes("ses_owned"))).toBe(true)
    expect(messagesCalls).not.toContain("ses_bound") // INV-001: bound history is owns-gated (403)
    expect(await waitFor(() => created.some((c) => c.sessionID === "ses_owned" && c.pushes.includes("recovered")))).toBe(true)

    controller.abort()
    queues.at(-1)!.close()
    await done.catch(() => {})
  })
})

describe("createChannelClient attach-triggered reconnect (WBS-6.5c)", () => {
  test("a binding-set change (attach OR detach) re-subscribes; no change does not", async () => {
    const { sdk, queues } = reconnectableSdk()
    const { createStreamer } = recordingStreamers()
    const controller = new AbortController()
    let bindings = new Set<string>() // operator's attachments for this channel token
    const client = createChannelClient({
      sdk,
      signal: controller.signal,
      createStreamer,
      onAsk: () => {},
      sleep: fastSleep,
      bindingPollMs: 1,
      pollBindings: async () => new Set(bindings),
    })
    const { done } = await client.start()
    expect(await waitFor(() => queues.length === 1)).toBe(true)

    // Steady state: unchanged bindings must NOT churn the stream.
    await new Promise((r) => setTimeout(r, 40))
    expect(queues.length).toBe(1)

    bindings = new Set(["ses_new"]) // operator attaches mid-stream
    expect(await waitFor(() => queues.length === 2)).toBe(true) // re-subscribed → fresh snapshot

    bindings = new Set() // operator detaches
    expect(await waitFor(() => queues.length === 3)).toBe(true) // detach also re-subscribes

    controller.abort()
    queues.at(-1)!.close()
    await done.catch(() => {})
  })
})
