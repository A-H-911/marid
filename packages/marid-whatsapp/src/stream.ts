import type { Presence, WhatsAppClient } from "./client"

// Streaming simulation for one assistant reply (WBS-7.3, AC-018, ADR-0010 §2).
//
// WhatsApp has no token streaming and its editing is more constrained than Telegram's:
// edits are capped at ~15 min, each edit is a real protocol message, and hammering them
// invites the ban heuristics (RISK-013). So the shape is:
//
//   presence("typing") while generating  ->  send the FIRST chunk once there is text
//   ->  coalesce later growth into at most one edit per cadence window  ->  finish()
//   force-flushes the final text  ->  presence("paused").
//
// This is deliberately SIMPLER than the Telegram streamer: no MarkdownV2 (WhatsApp uses
// a lightweight *_~ syntax that needs no escaping pass), and — ponytail — no 4096-style
// multi-message split. WhatsApp's text cap is ~65k chars, far above any real reply, so
// one message per part is fine; if a reply ever exceeds it, WAHA errors and the gateway
// logs it. Upgrade path: chunk at a headroom limit, same as the Telegram split.
//
// Cadence is driven by an injected now()/sleep so it is unit-tested deterministically.

const DEFAULT_CADENCE_MS = 2500

export interface WaStreamerDeps {
  client: Pick<WhatsAppClient, "sendText" | "editText" | "setPresence">
  jid: string
  now(): number
  cadenceMs?: number
  log?: (line: string) => void
}

export interface Streamer {
  push(fullText: string): Promise<void>
  finish(fullText: string): Promise<void>
}

export function createStreamer(deps: WaStreamerDeps): Streamer {
  const cadenceMs = deps.cadenceMs ?? DEFAULT_CADENCE_MS
  let messageId: string | undefined
  let sentText = ""
  let lastEditAt = -Infinity
  let presenceSent = false

  const setPresence = (p: Presence) =>
    deps.client.setPresence(deps.jid, p).catch((e: unknown) => deps.log?.(`presence ${p} failed: ${String(e)}`))

  async function reconcile(fullText: string, force: boolean): Promise<void> {
    const text = fullText.trimEnd()
    if (!text) return

    // First real text: signal typing once, then send the opening message. Everything
    // after is an edit of that one message (per assistant part) — the streaming illusion.
    if (messageId === undefined) {
      if (!presenceSent) {
        presenceSent = true
        await setPresence("typing")
      }
      const sent = await deps.client
        .sendText(deps.jid, text)
        .catch((e: unknown) => (deps.log?.(`sendText failed: ${String(e)}`), undefined))
      if (sent) {
        messageId = sent.id
        sentText = text
        lastEditAt = deps.now()
      }
      return
    }

    if (text === sentText) return // unchanged — never edit to the same value (wasted call + ban surface)
    // Throttle: at most one edit per cadence window, UNLESS this is the final flush.
    if (!force && deps.now() - lastEditAt < cadenceMs) return

    await deps.client.editText(deps.jid, messageId, text).catch((e: unknown) => deps.log?.(`editText failed: ${String(e)}`))
    sentText = text
    lastEditAt = deps.now()
  }

  return {
    push: (fullText) => reconcile(fullText, false),
    async finish(fullText) {
      await reconcile(fullText, true)
      // Stop the typing indicator once the turn is done, best-effort.
      if (presenceSent) await setPresence("paused")
    },
  }
}
