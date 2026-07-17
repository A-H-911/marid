import type {
  InboundMedia,
  InboundMessage,
  OutboundMedia,
  Presence,
  WahaEnvironment,
  WhatsAppClient,
} from "./client"

// WAHA NOWEB client (WBS-7.2, ADR-0010 primary, DEC-015).
//
// The shape is asymmetric and that asymmetry is the whole design:
//
//   OUT -> HTTP REST   (POST /api/sendText, PUT .../messages/{id}, ...)
//   IN  <- WebSocket   (GET /ws?session=&events=  — WE dial out)
//
// Both directions are OUTBOUND connections from Marid. WAHA's other event mode is a
// webhook, which would require a public inbound endpoint and is therefore excluded by
// OQ-004 — WebSocket event mode is the ONLY OQ-004-compatible WAHA mode (R-12 §D).
// This file opens no listening socket; a source-guard test pins that.
//
// Pulls NO WhatsApp dependency: Bun ships fetch + WebSocket. That is the entire RISK-014
// containment argument — a lotusbail-class compromise lives in the WAHA container, never
// in Marid's node_modules.
//
// Contract pinned to WAHA 2026.7.1 / NOWEB:
//   packages/opencode/test/marid/fixtures/waha-openapi.json
//   image devlikeapro/waha:noweb-2026.7.1@sha256:8717e9a689b723d0782aae9340dbf3d1234c9c6cd53c873382f921a5f466c119

export interface WahaClientDeps {
  baseUrl: string
  session: string
  apiKey?: string
  signal: AbortSignal
  log: (line: string) => void
  // Injected for deterministic tests (the fake harness drives these).
  sleep?: (ms: number) => Promise<void>
  // Swappable so tests can inject a fake socket; production uses the global.
  socket?: (url: string) => WebSocketLike
}

// The slice of the WebSocket API this client uses. Narrow on purpose: it is what the
// fake has to implement.
export interface WebSocketLike {
  addEventListener(type: "open" | "message" | "close" | "error", cb: (ev: any) => void): void
  close(): void
}

// Same curve as @marid/channel-client's firehose pump (500ms -> 30s capped): a WAHA
// restart or a container redeploy should not hot-spin, and the operator's next message
// should still land promptly.
const BACKOFF_BASE_MS = 500
const BACKOFF_MAX_MS = 30_000

export function backoffMs(attempt: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS)
}

// WAHA delivers many event types; we subscribe to exactly what the gateway consumes.
// `events=*` would also drag in engine.event debug noise (WAHA docs) for no benefit.
const EVENTS = ["message", "session.status"]

export class WahaError extends Error {
  constructor(
    readonly status: number,
    readonly route: string,
    body: string,
  ) {
    super(`WAHA ${route} failed: ${status} ${body}`.trim())
    this.name = "WahaError"
  }
}

