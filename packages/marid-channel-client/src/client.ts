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
// Recovery (WBS-6.5, FR-036/043, RISK-006): the pump reconnects a dropped firehose with
// capped backoff; on each reconnect it re-fetches authoritative state for OWNED sessions
// (a turn that finished during the gap is recovered) and re-subscribes — the server
// re-reads owns∪bound FRESH per subscribe (marid-auth middleware), so a re-subscribe also
// picks up a mid-stream operator attach/detach. A BOUND (non-owned) session is NEVER
// re-fetched: its history route is owns-gated (403, INV-001 / EXP-008) — it resumes live
// only, with gap frames lost. The firehose is live-only (no ?after= replay, contract v1.1),
// so re-reading the durable event-sourced store is the only recovery. Optional `pollBindings`
// (the channel token's OWN bound-session set) drives the attach-triggered re-subscribe; a
// channel without cross-process attach omits it.

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
  // WBS-6.5c: the channel token's OWN bound-session set (from the server's admin-free
  // self-bindings route). Polled so an operator attach/detach that lands while the stream
  // is healthy triggers a re-subscribe (the re-subscribe re-reads owns∪bound fresh).
  // Optional — a channel/test without cross-process attach omits it (no poll).
  pollBindings?: () => Promise<Set<string>>
  // Abortable sleep for backoff + poll cadence. Defaults to a setTimeout that resolves
  // early on `signal`. Tests inject an instant sleep.
  sleep?: (ms: number) => Promise<void>
  // Binding-poll cadence (ms). Default 45s — sub-minute mirror-start latency for an
  // operator attach is acceptable; a shorter poll just churns the self-bindings route.
  bindingPollMs?: number
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
  // OWNED (beginTurn — the channel created/prompted it) vs BOUND (lazily tracked from a
  // mirrored-in frame). Only owned sessions are safe to re-fetch on reconnect: a bound
  // session's history route is owns-gated (403, INV-001). See start()'s refetchOwned.
  owned: boolean
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
    let state = sessions.get(sessionID)
    if (!state) {
      // Mirroring-IN (WBS-6.1b, ADR-0012): after the server's owns∪bound /global/event
      // filter (marid-auth middleware), any frame for a session the channel never called
      // beginTurn on is by construction an operator-ATTACHED (bound, non-owned) session
      // whose turn originated on web/TUI. Lazily create tracking so it gets a streamer and
      // mirrors into the channel. The client keeps NO binding copy — it trusts the
      // server-side filter (a channel token only ever receives owns∪bound frames).
      // ponytail: state maps grow across a long-lived bound session's turns (no beginTurn
      // reset); bounded cleanup is future work, not needed for MVP correctness (each turn's
      // parts still render to their own messages). owned=false → never re-fetched (INV-001).
      state = { streamers: new Map(), textByPart: new Map(), userMessages: new Set(), owned: false }
      sessions.set(sessionID, state)
    }

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

  // --- WBS-6.5 recovery machinery ---------------------------------------------------

  type Frame = {
    type?: string
    properties?: Record<string, unknown>
    payload?: { type: string; properties?: Record<string, unknown> }
  }

  const BACKOFF_BASE_MS = 500
  const BACKOFF_CAP_MS = 30_000
  // ponytail: plain capped exponential backoff (no jitter). A single-operator gateway does
  // not thunder; add jitter if many channels ever reconnect against one instance at once.
  const backoffMs = (attempt: number): number =>
    attempt <= 0 ? 0 : Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1))

  const rawSleep = deps.sleep ?? ((ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)))
  // ALWAYS race the sleep against shutdown, so a long backoff/poll interval can't park the
  // loop past an abort. Do not trust the injected sleep to be abort-aware — the gateway's
  // isn't (marid-telegram.ts); without this, `done` hangs up to bindingPollMs on SIGINT.
  const sleep = (ms: number): Promise<void> => {
    if (ms <= 0 || deps.signal.aborted) return Promise.resolve()
    return Promise.race([
      rawSleep(ms),
      new Promise<void>((resolve) => deps.signal.addEventListener("abort", () => resolve(), { once: true })),
    ])
  }

  // A per-connection controller that also aborts when the client shuts down, so a pump
  // ends on EITHER a shutdown or a deliberate re-subscribe (poll-triggered).
  function connectionController(): AbortController {
    const controller = new AbortController()
    if (deps.signal.aborted) controller.abort()
    else deps.signal.addEventListener("abort", () => controller.abort(), { once: true })
    return controller
  }

  // Subscribe once, retrying the connect itself (the server may not be up yet — the first
  // subscribe is now recoverable because the channel router only starts after start()).
  // Returns undefined only on shutdown/re-subscribe abort.
  async function subscribeWithRetry(connSignal: AbortSignal): Promise<AsyncIterator<Frame> | undefined> {
    let attempt = 0
    while (!deps.signal.aborted && !connSignal.aborted) {
      const stream = await deps.sdk.global
        .event({ signal: connSignal })
        .then((events) => events.stream as AsyncIterator<Frame>)
        .catch(() => undefined)
      if (stream) return stream
      await sleep(backoffMs(++attempt))
    }
    return undefined
  }

  // Drain one subscription until its stream ends (server drop, or connSignal abort for a
  // deliberate re-subscribe). Returns whether any frame was delivered (drives backoff reset
  // so a flapping connection still backs off).
  async function pump(stream: AsyncIterator<Frame>, connSignal: AbortSignal): Promise<boolean> {
    // Resolves the instant the connection is aborted, so a re-subscribe (or shutdown) never
    // waits on a stream that doesn't promptly end on abort — raced against each next().
    const aborted = new Promise<IteratorResult<Frame>>((resolve) => {
      const stop = () => resolve({ done: true, value: undefined })
      if (connSignal.aborted) stop()
      else connSignal.addEventListener("abort", stop, { once: true })
    })
    let delivered = false
    while (!connSignal.aborted && !deps.signal.aborted) {
      const next = await Promise.race([
        stream.next().catch(() => ({ done: true, value: undefined }) as IteratorResult<Frame>),
        aborted,
      ])
      if (next.done) break
      delivered = true
      const evt = next.value?.payload ?? next.value
      if (evt && typeof evt.type === "string") onEvent({ type: evt.type, properties: evt.properties })
    }
    await stream.return?.(undefined).catch(() => {})
    return delivered
  }

  // Recovery: re-read the durable store for OWNED sessions and flush the latest assistant
  // message's text edit-in-place (same partID → same channel message; identical text is
  // skipped so a no-gap reconnect makes no redundant edit). Bound sessions are owns-gated
  // (403) — skipped (INV-001); they resume live only.
  //
  // Keying is aligned by construction: on Marid (the v1 chain — the v2/next
  // session.next.text.* family is not built, per keep-remove) live assistant text renders
  // via `message.part.updated` keyed by the real `part.id`, which is the same id
  // session.messages returns here — so a turn finished during the gap renders once and a
  // partial turn edits in place. `session.messages` is called with no limit → the full
  // history, so the latest assistant is never off a page.
  async function refetchOwned(): Promise<void> {
    for (const [sessionID, state] of sessions) {
      if (!state.owned) continue
      const messages = await deps.sdk.session
        .messages({ sessionID })
        .then((res) => res.data as Array<{ info?: { role?: string }; parts?: Array<{ id?: string; type?: string; text?: string }> }>)
        .catch(() => undefined)
      if (!messages) continue
      const lastAssistant = [...messages].reverse().find((m) => m.info?.role === "assistant")
      if (!lastAssistant?.parts) continue
      for (const part of lastAssistant.parts) {
        if (part.type !== "text" || typeof part.text !== "string" || !part.text || typeof part.id !== "string") continue
        if (state.textByPart.get(part.id) === part.text) continue // already rendered — no redundant edit
        state.textByPart.set(part.id, part.text)
        void streamerFor(sessionID, state, part.id).push(part.text)
      }
    }
  }

  // Poll the channel token's own bindings; a changed set (attach OR detach) forces the
  // current connection to re-subscribe so the server re-applies owns∪bound fresh.
  function startBindingPoll(requestReconnect: () => void): Promise<void> {
    if (!deps.pollBindings) return Promise.resolve()
    const sameSet = (a: Set<string>, b: Set<string>): boolean => a.size === b.size && [...a].every((v) => b.has(v))
    return (async () => {
      let previous: Set<string> | undefined
      while (!deps.signal.aborted) {
        await sleep(deps.bindingPollMs ?? 45_000)
        if (deps.signal.aborted) break
        const current = await deps.pollBindings!().catch(() => undefined)
        if (!current) continue
        if (previous && !sameSet(previous, current)) requestReconnect()
        previous = current
      }
    })()
  }

  return {
    beginTurn(sessionID) {
      sessions.set(sessionID, { streamers: new Map(), textByPart: new Map(), userMessages: new Set(), owned: true })
    },
    async start() {
      // Subscribe FIRST and AWAIT it before returning (the firehose is live-only and the
      // channel router starts only after start() resolves, so early frames aren't missed).
      // Each cycle uses its OWN controller (linked to shutdown) for BOTH subscribe and pump,
      // so a poll-triggered abort tears the fetch down cleanly (no double-delivery) and the
      // next cycle re-subscribes with a fresh owns∪bound snapshot.
      let connection = connectionController()
      let stream = await subscribeWithRetry(connection.signal)
      // A poll-triggered re-subscribe is INTENTIONAL (an attach/detach, not a failure): the
      // flag lets the loop skip both the backoff penalty (so the attach mirrors instantly)
      // and the recovery re-fetch (no frames were lost). The poll reads `connection` at call
      // time; reassigning it below re-targets the trigger.
      let reconnectRequested = false
      const pollDone = startBindingPoll(() => {
        reconnectRequested = true
        connection.abort()
      })

      const done = (async () => {
        let attempt = 0
        while (!deps.signal.aborted) {
          if (stream) {
            const delivered = await pump(stream, connection.signal)
            if (deps.signal.aborted) break
            if (reconnectRequested) {
              reconnectRequested = false // intentional re-subscribe: instant, no gap to recover
              attempt = 0
            } else {
              // Server drop: back off (reset only when the last connection delivered — a
              // flap keeps growing), then re-fetch owned state before re-subscribing.
              attempt = delivered ? 0 : attempt + 1
              await sleep(backoffMs(attempt))
              if (deps.signal.aborted) break
              await refetchOwned()
            }
          } else if (reconnectRequested) {
            reconnectRequested = false // poll aborted mid-subscribe — retry, no penalty
          }
          // (Re)subscribe. subscribeWithRetry returns undefined ONLY on shutdown or a
          // poll-abort of THIS cycle — the latter is not a stop, so loop again with a fresh
          // cycle (which picks up the attach that fired the poll). The while-guard exits on
          // shutdown.
          connection = connectionController()
          stream = await subscribeWithRetry(connection.signal)
        }
        await pollDone
      })()
      return { done }
    },
  }
}
