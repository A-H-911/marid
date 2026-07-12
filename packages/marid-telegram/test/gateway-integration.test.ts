import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import type { BotApi } from "../src/bot-api"
import { runGateway } from "../src/gateway"

// End-to-end proof of the gateway's permission ROUND TRIP (AC-012) that the live
// server harness cannot produce (the served run resolves zero tools, so no real
// tool-permission fires). Here runGateway is driven with a FULLY FAKED SDK whose
// event stream emits a schema-shaped permission.asked (packages/schema/src/v1/
// permission.ts: id/sessionID/permission). We assert the whole path:
//   operator message → session.create + promptAsync → permission.asked event →
//   inline keyboard in the operator's chat → Deny callback → permission.respond(reject).

const OPERATOR = 111

// A minimal async event queue: next() blocks until an item is pushed or the queue
// is closed, mirroring an SSE stream.
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
    await new Promise((r) => setTimeout(r, 10))
  }
  return predicate()
}

describe("runGateway permission round trip (AC-012, faked SDK)", () => {
  let dir: string
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-gw-"))
  })
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  test("permission.asked → keyboard → Deny → permission.respond(reject)", async () => {
    const events = eventQueue()
    const updates: unknown[] = [] // bot getUpdates queue
    const sent: Array<{ chatId: number; text: string; markup?: unknown }> = []
    const replies: Array<{ sessionID: string; permissionID: string; response: string }> = []
    let promptCount = 0

    const bot = {
      getUpdates: async () => {
        if (updates.length) return updates.splice(0) as never
        await new Promise((r) => setTimeout(r, 15))
        return [] as never
      },
      sendMessage: async (chatId: number, text: string, opts?: { reply_markup?: unknown }) => {
        sent.push({ chatId, text, markup: opts?.reply_markup })
        return { message_id: sent.length, chat: { id: chatId, type: "private" } } as never
      },
      editMessageText: async () => undefined,
      editMessageReplyMarkup: async () => undefined,
      sendChatAction: async () => undefined,
      answerCallbackQuery: async () => undefined,
    } as unknown as BotApi

    const sdk = {
      global: { event: async () => ({ stream: events.iterator() }) },
      session: {
        create: async () => ({ data: { id: "ses_1" } }),
        promptAsync: async () => {
          promptCount += 1
          return { data: {} }
        },
      },
      permission: {
        respond: async (p: { sessionID: string; permissionID: string; response: string }) => {
          replies.push(p)
          return { data: true }
        },
      },
    } as unknown as OpencodeClient

    const controller = new AbortController()
    const gateway = runGateway({
      sdk,
      bot,
      allow: new Set([OPERATOR]),
      agent: "telegram-channel",
      dedupFile: path.join(dir, "dedup.json"),
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      timers: {
        set: (cb, ms) => {
          const t = setTimeout(cb, ms)
          return () => clearTimeout(t)
        },
      },
      cadenceMs: 0,
      permissionTimeoutMs: 60_000,
      pollTimeoutSec: 1,
      log: () => {},
      signal: controller.signal,
    })

    try {
      // 1. Operator sends a message → gateway creates a session and prompts.
      updates.push({ update_id: 1, message: { message_id: 1, from: { id: OPERATOR, is_bot: false }, chat: { id: OPERATOR, type: "private" }, text: "do a thing" } })
      expect(await waitFor(() => promptCount === 1)).toBe(true)

      // 2. The server asks a permission (real schema shape) for that session.
      events.push({ payload: { id: "evt_1", type: "permission.asked", properties: { id: "per_9", sessionID: "ses_1", permission: "bash", patterns: ["*"], metadata: {}, always: [] } } })

      // 3. An inline keyboard appears in the operator's chat.
      expect(await waitFor(() => sent.some((m) => m.markup))).toBe(true)
      const prompt = sent.find((m) => m.markup)!
      const keyboard = (prompt.markup as { inline_keyboard: Array<Array<{ callback_data: string }>> }).inline_keyboard[0]!
      const denyData = keyboard.find((b) => b.callback_data.endsWith(":d"))!.callback_data
      expect(denyData).toBe("p:per_9:d")

      // 4. Operator taps Deny → the gateway replies reject to the server exactly once.
      updates.push({ update_id: 2, callback_query: { id: "cq1", from: { id: OPERATOR, is_bot: false }, data: denyData } })
      expect(await waitFor(() => replies.length > 0)).toBe(true)
      expect(replies).toEqual([{ sessionID: "ses_1", permissionID: "per_9", response: "reject" }])
    } finally {
      controller.abort()
      events.close()
      await gateway.catch(() => {})
    }
  })

  test("multiple assistant text parts become separate messages, not one joined blob (defect 4)", async () => {
    const events = eventQueue()
    const updates: unknown[] = []
    const sent: string[] = []
    const edits: string[] = []
    let prompted = false

    const bot = {
      getUpdates: async () => {
        if (updates.length) return updates.splice(0) as never
        await new Promise((r) => setTimeout(r, 15))
        return [] as never
      },
      sendMessage: async (_c: number, text: string) => {
        sent.push(text)
        return { message_id: sent.length, chat: { id: OPERATOR, type: "private" } } as never
      },
      editMessageText: async (_c: number, _m: number, text: string) => void edits.push(text),
      editMessageReplyMarkup: async () => undefined,
      sendChatAction: async () => undefined,
      answerCallbackQuery: async () => undefined,
    } as unknown as BotApi

    const sdk = {
      global: { event: async () => ({ stream: events.iterator() }) },
      session: { create: async () => ({ data: { id: "ses_1" } }), promptAsync: async () => { prompted = true; return { data: {} } } },
      permission: { respond: async () => ({ data: true }) },
    } as unknown as OpencodeClient

    const controller = new AbortController()
    const gateway = runGateway({
      sdk,
      bot,
      allow: new Set([OPERATOR]),
      agent: "telegram-channel",
      dedupFile: path.join(dir, "dedup.json"),
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      timers: { set: (cb, ms) => { const t = setTimeout(cb, ms); return () => clearTimeout(t) } },
      cadenceMs: 0,
      pollTimeoutSec: 1,
      log: () => {},
      signal: controller.signal,
    })

    try {
      // Operator prompts → session ses_1 exists once promptAsync is called.
      updates.push({ update_id: 1, message: { message_id: 1, from: { id: OPERATOR, is_bot: false }, chat: { id: OPERATOR, type: "private" }, text: "go" } })
      expect(await waitFor(() => prompted)).toBe(true)

      // Two distinct assistant text parts on the same assistant message.
      events.push({ payload: { id: "e1", type: "message.part.updated", properties: { sessionID: "ses_1", part: { id: "p1", type: "text", text: "First part", messageID: "m1" } } } })
      events.push({ payload: { id: "e2", type: "message.part.updated", properties: { sessionID: "ses_1", part: { id: "p2", type: "text", text: "Second part", messageID: "m1" } } } })

      // Each part is its own message…
      expect(await waitFor(() => sent.filter((t) => t.includes("First part")).length === 1 && sent.filter((t) => t.includes("Second part")).length === 1)).toBe(true)
      // …and no single message ever concatenates both parts (the old joined-blob bug).
      expect(sent.some((t) => t.includes("First part") && t.includes("Second part"))).toBe(false)
      expect(edits.some((t) => t.includes("First part") && t.includes("Second part"))).toBe(false)
    } finally {
      controller.abort()
      events.close()
      await gateway.catch(() => {})
    }
  })

  // WBS-6.1b PART 3 (AC-019, ADR-0012): mirroring-IN. A bound session's turn originates
  // on web/TUI — no operator Telegram message, so no sessionChat entry. After the server's
  // owns∪bound /global/event filter the frame still arrives; the channel-client lazily
  // creates a streamer, and the gateway renders it into the operator's defaultChatId.
  test("a bound session (no inbound message) mirrors into defaultChatId", async () => {
    const events = eventQueue()
    const sent: Array<{ chatId: number; text: string }> = []

    const bot = {
      getUpdates: async () => {
        await new Promise((r) => setTimeout(r, 15))
        return [] as never
      },
      sendMessage: async (chatId: number, text: string) => {
        sent.push({ chatId, text })
        return { message_id: sent.length, chat: { id: chatId, type: "private" } } as never
      },
      editMessageText: async () => undefined,
      editMessageReplyMarkup: async () => undefined,
      sendChatAction: async () => undefined,
      answerCallbackQuery: async () => undefined,
    } as unknown as BotApi

    const sdk = {
      global: { event: async () => ({ stream: events.iterator() }) },
      session: { create: async () => ({ data: { id: "ses_x" } }), promptAsync: async () => ({ data: {} }) },
      permission: { respond: async () => ({ data: true }) },
    } as unknown as OpencodeClient

    const controller = new AbortController()
    const gateway = runGateway({
      sdk,
      bot,
      allow: new Set([OPERATOR]),
      agent: "telegram-channel",
      defaultChatId: OPERATOR,
      dedupFile: path.join(dir, "dedup.json"),
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      timers: { set: (cb, ms) => { const t = setTimeout(cb, ms); return () => clearTimeout(t) } },
      cadenceMs: 0,
      pollTimeoutSec: 1,
      log: () => {},
      signal: controller.signal,
    })

    try {
      // No operator message — a bound (non-owned) session's assistant text arrives directly.
      events.push({ payload: { id: "e1", type: "message.part.updated", properties: { sessionID: "ses_bound", part: { id: "p1", type: "text", text: "mirrored from web", messageID: "m1" } } } })
      expect(await waitFor(() => sent.some((m) => m.chatId === OPERATOR && m.text.includes("mirrored from web")))).toBe(true)
    } finally {
      controller.abort()
      events.close()
      await gateway.catch(() => {})
    }
  })

  // WBS-6.5c: the composition forwards pollBindings → channel-client, so an operator
  // attach/detach mid-stream re-subscribes the firehose (fresh owns∪bound snapshot). Fast
  // `sleep` caps the client's 45s poll to ~1ms, so the change is picked up immediately. A
  // dropped `pollBindings: deps.pollBindings` wire (or `sleep`) fails this.
  test("a binding change from pollBindings re-subscribes the firehose (attach mid-stream wiring)", async () => {
    let subscribeCount = 0
    const bot = {
      getUpdates: async () => {
        await new Promise((r) => setTimeout(r, 15))
        return [] as never
      },
      sendMessage: async () => ({ message_id: 1, chat: { id: OPERATOR, type: "private" } }) as never,
      editMessageText: async () => undefined,
      editMessageReplyMarkup: async () => undefined,
      sendChatAction: async () => undefined,
      answerCallbackQuery: async () => undefined,
    } as unknown as BotApi

    // A reconnectable SDK: each global.event() hands out a fresh queue that stays OPEN (the
    // pump blocks on it), counting subscribes. Because the stream never drops on its own, the
    // ONLY thing that can re-subscribe is a pollBindings change — so subscribeCount 1→2 proves
    // the wiring, not the reconnect loop.
    const queues: ReturnType<typeof eventQueue>[] = []
    const sdk = {
      global: {
        event: async () => {
          subscribeCount += 1
          const q = eventQueue()
          queues.push(q)
          return { stream: q.iterator() }
        },
      },
      session: { create: async () => ({ data: { id: "ses_1" } }), promptAsync: async () => ({ data: {} }), messages: async () => ({ data: [] }) },
      permission: { respond: async () => ({ data: true }) },
    } as unknown as OpencodeClient

    const controller = new AbortController()
    let bindings = new Set<string>()
    const gateway = runGateway({
      sdk,
      bot,
      allow: new Set([OPERATOR]),
      agent: "telegram-channel",
      pollBindings: async () => new Set(bindings),
      dedupFile: path.join(dir, "dedup.json"),
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 1))), // cap backoff + poll
      timers: { set: (cb, ms) => { const t = setTimeout(cb, ms); return () => clearTimeout(t) } },
      cadenceMs: 0,
      pollTimeoutSec: 1,
      log: () => {},
      signal: controller.signal,
    })

    try {
      // First (only) subscribe; the open stream keeps subscribeCount steady at 1.
      expect(await waitFor(() => subscribeCount === 1)).toBe(true)
      await new Promise((r) => setTimeout(r, 30))
      expect(subscribeCount).toBe(1) // no spurious re-subscribe while bindings are unchanged

      bindings = new Set(["ses_attached"]) // operator attaches mid-stream
      expect(await waitFor(() => subscribeCount === 2)).toBe(true) // poll → re-subscribe (wiring proven)
    } finally {
      controller.abort()
      queues.forEach((q) => q.close())
      await gateway.catch(() => {})
    }
  })

  test("a non-whitelisted /command is refused and creates NO session (deny-by-default)", async () => {
    const events = eventQueue()
    const updates: unknown[] = []
    const sent: string[] = []
    let createCount = 0
    let promptCount = 0

    const bot = {
      getUpdates: async () => {
        if (updates.length) return updates.splice(0) as never
        await new Promise((r) => setTimeout(r, 15))
        return [] as never
      },
      sendMessage: async (_c: number, text: string) => {
        sent.push(text)
        return { message_id: sent.length, chat: { id: OPERATOR, type: "private" } } as never
      },
      editMessageText: async () => undefined,
      editMessageReplyMarkup: async () => undefined,
      sendChatAction: async () => undefined,
      answerCallbackQuery: async () => undefined,
    } as unknown as BotApi

    const sdk = {
      global: { event: async () => ({ stream: events.iterator() }) },
      session: {
        create: async () => {
          createCount += 1
          return { data: { id: `ses_${createCount}` } }
        },
        promptAsync: async () => {
          promptCount += 1
          return { data: {} }
        },
      },
      permission: { respond: async () => ({ data: true }) },
    } as unknown as OpencodeClient

    const controller = new AbortController()
    const gateway = runGateway({
      sdk,
      bot,
      allow: new Set([OPERATOR]),
      agent: "telegram-channel",
      dedupFile: path.join(dir, "dedup.json"),
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      timers: { set: (cb, ms) => { const t = setTimeout(cb, ms); return () => clearTimeout(t) } },
      cadenceMs: 0,
      pollTimeoutSec: 1,
      log: () => {},
      signal: controller.signal,
    })

    try {
      // /shell is not whitelisted → refused, NO session created, agent never prompted.
      updates.push({ update_id: 1, message: { message_id: 1, from: { id: OPERATOR, is_bot: false }, chat: { id: OPERATOR, type: "private" }, text: "/shell rm -rf /" } })
      expect(await waitFor(() => sent.some((t) => t.startsWith("Unknown command")))).toBe(true)
      expect(createCount).toBe(0)
      expect(promptCount).toBe(0)

      // /new is whitelisted → a plain reply, still no prompt to the agent.
      updates.push({ update_id: 2, message: { message_id: 2, from: { id: OPERATOR, is_bot: false }, chat: { id: OPERATOR, type: "private" }, text: "/new" } })
      expect(await waitFor(() => sent.includes("Started a new session."))).toBe(true)
      expect(promptCount).toBe(0)
    } finally {
      controller.abort()
      events.close()
      await gateway.catch(() => {})
    }
  })

  // WBS-6.2 residual (AC-017): outbound files. An assistant FILE part is rendered into the
  // session's chat — image mimes via sendPhoto, everything else via sendDocument, with the
  // filename as the caption. The served-LLM E2E cannot emit assistant file parts (same limit
  // as the permission round trip), so this deterministic faked-SDK tier owns the coverage.
  test("an assistant file part is sent outbound as decoded bytes (image → sendPhotoBytes, other → sendDocumentBytes, filename = caption)", async () => {
    const events = eventQueue()
    const updates: unknown[] = []
    const decode = (b: Uint8Array) => new TextDecoder().decode(b)
    const photos: Array<{ chatId: number; text: string; filename: string; caption?: string }> = []
    const docs: Array<{ chatId: number; text: string; filename: string; caption?: string }> = []
    let prompted = false

    const bot = {
      getUpdates: async () => {
        if (updates.length) return updates.splice(0) as never
        await new Promise((r) => setTimeout(r, 15))
        return [] as never
      },
      sendMessage: async () => ({ message_id: 1, chat: { id: OPERATOR, type: "private" } }) as never,
      editMessageText: async () => undefined,
      editMessageReplyMarkup: async () => undefined,
      sendChatAction: async () => undefined,
      answerCallbackQuery: async () => undefined,
      sendPhotoBytes: async (chatId: number, bytes: Uint8Array, filename: string, caption?: string) => {
        photos.push({ chatId, text: decode(bytes), filename, caption })
        return { message_id: 10, chat: { id: chatId, type: "private" } } as never
      },
      sendDocumentBytes: async (chatId: number, bytes: Uint8Array, filename: string, caption?: string) => {
        docs.push({ chatId, text: decode(bytes), filename, caption })
        return { message_id: 11, chat: { id: chatId, type: "private" } } as never
      },
    } as unknown as BotApi

    const sdk = {
      global: { event: async () => ({ stream: events.iterator() }) },
      session: { create: async () => ({ data: { id: "ses_1" } }), promptAsync: async () => { prompted = true; return { data: {} } } },
      permission: { respond: async () => ({ data: true }) },
    } as unknown as OpencodeClient

    const controller = new AbortController()
    const gateway = runGateway({
      sdk,
      bot,
      allow: new Set([OPERATOR]),
      agent: "telegram-channel",
      dedupFile: path.join(dir, "dedup.json"),
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      timers: { set: (cb, ms) => { const t = setTimeout(cb, ms); return () => clearTimeout(t) } },
      cadenceMs: 0,
      pollTimeoutSec: 1,
      log: () => {},
      signal: controller.signal,
    })

    try {
      // Operator prompts so ses_1 is bound to the operator's chat.
      updates.push({ update_id: 1, message: { message_id: 1, from: { id: OPERATOR, is_bot: false }, chat: { id: OPERATOR, type: "private" }, text: "make me a file" } })
      expect(await waitFor(() => prompted)).toBe(true)

      // The assistant emits a document part and an image part on its message. Real file parts
      // carry `data:<mime>;base64,…` URLs (bytes inline) — the gateway decodes + uploads bytes.
      const docUrl = `data:application/pdf;base64,${Buffer.from("REPORT-PDF-BYTES").toString("base64")}`
      const imgUrl = `data:image/png;base64,${Buffer.from("CHART-PNG-BYTES").toString("base64")}`
      events.push({ payload: { id: "e1", type: "message.part.updated", properties: { sessionID: "ses_1", part: { id: "pf1", type: "file", url: docUrl, mime: "application/pdf", filename: "report.pdf", messageID: "m1" } } } })
      events.push({ payload: { id: "e2", type: "message.part.updated", properties: { sessionID: "ses_1", part: { id: "pf2", type: "file", url: imgUrl, mime: "image/png", filename: "chart.png", messageID: "m1" } } } })

      expect(await waitFor(() => docs.length === 1 && photos.length === 1)).toBe(true)
      expect(docs[0]).toEqual({ chatId: OPERATOR, text: "REPORT-PDF-BYTES", filename: "report.pdf", caption: "report.pdf" })
      expect(photos[0]).toEqual({ chatId: OPERATOR, text: "CHART-PNG-BYTES", filename: "chart.png", caption: "chart.png" })
    } finally {
      controller.abort()
      events.close()
      await gateway.catch(() => {})
    }
  })
})
