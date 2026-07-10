import type { BotApi } from "./bot-api"
import { TelegramError } from "./bot-api"
import { splitMessage, toMarkdownV2 } from "./format"

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

  // Send `rendered` in MarkdownV2 (or plain if telegramify declined). On a 400 parse
  // error resend the un-escaped `plain` chunk with no parse_mode — clean text, never
  // the escaped MarkdownV2 with visible backslashes.
  async function sendChunk(rendered: string, plain: string, mode?: "MarkdownV2"): Promise<number | undefined> {
    try {
      const msg = await withRetry(() => deps.bot.sendMessage(deps.chatId, rendered, mode ? { parse_mode: mode } : undefined))
      return msg.message_id
    } catch (e) {
      if (e instanceof TelegramError && e.code === 400) {
        const msg = await withRetry(() => deps.bot.sendMessage(deps.chatId, plain)).catch(() => undefined)
        return msg?.message_id
      }
      deps.log?.(`sendMessage failed: ${e instanceof Error ? e.message : String(e)}`)
      return undefined
    }
  }

  async function editChunk(messageId: number, rendered: string, plain: string, mode?: "MarkdownV2"): Promise<void> {
    try {
      await withRetry(() => deps.bot.editMessageText(deps.chatId, messageId, rendered, mode ? { parse_mode: mode } : undefined))
    } catch (e) {
      if (e instanceof TelegramError && e.code === 400) {
        // "message is not modified" is benign; any other 400 is a parse error → plain text.
        if (/not modified/i.test(e.message)) return
        await withRetry(() => deps.bot.editMessageText(deps.chatId, messageId, plain)).catch(() => {})
        return
      }
      deps.log?.(`editMessageText failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Reconcile Telegram messages with the current chunks. Split the PLAIN text on line
  // boundaries, then render each chunk to MarkdownV2 individually (a fence never
  // straddles a chunk boundary this way). New chunks send immediately; existing chunks
  // are edited only when their rendered text changed AND (cadence elapsed OR force).
  // ponytail: MarkdownV2 escaping expands length, so a full 4096 plain chunk can exceed
  // 4096 once escaped → Telegram 400 → the plain-chunk fallback (which fits) sends. Rare
  // (only >4096 replies); if it ever matters, split at a headroom limit below 4096.
  async function reconcile(fullText: string, force: boolean): Promise<void> {
    if (!typingSent) {
      typingSent = true
      await deps.bot.sendChatAction(deps.chatId, "typing").catch(() => {})
    }
    const chunks = splitMessage(fullText, limit)
    for (let i = 0; i < chunks.length; i++) {
      const plain = chunks[i]!
      const md = toMarkdownV2(plain)
      const rendered = md ?? plain
      const mode = md !== undefined ? ("MarkdownV2" as const) : undefined
      const existing = parts[i]
      if (!existing) {
        const messageId = await sendChunk(rendered, plain, mode)
        if (messageId !== undefined) parts.push({ messageId, sentText: rendered })
        lastEditAt = deps.now()
        continue
      }
      if (existing.sentText === rendered) continue // unchanged — skip (avoids 400 not-modified)
      if (!force && deps.now() - lastEditAt < cadenceMs) continue // throttle
      await editChunk(existing.messageId, rendered, plain, mode)
      existing.sentText = rendered
      lastEditAt = deps.now()
    }
  }

  return {
    push: (fullText) => reconcile(fullText, false),
    finish: (fullText) => reconcile(fullText, true),
  }
}
