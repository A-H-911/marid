// EXP-005 spike (throwaway) — proves the Telegram remediation (ADR-0009, HYP-005)
// is a FIX-IN-PLACE, not a fork: the four deterministic UX defects are fixed by ~1
// dependency + small wiring on the EXISTING hand-rolled gateway, and the SSE pump
// survives a drop. Composes the real modules (resolveDownloadUrl, redact) +
// telegramify-markdown; the "fix" functions here are the SHAPE the production wiring
// takes (WBS-6.2), kept minimal — not production code.
//
// Out of scope here (needs a real bot token + network): the streaming cadence / no-429
// tail. That is the EXP-005 LIVE tail, run against a throwaway BotFather bot, mirroring
// how EXP-003 measured cadence live. Everything below is deterministic + offline.

import { describe, expect, test } from "bun:test"
import telegramify from "telegramify-markdown"
import { createBotApi } from "../src/bot-api"
import { resolveDownloadUrl } from "../src/media"
import { redact } from "../src/redact"
import type { FilePartInput } from "@opencode-ai/sdk/v2"
import type { TgMessage } from "../src/telegram"

const msg = (extra: Partial<TgMessage>): TgMessage => ({ message_id: 1, chat: { id: 5, type: "private" }, ...extra })

// ── Defect 1: Markdown was sent as HTML-escaped plain text; render it as MarkdownV2 ──
// Fix shape: run assistant text through telegramify-markdown; keep the existing
// 400 -> plain-text fallback for any frame Telegram rejects (partial fences mid-stream).
const toMarkdownV2 = (text: string): string | undefined => {
  try {
    return telegramify(text, "escape")
  } catch {
    return undefined // caller falls back to plain text (existing behavior)
  }
}

describe("EXP-005 · defect 1 — Markdown renders as MarkdownV2 (one dep, with fallback)", () => {
  test("bold/inline-code/list convert to MarkdownV2 markup", () => {
    const out = toMarkdownV2("Here is **bold**, `code`:\n- one\n- two")
    expect(out).toBeDefined()
    expect(out).toContain("*bold*") // MarkdownV2 bold (single asterisks)
    expect(out).toContain("`code`") // inline code preserved
    expect(out).toContain("•") // list bulletized
    expect(out).not.toContain("**bold**") // the raw Markdown is gone
  })
  test("fenced code block is preserved for Telegram code rendering", () => {
    const out = toMarkdownV2("```js\nconst x = 1\n```")
    expect(out).toContain("```")
    expect(out).toContain("const x = 1")
  })
})

// ── Defect 2: inbound files never landed (inboundNote only wrote a text note) ──
// Fix shape: wire the EXISTING resolveDownloadUrl -> an SDK FilePartInput so the file
// actually reaches the workspace, and redact the token-bearing URL from any log (INV-002).
const inboundFilePart = async (
  message: TgMessage,
  bot: { getFile: Parameters<typeof resolveDownloadUrl>[0]["getFile"]; fileDownloadUrl: Parameters<typeof resolveDownloadUrl>[0]["fileDownloadUrl"] },
): Promise<FilePartInput | undefined> => {
  const fileId = message.document?.file_id
  if (!fileId) return undefined
  const url = await resolveDownloadUrl(bot as never, fileId)
  if (!url) return undefined
  return { type: "file", mime: message.document?.mime_type ?? "application/octet-stream", filename: message.document?.file_name, url }
}

describe("EXP-005 · defect 2 — inbound file lands via resolveDownloadUrl -> FilePartInput", () => {
  const TOKEN = "123:AAsecretTokenValue"
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ ok: true, result: { file_id: "f", file_path: "documents/report.pdf" } }))) as unknown as typeof fetch
  const bot = createBotApi({ token: TOKEN, baseUrl: "https://api.telegram.org", fetch: fetchImpl })

  test("a document message becomes a FilePartInput carrying the resolved download URL", async () => {
    const part = await inboundFilePart(msg({ document: { file_id: "f", file_unique_id: "u", file_name: "report.pdf", mime_type: "application/pdf" } }), bot)
    expect(part?.type).toBe("file")
    expect(part?.mime).toBe("application/pdf")
    expect(part?.filename).toBe("report.pdf")
    expect(part?.url).toContain("report.pdf") // the real download URL was built (was previously discarded)
  })
  test("the token-bearing URL is redactable before it can hit a log (INV-002)", async () => {
    const part = await inboundFilePart(msg({ document: { file_id: "f", file_unique_id: "u", file_name: "report.pdf" } }), bot)
    expect(part!.url).toContain(TOKEN) // the raw URL embeds the token...
    expect(redact(part!.url, TOKEN)).not.toContain(TOKEN) // ...and redact() masks it
  })
  test("a plain-text message yields no file part", async () => {
    expect(await inboundFilePart(msg({ text: "hi" }), bot)).toBeUndefined()
  })
})

