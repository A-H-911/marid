import fs from "node:fs/promises"
import path from "node:path"
import { normalizeJid } from "./allowlist"

// Inbound replay protection (FR-051, AC-018).
//
// This is where WhatsApp genuinely DIVERGES from Telegram, so it is deliberately not a
// port of marid-telegram/dedup.ts. Telegram long-polls: `update_id` both dedups AND
// doubles as the resume offset, so a single "highest seen id" number does both jobs.
//
// WAHA has neither. Events arrive on a WebSocket that Marid dials out to (the only
// OQ-004-compatible mode — no inbound port), message ids are opaque strings like
// `false_11111111111@c.us_AAAA...`, and there is NO offset to resume from: a dropped
// socket loses the gap by design. Recovery is the channel-client's job (reconnect +
// re-fetch of authoritative state), not this store's.
//
// So dedup here is exactly one job: has this message id been processed before? That is
// a SET, not a watermark — ids are unordered, so "id <= last" is meaningless.
//
// ponytail: bounded FIFO set, persisted whole. One operator, human-paced traffic, so
// MAX_SEEN ids is a few KB and rewriting the file per message is free at this volume.
// If throughput ever matters, batch the flush or move to an append-only log.

const MAX_SEEN = 500

export interface Dedup {
  seen(messageId: string): Promise<boolean>
  commit(messageId: string): Promise<void>
  size(): Promise<number>
}

interface State {
  seen?: unknown
}

// JSON.parse throws on a torn write. The style guide bans try/catch, so isolate the
// sync throw inside a promise chain and .catch() it into `undefined`.
function parseSeen(text: string): Promise<unknown> {
  return Promise.resolve()
    .then(() => (JSON.parse(text) as State).seen)
    .catch(() => undefined)
}

export function createDedup(stateFile: string): Dedup {
  // Cached in memory; the file is the crash-durable copy. Single-threaded event loop,
  // one message at a time, so no locking (same reasoning as the Telegram store).
  let cache: string[] | undefined

  const read = async (): Promise<string[]> => {
    if (cache) return cache
    const text = await fs.readFile(stateFile, "utf8").catch(() => "")
    if (!text) return (cache = [])
    // A torn write (crash mid-flush) leaves invalid JSON. Degrade to empty rather than
    // throw: a corrupt dedup file must never stop the gateway from booting. The cost of
    // being wrong here is at-least-once redelivery, which the design already tolerates.
    const value = await parseSeen(text)
    cache = Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
    return cache
  }

  return {
    async seen(messageId) {
      return (await read()).includes(messageId)
    },
    // Called AFTER the message's side effects succeed (at-least-once): a crash between
    // acting and committing redelivers, which is safer than dropping the operator's
    // message. WhatsApp itself may also redeliver on reconnect — same path.
    async commit(messageId) {
      const ids = await read()
      if (ids.includes(messageId)) return
      ids.push(messageId)
      if (ids.length > MAX_SEEN) ids.splice(0, ids.length - MAX_SEEN) // FIFO evict
      await fs.mkdir(path.dirname(stateFile), { recursive: true })
      // 0600: the id set reveals who messaged the operator and when (INV-002 posture —
      // not a secret, but not world-readable either).
      await fs.writeFile(stateFile, JSON.stringify({ seen: ids }), { mode: 0o600 })
    },
    async size() {
      return (await read()).length
    },
  }
}

// A WAHA message id embeds the chat, so two chats can never collide on an id; the JID
// is normalized for the same reason as the allowlist (engines differ on casing).
export function dedupKey(jid: string, messageId: string): string {
  return `${normalizeJid(jid)}#${messageId}`
}