export function createWahaClient(deps: WahaClientDeps): WhatsAppClient {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const open = deps.socket ?? ((url: string) => new WebSocket(url) as unknown as WebSocketLike)
  let onMessageCb: ((m: InboundMessage) => void) | undefined
  let socket: WebSocketLike | undefined
  let closed = false

  // The API key rides in a HEADER for HTTP...
  function headers(extra?: Record<string, string>): Record<string, string> {
    return { ...(deps.apiKey ? { "X-Api-Key": deps.apiKey } : {}), ...extra }
  }

  // ...but WAHA only accepts it as a QUERY PARAM on the WebSocket. That is why every log
  // line in this process goes through redact() — the URL itself is a secret (INV-002).
  function wsUrl(): string {
    const u = new URL(deps.baseUrl)
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:"
    u.pathname = "/ws"
    u.searchParams.set("session", deps.session)
    for (const e of EVENTS) u.searchParams.append("events", e)
    if (deps.apiKey) u.searchParams.set("x-api-key", deps.apiKey)
    return u.toString()
  }

  async function call(route: string, init: RequestInit): Promise<Response> {
    const res = await fetch(`${deps.baseUrl}${route}`, { ...init, signal: deps.signal })
    if (!res.ok) throw new WahaError(res.status, route, await res.text().catch(() => ""))
    return res
  }

  const postJson = (route: string, body: unknown) =>
    call(route, { method: "POST", headers: headers({ "content-type": "application/json" }), body: JSON.stringify(body) })

  function connect(): Promise<void> {
    return new Promise<void>((resolve) => {
      let attempt = 0
      let settled = false

      const dial = () => {
        if (closed || deps.signal.aborted) return
        const ws = open(wsUrl())
        socket = ws

        ws.addEventListener("open", () => {
          attempt = 0 // only a CONNECTED socket resets the curve; a flap keeps growing
          deps.log("waha: websocket connected")
          if (!settled) {
            settled = true
            resolve()
          }
        })

        ws.addEventListener("message", (ev: { data: unknown }) => {
          void interpret(ev.data).then((m) => {
            if (m && onMessageCb) onMessageCb(m)
          })
        })

        // WAHA restarts, container redeploys, and idle timeouts all land here. Reconnect
        // rather than die: the operator's channel must survive a sidecar bounce.
        const retry = () => {
          if (closed || deps.signal.aborted) return
          const wait = backoffMs(attempt++)
          deps.log(`waha: websocket down, reconnecting in ${wait}ms`)
          // Resolve on the FIRST dial even if it failed, so a not-yet-up WAHA doesn't
          // block boot — the reconnect loop keeps trying in the background.
          if (!settled) {
            settled = true
            resolve()
          }
          void sleep(wait).then(dial)
        }
        ws.addEventListener("close", retry)
        ws.addEventListener("error", retry)
      }

      dial()
    })
  }

  return {
    connect,
    onMessage(cb) {
      onMessageCb = cb
    },

    async sendText(jid, text) {
      // MessageTextRequest: {chatId, text, session} required (pinned fixture).
      const res = await postJson("/api/sendText", { chatId: jid, text, session: deps.session })
      const body = (await res.json().catch(() => ({}))) as { id?: unknown; _data?: unknown }
      const id = typeof body.id === "string" ? body.id : messageIdOf(body)
      return { id }
    },

    async editText(jid, messageId, text) {
      // EditMessageRequest is {text} ONLY — session/chatId/messageId are PATH params.
      // Sending session in the body (as sendText does) would be silently ignored.
      const route = `/api/${enc(deps.session)}/chats/${enc(jid)}/messages/${enc(messageId)}`
      await call(route, {
        method: "PUT",
        headers: headers({ "content-type": "application/json" }),
        body: JSON.stringify({ text }),
      })
    },

    async sendMedia(jid, media) {
      // BinaryFile: base64 `data`, not multipart. Image mimes render inline; everything
      // else goes as a document (same split as the Telegram adapter).
      const file = {
        mimetype: media.mimetype,
        data: Buffer.from(media.bytes).toString("base64"),
        ...(media.filename ? { filename: media.filename } : {}),
      }
      const route = media.mimetype.startsWith("image/") ? "/api/sendImage" : "/api/sendFile"
      await postJson(route, {
        chatId: jid,
        file,
        session: deps.session,
        ...(media.caption ? { caption: media.caption } : {}),
      })
    },

    async setPresence(jid, presence: Presence) {
      // WAHASessionPresence: {chatId?, presence} with presence in
      // offline|online|typing|recording|paused. "typing" — NOT Baileys' "composing".
      await postJson(`/api/${enc(deps.session)}/presence`, { chatId: jid, presence })
    },

    async downloadMedia(media: InboundMedia) {
      // WAHA serves media from its own host; the key must ride along.
      const res = await fetch(media.url, { headers: headers(), signal: deps.signal })
      if (!res.ok) throw new WahaError(res.status, "media download", "")
      return new Uint8Array(await res.arrayBuffer())
    },

    async environment(): Promise<WahaEnvironment> {
      const res = await call("/api/version", { method: "GET", headers: headers() })
      const body = (await res.json()) as Partial<WahaEnvironment>
      const str = (v: unknown): string => (typeof v === "string" ? v : "unknown")
      return { version: str(body.version), engine: str(body.engine), tier: str(body.tier) }
    },

    async close() {
      closed = true
      socket?.close()
    },
  }
}

// Path segments carry a JID with an "@" and a message id with underscores; encode so a
// group JID or an odd id can't escape the route.
function enc(s: string): string {
  return encodeURIComponent(s)
}

function messageIdOf(body: { _data?: unknown }): string {
  const data = body._data as { key?: { id?: unknown } } | undefined
  return typeof data?.key?.id === "string" ? data.key.id : ""
}

// Interpret a raw WAHA WS frame into the narrow InboundMessage, defensively: the socket
// carries session.status and other event types too, and the payload shape differs across
// engines (`_data` is engine-specific by WAHA's own docs). Anything unrecognized is
// dropped rather than guessed at — this is untrusted input (INV-004).
//
// Async only so the JSON.parse throw on a malformed frame can be .catch()ed instead of
// try/caught (style guide). Frames stay in order: each resolves on the microtask queue,
// which is FIFO.
export function interpret(raw: unknown): Promise<InboundMessage | undefined> {
  return Promise.resolve()
    .then(() => interpretFrame(raw))
    .catch(() => undefined)
}

function interpretFrame(raw: unknown): InboundMessage | undefined {
  const text = typeof raw === "string" ? raw : undefined
  if (!text) return undefined
  const frame = JSON.parse(text) as { event?: unknown; payload?: Record<string, unknown> } | undefined
  if (!frame || frame.event !== "message" || !frame.payload) return undefined
  const p = frame.payload
  const id = typeof p.id === "string" ? p.id : undefined
  const from = typeof p.from === "string" ? p.from : undefined
  if (!id || !from) return undefined
  const media = p.media as { url?: unknown; mimetype?: unknown; filename?: unknown } | null | undefined
  return {
    id,
    from,
    body: typeof p.body === "string" ? p.body : "",
    fromMe: p.fromMe === true,
    hasMedia: p.hasMedia === true,
    // hasMedia:true with media:null is normal — WAHA may not have downloaded it.
    media:
      media && typeof media.url === "string" && typeof media.mimetype === "string"
        ? {
            url: media.url,
            mimetype: media.mimetype,
            ...(typeof media.filename === "string" ? { filename: media.filename } : {}),
          }
        : undefined,
  }
}
