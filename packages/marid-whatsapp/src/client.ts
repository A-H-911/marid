// The narrow WhatsApp client interface (ADR-0010 mechanics §1).
//
// This interface exists for ONE reason: to keep the ADR-0014 fake small. It is the
// seam the deterministic PR gate cuts against, so every method here is surface the
// fake must model — which is why it carries the minimum the gateway actually calls and
// nothing WAHA merely offers (136 paths in the real spec; we use 12).
//
// It is ALSO the swap point. ADR-0010 names WAHA-NOWEB-over-WebSocket primary and
// hardened Baileys-direct the documented alternative, to be built only if EXP-006 ever
// fails WAHA (it did not — GATE-0 confirmed every capability on the pinned image). A
// second implementation slots in here without the gateway noticing.
//
// Shapes below are pinned to the REAL contract, not to the ADRs' prose:
// packages/opencode/test/marid/fixtures/waha-openapi.json (WAHA 2026.7.1, NOWEB).

// WAHA's presence vocabulary, verbatim from the pinned WAHASessionPresence enum.
//
// NOTE: ADR-0010 says presence("composing") — that is BAILEYS' term. WAHA normalizes it
// to "typing" over its REST API. Coding to the ADR's prose would have 422'd on the first
// real call; the fixture caught it. (Recorded for WBS-7.6 docs reconcile.)
export type Presence = "typing" | "paused"

export interface InboundMessage {
  // WAHA message id, e.g. "false_11111111111@c.us_AAAA...". Opaque and unordered —
  // dedup keys on it as a set member, never as a watermark (see dedup.ts).
  id: string
  // Sender/chat JID, e.g. "11111111111@c.us".
  from: string
  // Text body. Empty string for a media-only message.
  body: string
  fromMe: boolean
  hasMedia: boolean
  media?: InboundMedia
}

export interface InboundMedia {
  // WAHA serves the bytes from its own host, e.g. http://waha:3000/api/files/...
  // Fetched through downloadMedia() so the API key stays in one place.
  url: string
  mimetype: string
  filename?: string
}

export interface OutboundMedia {
  bytes: Uint8Array
  mimetype: string
  filename?: string
  caption?: string
}

// GET /api/version -> WAHAEnvironment. Used for the boot disclosure and, in the fake
// harness, to assert the tier/engine at RUNTIME rather than trusting a doc citation
// that can rot (WAHA collapsed Plus into Core on 2026-06-21 and the planning docs never
// noticed — a wire assertion cannot make that mistake).
export interface WahaEnvironment {
  version: string
  engine: string
  tier: string
}

export interface WhatsAppClient {
  // Opens the outbound WebSocket and blocks until it is live. OQ-004: Marid dials OUT;
  // no inbound port is ever opened (WAHA's webhook mode is the rejected alternative).
  connect(): Promise<void>
  // Registers the inbound sink. Call before connect() so no frame is missed.
  onMessage(cb: (m: InboundMessage) => void): void
  sendText(jid: string, text: string): Promise<{ id: string }>
  // Edit-coalescing for streaming-sim. WhatsApp caps edits at ~15 min and each edit is a
  // real protocol message — throttle, never per-token (ADR-0010 §2).
  editText(jid: string, messageId: string, text: string): Promise<void>
  sendMedia(jid: string, media: OutboundMedia): Promise<void>
  setPresence(jid: string, presence: Presence): Promise<void>
  downloadMedia(media: InboundMedia): Promise<Uint8Array>
  environment(): Promise<WahaEnvironment>
  close(): Promise<void>
}
