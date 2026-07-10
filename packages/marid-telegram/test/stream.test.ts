import { describe, expect, test } from "bun:test"
import { createStreamer, type StreamerDeps } from "../src/stream"
import { TelegramError } from "../src/bot-api"

interface Recorded {
  sends: Array<{ text: string; parseMode?: string }>
  edits: Array<{ messageId: number; text: string; parseMode?: string }>
  typing: number
  sleeps: number[]
}

function harness(opts?: { cadenceMs?: number; limit?: number; editBehavior?: () => void; sendBehavior?: () => void }) {
  const rec: Recorded = { sends: [], edits: [], typing: 0, sleeps: [] }
  let nextId = 500
  let t = 0
  const deps: StreamerDeps = {
    chatId: 7,
    now: () => t,
    sleep: async (ms) => void rec.sleeps.push(ms),
    cadenceMs: opts?.cadenceMs ?? 2500,
    limit: opts?.limit,
    bot: {
      sendMessage: async (_c, text, o) => {
        opts?.sendBehavior?.()
        rec.sends.push({ text, parseMode: o?.parse_mode })
        return { message_id: ++nextId, chat: { id: 7, type: "private" } }
      },
      editMessageText: async (_c, messageId, text, o) => {
        opts?.editBehavior?.()
        rec.edits.push({ messageId, text, parseMode: o?.parse_mode })
      },
      sendChatAction: async () => void (rec.typing += 1),
    },
  }
  return { rec, streamer: createStreamer(deps), advance: (ms: number) => (t += ms), at: (ms: number) => (t = ms) }
}

describe("createStreamer (AC-011)", () => {
  test("first push sends one message and a typing action", async () => {
    const h = harness()
    await h.streamer.push("hello")
    expect(h.rec.sends).toHaveLength(1)
    expect(h.rec.sends[0]!.text).toBe("hello")
    expect(h.rec.sends[0]!.parseMode).toBe("MarkdownV2") // WBS-6.2: assistant text renders as MarkdownV2
    expect(h.rec.typing).toBe(1)
  })

  test("edits within the cadence window are coalesced (throttled)", async () => {
    const h = harness({ cadenceMs: 2500 })
    await h.streamer.push("a") // send at t=0
    await h.streamer.push("ab") // t=0, within cadence → no edit
    await h.streamer.push("abc") // t=0, still throttled
    expect(h.rec.sends).toHaveLength(1)
    expect(h.rec.edits).toHaveLength(0)
  })

  test("an edit fires once the cadence window elapses; unchanged text is skipped", async () => {
    const h = harness({ cadenceMs: 2500 })
    await h.streamer.push("a") // send @0
    h.advance(3000)
    await h.streamer.push("abc") // edit @3000
    expect(h.rec.edits).toHaveLength(1)
    expect(h.rec.edits[0]!.text).toBe("abc")
    await h.streamer.push("abc") // unchanged → skip (no 400 not-modified)
    expect(h.rec.edits).toHaveLength(1)
  })

  test("finish() force-flushes the complete text regardless of cadence", async () => {
    const h = harness({ cadenceMs: 100000 })
    await h.streamer.push("partial") // send @0
    await h.streamer.finish("partial and the rest") // force edit even though cadence not elapsed
    expect(h.rec.edits).toHaveLength(1)
    expect(h.rec.edits.at(-1)!.text).toBe("partial and the rest")
  })

  test("text growing past the limit opens additional messages (the 4096 split)", async () => {
    const h = harness({ limit: 10, cadenceMs: 0 })
    await h.streamer.push("0123456789ABCDEFGHIJ") // 20 chars, limit 10 → 2 messages
    expect(h.rec.sends.length).toBeGreaterThanOrEqual(2)
    expect(h.rec.sends.map((s) => s.text).join("")).toContain("ABCDEFGHIJ")
  })

  test("assistant Markdown renders as MarkdownV2, not literal markup (defect 1)", async () => {
    const h = harness()
    await h.streamer.push("Here is **bold**")
    expect(h.rec.sends[0]!.text).toBe("Here is *bold*") // **bold** -> *bold* (MarkdownV2)
    expect(h.rec.sends[0]!.parseMode).toBe("MarkdownV2")
  })

  test("a 400 parse error falls back to clean plain text (no escape backslashes)", async () => {
    let thrown = false
    const h = harness({
      sendBehavior: () => {
        if (!thrown) {
          thrown = true
          throw new TelegramError(400, "can't parse entities")
        }
      },
    })
    await h.streamer.push("Done.") // MarkdownV2 would be "Done\\." → 400 → resend plain
    expect(h.rec.sends).toHaveLength(1) // only the successful fallback send is recorded
    expect(h.rec.sends[0]!.text).toBe("Done.") // clean plain, not "Done\\."
    expect(h.rec.sends[0]!.parseMode).toBeUndefined()
  })

  test("a 429 on edit honors retry_after and retries", async () => {
    let thrown = false
    const h = harness({
      cadenceMs: 0,
      editBehavior: () => {
        if (!thrown) {
          thrown = true
          throw new TelegramError(429, "Too Many Requests", 3)
        }
      },
    })
    await h.streamer.push("first") // send
    await h.streamer.push("first edit") // edit → 429 once → sleep(3000) → retry
    expect(h.rec.sleeps).toContain(3000)
    expect(h.rec.edits.length).toBeGreaterThanOrEqual(1)
  })
})
