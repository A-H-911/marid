import type { OpencodeClient } from "@opencode-ai/sdk/v2"

// The channel-agnostic core of a Marid channel, extracted from the Telegram gateway
// (WBS-6.1, ADR-0011): subscribe to the instance firehose, turn raw events into
// per-session assistant-text streaming + permission asks, and coordinate ONE streamer
// per assistant text part. A channel (Telegram today, WhatsApp in PH-7) supplies only
// the rendering sink (`createStreamer`) and the permission handler (`onAsk`); everything
// here is the transport + event interpretation every channel shares, so channels stop
// re-wiring the SDK (DRY — ADR-0011 consequence).
//
// The exact live event names differ across API generations (message.part.updated /
// session.idle vs session.next.text.delta / .step.ended vs permission.updated /
// permission.asked) — all are in the committed manifest — so dispatch matches a SET of
// type strings and reads fields defensively.
//
// Scope note (WBS-6.1, ADR-0011): reconnect/backoff/SSE-resume is NOT here yet — it is
// WBS-6.5. This owns the pump STRUCTURE (subscribe → loop) so recovery can slot in
// without reshaping the client. The subscription stays on the firehose the gateway
// already used (`global.event`); switching to the ownership-filtered `/event` and
// consuming operator-attached (bound, non-owned) sessions is the mirroring slice
// (WBS-6.1b / ADR-0012), deliberately not folded into this behavior-preserving extract.

const TEXT_EVENTS = new Set(["message.part.updated", "session.next.text.delta"])
const DONE_EVENTS = new Set(["session.idle", "session.next.step.ended"])
const ASK_EVENTS = new Set(["permission.asked", "permission.updated"])

// Normalized from whichever ask event the server emits (permission.asked ∨
// permission.updated — both are in the committed manifest).
export interface PermissionAsk {
  id: string
  sessionID: string
  title?: string
}

// Map a permission-ask event to the fields a channel keyboard needs. Field names are the
// committed v1 PermissionRequest schema (packages/schema/src/v1/permission.ts): `id`
// (the per_ id = reply requestID), `sessionID`, and `permission` (the tool/permission
// name — there is NO `title` field). Pure + exported so the extraction is locked by a
// unit test.
export function parseAskEvent(payload: {
  type: string
  properties?: Record<string, unknown>
}): PermissionAsk | undefined {
  if (!ASK_EVENTS.has(payload.type)) return undefined
  const props = payload.properties ?? {}
  const id = typeof props.id === "string" ? props.id : undefined
  const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined
  if (!id || !sessionID) return undefined
  return { id, sessionID, title: typeof props.permission === "string" ? props.permission : undefined }
}

// A per-part streaming sink the channel provides (Telegram edits, WhatsApp sends, …).
// push() receives the FULL accumulated text each time; finish() force-flushes the final
// text when the turn ends.
export interface Streamer {
  push(fullText: string): Promise<void>
  finish(fullText: string): Promise<void>
}

export interface ChannelClientDeps {
  sdk: OpencodeClient
  signal: AbortSignal
  // One sink per NEW assistant text part in a session (created lazily on the part's
  // first text). The channel resolves which chat/thread the session renders into.
  createStreamer(sessionID: string): Streamer
  // Surface a permission ask on the channel (inline keyboard / reply-token / …).
  onAsk(ask: PermissionAsk): void
}

// A session's live per-turn state: ONE streamer per assistant text part (each distinct
// part is its own channel message, not a joined blob), the accumulated text per part
// (keyed by partID, insertion-ordered), and the set of USER message ids. We stream any
// text part whose message is NOT a user message — excluding user messages (rather than
// including assistant ones) avoids an ordering race: the user's message.updated reliably
// precedes the user's text part, whereas an assistant text part can arrive before its
// message.updated.
interface SessionState {
  streamers: Map<string, Streamer>
  textByPart: Map<string, string>
  userMessages: Set<string>
}

