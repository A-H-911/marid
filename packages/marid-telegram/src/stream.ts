import type { BotApi, SendOptions } from "./bot-api"
import { TelegramError } from "./bot-api"
import { escapeHtml, splitMessage } from "./format"

// Streaming simulation for one assistant reply (WBS-4.2, AC-011, EXP-003).
//
// The gateway feeds the full accumulated assistant text on each push(); the streamer
// sends the first chunk, then coalesces edits to at most one per cadence window
// (default 2.5s — EXP-003's 2-3s, comfortably ≥1s) and skips unchanged edits. As the
// text grows past 4096 chars it opens additional messages (the split). finish()
// force-flushes so the final Telegram state is the complete reply regardless of
// cadence. A 429 honors retry_after; a 400 parse error falls back to plain text.
//
// Cadence is driven by an injected now()/sleep so it is unit-tested deterministically.

const DEFAULT_CADENCE_MS = 2500

export interface StreamerDeps {
  bot: Pick<BotApi, "sendMessage" | "editMessageText" | "sendChatAction">
  chatId: number
  now(): number
  sleep(ms: number): Promise<void>
  cadenceMs?: number
  limit?: number
  log?: (line: string) => void
}

export interface Streamer {
  push(fullText: string): Promise<void>
  finish(fullText: string): Promise<void>
}

interface SentPart {
  messageId: number
  sentText: string
}

export function createStreamer(deps: StreamerDeps): Streamer {
  const cadenceMs = deps.cadenceMs ?? DEFAULT_CADENCE_MS
  const limit = deps.limit ?? 4096
  const parts: SentPart[] = []
  let lastEditAt = -Infinity
  let typingSent = false

  // Retry once on 429 honoring retry_after (research §2); surface everything else.
  async function withRetry<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op()
    } catch (e) {
      if (e instanceof TelegramError && e.code === 429 && e.retryAfter !== undefined) {
        await deps.sleep(e.retryAfter * 1000)
        return op()
      }
      throw e
    }
  }

  const htmlOpts: SendOptions = { parse_mode: "HTML" }

  async function sendChunk(text: string): Promise<number | undefined> {
    try {
      const msg = await withRetry(() => deps.bot.sendMessage(deps.chatId, text, htmlOpts))
      return msg.message_id
    } catch (e) {
      if (e instanceof TelegramError && e.code === 400) {
        // Parse error → resend as plain text (no parse_mode).
        const msg = await withRetry(() => deps.bot.sendMessage(deps.chatId, text)).catch(() => undefined)
        return msg?.message_id
      }
      deps.log?.(`sendMessage failed: ${e instanceof Error ? e.message : String(e)}`)
      return undefined
    }
  }

  async function editChunk(messageId: number, text: string): Promise<void> {
    try {
      await withRetry(() => deps.bot.editMessageText(deps.chatId, messageId, text, htmlOpts))
    } catch (e) {
      if (e instanceof TelegramError && e.code === 400) {
        // "message is not modified" is benign; any other 400 is a parse error → plain text.
        if (/not modified/i.test(e.message)) return
        await withRetry(() => deps.bot.editMessageText(deps.chatId, messageId, text)).catch(() => {})
        return
      }
      deps.log?.(`editMessageText failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Reconcile Telegram messages with the current chunks. New chunks are always sent
  // immediately (new content). Existing chunks are edited only when their text
  // changed AND (the cadence window elapsed OR force). Returns whether an edit fired.
  async function reconcile(fullText: string, force: boolean): Promise<void> {
    if (!typingSent) {
      typingSent = true
      await deps.bot.sendChatAction(deps.chatId, "typing").catch(() => {})
    }
    const chunks = splitMessage(escapeHtml(fullText), limit)
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!
      const existing = parts[i]
      if (!existing) {
        const messageId = await sendChunk(chunk)
        if (messageId !== undefined) parts.push({ messageId, sentText: chunk })
        lastEditAt = deps.now()
        continue
      }
      if (existing.sentText === chunk) continue // unchanged — skip (avoids 400 not-modified)
      if (!force && deps.now() - lastEditAt < cadenceMs) continue // throttle
      await editChunk(existing.messageId, chunk)
      existing.sentText = chunk
      lastEditAt = deps.now()
    }
  }

  return {
    push: (fullText) => reconcile(fullText, false),
    finish: (fullText) => reconcile(fullText, true),
  }
}
