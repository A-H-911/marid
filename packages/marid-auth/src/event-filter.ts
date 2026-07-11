// Strict `client`-scope event/list isolation (deferred PH-1 follow-up, DEC-011
// consequence). The marid-auth wrapper runs at HTTP ingress (EXP-004 seam) and
// scope.ts enforces per-session *route* ownership; this module adds the *body*
// filtering the wrapper altitude left out: dropping other sessions' frames from
// the global `GET /event` firehose and other sessions' entries from `GET /session`.
//
// Key fact that makes this a one-field probe (not a per-event-type map): every
// session-bearing event — v1 (`session.created`, `message.part.*`, …) and v2
// (`session.next.*`, `session.status`, `permission.v2.*`) — carries `sessionID`
// at the TOP LEVEL of its payload. It is the event-sourcing aggregate key
// (`durable.aggregate: "sessionID"`), so the owning session of any frame is just
// `properties.sessionID`. Session-less frames (server.connected/heartbeat/
// disposed, global/foundation events) have no `sessionID` and always pass —
// they are infrastructure the client needs, not another session's data.

// Sync JSON.parse of untrusted stream data, guarded without a try block (the
// package convention is `.catch`, not try/catch). A throw inside the `.then`
// rejects, and `.catch` maps it to undefined.
const safeJson = (text: string): Promise<unknown> =>
  Promise.resolve()
    .then(() => JSON.parse(text) as unknown)
    .catch(() => undefined)

// The owning session id of a parsed event frame, or undefined for a session-less
// frame. A session id is the branded `ses`-prefixed string at `properties.sessionID`.
export function owningSession(frame: unknown): string | undefined {
  if (typeof frame !== "object" || frame === null) return undefined
  const properties = (frame as { properties?: unknown }).properties
  if (typeof properties !== "object" || properties === null) return undefined
  const sessionID = (properties as { sessionID?: unknown }).sessionID
  return typeof sessionID === "string" && sessionID.startsWith("ses") ? sessionID : undefined
}

// The owning session of a ROUTING-WRAPPED /global/event frame ({ directory, payload }).
// Unlike the raw /event stream, /global/event carries TWO frames per durable event
// (event-v2-bridge.ts): the regular twin — payload = { id, type, properties } (owns via
// properties.sessionID) — AND the durable "sync" twin — payload = { type:"sync",
// syncEvent:{ aggregateID, data } } — which repeats the SAME data addressed by
// aggregateID. Every session-durable event uses `durable.aggregate: "sessionID"`
// (session-event.ts), so the sync twin's aggregateID IS the owning session (`ses`-prefixed).
// Filtering only the regular twin would leak the durable copy; this reads both. Non-session
// aggregates (non-`ses`) and session-less control frames (server.connected/heartbeat/
// instance.disposed, installation.updated) have no `ses` id and pass.
export function owningSessionGlobal(frame: unknown): string | undefined {
  if (typeof frame !== "object" || frame === null) return undefined
  const payload = (frame as { payload?: unknown }).payload
  if (typeof payload !== "object" || payload === null) return undefined
  const direct = owningSession(payload) // regular twin: payload.properties.sessionID
  if (direct) return direct
  const syncEvent = (payload as { syncEvent?: unknown }).syncEvent // sync twin: payload.syncEvent.aggregateID
  if (typeof syncEvent !== "object" || syncEvent === null) return undefined
  const aggregateID = (syncEvent as { aggregateID?: unknown }).aggregateID
  return typeof aggregateID === "string" && aggregateID.startsWith("ses") ? aggregateID : undefined
}

// Keep a parsed frame iff it is session-less (infrastructure/global) or owned. `pick`
// maps a frame to its owning session id (defaults to the raw /event shape; /global/event
// passes owningSessionGlobal for the wrapped shape).
export function keepFrame(
  frame: unknown,
  owns: (sessionID: string) => boolean,
  pick: (frame: unknown) => string | undefined = owningSession,
): boolean {
  const session = pick(frame)
  return session === undefined || owns(session)
}

const FRAME_DELIMITER = "\n\n"

// Extract the `data:` payload of one raw SSE frame and decide whether to keep it.
// Frames with no `data:` line (comments, bare `event:` lines) and unparseable
// payloads pass through unchanged — only well-formed non-owned session frames drop.
const keepRawFrame = async (
  raw: string,
  owns: (sessionID: string) => boolean,
  pick: (frame: unknown) => string | undefined,
): Promise<boolean> => {
  const dataLine = raw.split("\n").find((line) => line.startsWith("data:"))
  if (!dataLine) return true
  const parsed = await safeJson(dataLine.slice("data:".length).trim())
  if (parsed === undefined) return true
  return keepFrame(parsed, owns, pick)
}

// Wrap an SSE byte stream, dropping event frames the token does not own. Buffers
// across chunk boundaries — a single frame can be split across reads, and a read
// can carry several frames. Ownership is a snapshot passed by the caller.
// ponytail: ownership is snapshotted at subscribe time; a session the same client
// creates on another request mid-stream is visible only after reconnect. Acceptable
// for MVP strict isolation; per-frame ownership re-read would add I/O per event.
export function filterSseStream(
  body: ReadableStream<Uint8Array>,
  owns: (sessionID: string) => boolean,
  pick: (frame: unknown) => string | undefined = owningSession,
): ReadableStream<Uint8Array> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ""

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }))
        if (done) {
          if (buffer.length > 0 && (await keepRawFrame(buffer, owns, pick))) controller.enqueue(encoder.encode(buffer))
          buffer = ""
          controller.close()
          return
        }
        buffer += decoder.decode(value, { stream: true })
        let emitted = ""
        let index = buffer.indexOf(FRAME_DELIMITER)
        while (index !== -1) {
          const frame = buffer.slice(0, index + FRAME_DELIMITER.length)
          buffer = buffer.slice(index + FRAME_DELIMITER.length)
          if (await keepRawFrame(frame, owns, pick)) emitted += frame
          index = buffer.indexOf(FRAME_DELIMITER)
        }
        // Only return once there is something to hand back; if this read produced
        // no complete frame (or every frame was dropped) loop and read again.
        if (emitted.length > 0) {
          controller.enqueue(encoder.encode(emitted))
          return
        }
      }
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {})
    },
  })
}

// Filter a JSON-array list body to entries the token owns. `pick` maps an entry
// to its owning session id — for `GET /session` that is the entry's own `id`, for
// `GET /permission` it is the entry's `sessionID`. A non-array body passes
// unchanged (e.g. an error object), so only well-formed lists are narrowed.
export async function filterOwnedArray(
  body: string,
  pick: (entry: unknown) => string | undefined,
  owns: (sessionID: string) => boolean,
): Promise<string> {
  const parsed = await safeJson(body)
  if (!Array.isArray(parsed)) return body
  const kept = parsed.filter((entry) => {
    const session = pick(entry)
    return session !== undefined && owns(session)
  })
  return JSON.stringify(kept)
}

// Owning-session pickers for the two filtered list routes.
export const pickSessionId = (entry: unknown): string | undefined => {
  const id = (entry as { id?: unknown } | null)?.id
  return typeof id === "string" ? id : undefined
}
export const pickPermissionSessionId = (entry: unknown): string | undefined => {
  const sessionID = (entry as { sessionID?: unknown } | null)?.sessionID
  return typeof sessionID === "string" ? sessionID : undefined
}