export interface ChannelClient {
  // Start (or restart) tracking a session's next reply with fresh per-part state. The
  // channel calls this right after it prompts, so events for other (untracked) sessions
  // are ignored.
  beginTurn(sessionID: string): void
  // Subscribe to the firehose (AWAIT this before the channel starts polling — the stream
  // is live-only, so a late subscribe drops early events) and return the running pump.
  // Await the returned `done` at shutdown.
  start(): Promise<{ done: Promise<void> }>
}

export function createChannelClient(deps: ChannelClientDeps): ChannelClient {
  const sessions = new Map<string, SessionState>()

  // One streamer per part (lazily created on the part's first text), so each assistant
  // text part streams into its own message.
  function streamerFor(sessionID: string, state: SessionState, partID: string): Streamer {
    const existing = state.streamers.get(partID)
    if (existing) return existing
    const streamer = deps.createStreamer(sessionID)
    state.streamers.set(partID, streamer)
    return streamer
  }

  // Force-flush every part's final text when the turn ends.
  function finishAll(sessionID: string, state: SessionState): void {
    for (const [partID, text] of state.textByPart) {
      if (text) void streamerFor(sessionID, state, partID).finish(text)
    }
  }

  function onEvent(payload: { type: string; properties?: Record<string, unknown> }): void {
    const props = payload.properties ?? {}
    const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined
    const ask = parseAskEvent(payload)
    if (ask) {
      deps.onAsk(ask)
      return
    }
    if (!sessionID) return
    const state = sessions.get(sessionID)
    if (!state) return // not one of our sessions

    // Track user message ids (to exclude the operator's own echoed text), and treat a
    // completed assistant message as a done signal (some generations emit no
    // session.idle).
    if (payload.type === "message.updated") {
      const info = props.info as { id?: string; role?: string; time?: { completed?: number } } | undefined
      if (info?.role === "user" && typeof info.id === "string") state.userMessages.add(info.id)
      if (info?.role === "assistant" && info.time?.completed) finishAll(sessionID, state)
      return
    }

    if (TEXT_EVENTS.has(payload.type)) {
      const part = props.part as { id?: string; type?: string; text?: string; messageID?: string } | undefined
      let partID: string
      if (
        part &&
        part.type === "text" &&
        typeof part.text === "string" &&
        typeof part.id === "string" &&
        typeof part.messageID === "string" &&
        !state.userMessages.has(part.messageID) // never stream the operator's own text back
      ) {
        partID = part.id
        state.textByPart.set(partID, part.text)
      } else if (typeof props.delta === "string") {
        // delta-style event (session.next.text.delta): inherently assistant text
        partID = typeof props.textID === "string" ? props.textID : "delta"
        state.textByPart.set(partID, (state.textByPart.get(partID) ?? "") + props.delta)
      } else {
        return
      }
      const text = state.textByPart.get(partID)!
      if (text) void streamerFor(sessionID, state, partID).push(text) // each part -> its own message
      return
    }

    if (DONE_EVENTS.has(payload.type)) finishAll(sessionID, state)
  }

  return {
    beginTurn(sessionID) {
      sessions.set(sessionID, { streamers: new Map(), textByPart: new Map(), userMessages: new Set() })
    },
    async start() {
      // Subscribe FIRST (the firehose is live-only). Frames are routing-wrapped on
      // /global/event ({ payload: {type,properties} }) but raw on /event; tolerate both
      // by unwrapping payload when present.
      const events = await deps.sdk.global.event({ signal: deps.signal })
      type Frame = {
        type?: string
        properties?: Record<string, unknown>
        payload?: { type: string; properties?: Record<string, unknown> }
      }
      const stream = events.stream as AsyncIterator<Frame>
      const done = (async () => {
        while (!deps.signal.aborted) {
          const next = await stream.next().catch(() => ({ done: true, value: undefined }) as IteratorResult<Frame>)
          if (next.done) break
          const frame = next.value
          const evt = frame?.payload ?? frame
          if (evt && typeof evt.type === "string") onEvent({ type: evt.type, properties: evt.properties })
        }
      })()
      return { done }
    },
  }
}
