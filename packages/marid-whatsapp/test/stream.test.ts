import { describe, expect, test } from "bun:test"
import { createStreamer } from "../src/stream"

// WBS-7.3 / AC-018 throttled streaming-sim. Deterministic via an injected clock.

interface Op {
  kind: "send" | "edit" | "presence"
  arg: string
}

function harness(cadenceMs = 2500) {
  let clock = 0
  const ops: Op[] = []
  let seq = 0
  const client = {
    sendText: async (_jid: string, text: string) => {
      ops.push({ kind: "send", arg: text })
      return { id: `m${seq++}` }
    },
    editText: async (_jid: string, _id: string, text: string) => {
      ops.push({ kind: "edit", arg: text })
    },
    setPresence: async (_jid: string, p: string) => {
      ops.push({ kind: "presence", arg: p })
    },
  }
  const streamer = createStreamer({ client, jid: "1@c.us", now: () => clock, cadenceMs })
  return { streamer, ops, tick: (ms: number) => (clock += ms) }
}

describe("createStreamer", () => {
  test("first push sends typing then the opening message", async () => {
    const h = harness()
    await h.streamer.push("Hello")
    expect(h.ops).toEqual([
      { kind: "presence", arg: "typing" },
      { kind: "send", arg: "Hello" },
    ])
  })

  test("edits are coalesced to at most one per cadence window", async () => {
    const h = harness(2500)
    await h.streamer.push("Hel") // send
    await h.streamer.push("Hello") // within window -> throttled, no edit
    await h.streamer.push("Hello wor") // still within -> throttled
    expect(h.ops.filter((o) => o.kind === "edit")).toEqual([])

    h.tick(2500)
    await h.streamer.push("Hello world") // window elapsed -> one edit, to the LATEST text
    expect(h.ops.filter((o) => o.kind === "edit")).toEqual([{ kind: "edit", arg: "Hello world" }])
  })

  test("finish force-flushes the final text regardless of cadence", async () => {
    const h = harness(2500)
    await h.streamer.push("Partial")
    await h.streamer.finish("Partial and complete") // no tick — still forces
    expect(h.ops).toEqual([
      { kind: "presence", arg: "typing" },
      { kind: "send", arg: "Partial" },
      { kind: "edit", arg: "Partial and complete" },
      { kind: "presence", arg: "paused" },
    ])
  })

  test("never edits to an unchanged value", async () => {
    const h = harness(0) // cadence 0 -> throttle never blocks
    await h.streamer.push("Same")
    await h.streamer.push("Same") // identical -> no edit
    expect(h.ops.filter((o) => o.kind === "edit")).toEqual([])
  })

  test("an empty / whitespace-only push does nothing (no phantom send)", async () => {
    const h = harness()
    await h.streamer.push("   ")
    await h.streamer.push("")
    expect(h.ops).toEqual([])
  })

  test("finish with no prior text sends nothing and no presence", async () => {
    const h = harness()
    await h.streamer.finish("")
    expect(h.ops).toEqual([])
  })

  test("trailing whitespace is trimmed so growth-by-whitespace is not an edit", async () => {
    const h = harness(0)
    await h.streamer.push("Hi")
    await h.streamer.push("Hi   ") // trims to "Hi" -> unchanged
    expect(h.ops.filter((o) => o.kind === "edit")).toEqual([])
  })
})