// ── Defect 3: slash commands were not routed (a /command was prompted as text) ──
// Fix shape: a deny-by-default whitelist. A whitelisted command routes to its handler;
// a non-whitelisted /command is refused (never silently prompted); plain text prompts.
type Routed = { kind: "command"; name: string } | { kind: "prompt"; text: string } | { kind: "rejected" }
const routeSlash = (text: string, whitelist: ReadonlySet<string>): Routed => {
  if (!text.startsWith("/")) return { kind: "prompt", text }
  const name = text.slice(1).split(/\s/)[0]!.toLowerCase()
  return whitelist.has(name) ? { kind: "command", name } : { kind: "rejected" }
}

describe("EXP-005 · defect 3 — slash commands route against a deny-by-default whitelist", () => {
  const whitelist = new Set(["help", "new", "status"])
  test("a whitelisted command routes to its handler", () => {
    expect(routeSlash("/help", whitelist)).toEqual({ kind: "command", name: "help" })
  })
  test("a non-whitelisted /command is rejected, never prompted as text", () => {
    expect(routeSlash("/shell rm -rf /", whitelist)).toEqual({ kind: "rejected" })
  })
  test("plain text is prompted normally", () => {
    expect(routeSlash("what is 2+2", whitelist)).toEqual({ kind: "prompt", text: "what is 2+2" })
  })
})

// ── Defect 4: multi-part replies were concatenated into one message ──
// Fix shape: emit each distinct assistant part as its own message (insertion-ordered),
// instead of joining every part into one blob (gateway.ts currentText today).
const separateParts = (textByPart: Map<string, string>): string[] => [...textByPart.values()].filter((t) => t.length > 0)

describe("EXP-005 · defect 4 — multi-part replies are separated, not concatenated", () => {
  test("two logical parts become two messages", () => {
    const parts = new Map([
      ["p1", "First, the plan."],
      ["p2", "Then, the code."],
    ])
    const out = separateParts(parts)
    expect(out).toEqual(["First, the plan.", "Then, the code."])
    expect(out.join("")).not.toBe(out[0]) // distinct messages, not one blob
  })
})

// ── Defect 5: an SSE firehose drop stalled the gateway permanently (deferred #8) ──
// Fix shape: on stream end while NOT aborted, resubscribe + re-fetch authoritative
// state and continue. Proven here: an injected drop recovers rather than stalling.
async function resilientPump(deps: {
  subscribe: () => AsyncIterator<{ type: string }>
  refetch: () => Promise<void>
  aborted: () => boolean
  onEvent: (e: { type: string }) => void
  maxReconnects: number
}): Promise<{ reconnects: number }> {
  let reconnects = 0
  while (!deps.aborted()) {
    const stream = deps.subscribe()
    for (;;) {
      const next = await stream.next().catch(() => ({ done: true, value: undefined }) as IteratorResult<{ type: string }>)
      if (next.done) break // the firehose dropped
      deps.onEvent(next.value)
    }
    if (deps.aborted() || reconnects >= deps.maxReconnects) break
    reconnects++
    await deps.refetch() // authoritative re-fetch on reconnect (contract v1.1)
  }
  return { reconnects }
}

describe("EXP-005 · defect 5 — the SSE pump reconnects + re-fetches after a drop (no stall)", () => {
  test("an injected stream drop triggers reconnect + re-fetch, then resumes", async () => {
    const seen: string[] = []
    let refetched = 0
    let round = 0
    // Round 0 drops after one event; round 1 delivers the recovered event then aborts.
    const subscribe = (): AsyncIterator<{ type: string }> => {
      const events = round++ === 0 ? [{ type: "message.part.updated" }] : [{ type: "session.idle" }]
      let i = 0
      return { next: async () => (i < events.length ? { done: false, value: events[i++]! } : { done: true, value: undefined }) }
    }
    let done = false
    const result = await resilientPump({
      subscribe,
      refetch: async () => { refetched++ },
      aborted: () => done,
      onEvent: (e) => { seen.push(e.type); if (e.type === "session.idle") done = true },
      maxReconnects: 3,
    })
    expect(result.reconnects).toBe(1) // recovered exactly once from the drop
    expect(refetched).toBe(1) // authoritative re-fetch happened on reconnect
    expect(seen).toEqual(["message.part.updated", "session.idle"]) // no event lost, no permanent stall
  })
})

// ── INV-001 note (not re-tested here) ──
// The spike changes only presentation/wiring in the channel process; acting stays
// server-enforced by @marid/gateway (channel scope deny-by-default, bound-agent guard).
// That boundary is covered by the existing channel-binding + scope suites and EXP-008
// (act-via-ownership). Nothing here widens the channel token's authority.
