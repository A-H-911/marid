import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { backoffMs, createWahaClient, interpret, WahaError } from "../src/waha"
import type { WebSocketLike } from "../src/waha"

// WBS-7.2. Pinned to the real contract (WAHA 2026.7.1 / NOWEB):
//   packages/opencode/test/marid/fixtures/waha-openapi.json
// These assert the SHAPES Marid puts on the wire. The wire-level fake at the WAHA
// boundary (packages/opencode/test/marid/whatsapp.test.ts, AC-023) is the blocking gate;
// this tier pins the client in isolation with an injected socket + fetch.

const JID = "11111111111@c.us"
const BASE = "http://127.0.0.1:3000"

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body?: unknown
}

let calls: Call[] = []
let respond: (url: string) => Response
const realFetch = globalThis.fetch

beforeEach(() => {
  calls = []
  respond = () => Response.json({ id: "true_11111111111@c.us_AAAA" })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers: (init?.headers as Record<string, string>) ?? {},
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    return respond(url)
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

// A scriptable stand-in for the WAHA socket.
class FakeSocket implements WebSocketLike {
  static last: FakeSocket | undefined
  static urls: string[] = []
  handlers = new Map<string, (ev: any) => void>()
  closed = false

  constructor(readonly url: string) {
    FakeSocket.last = this
    FakeSocket.urls.push(url)
  }
  addEventListener(type: string, cb: (ev: any) => void) {
    this.handlers.set(type, cb)
  }
  close() {
    this.closed = true
  }
  emit(type: string, ev?: unknown) {
    this.handlers.get(type)?.(ev)
  }
}

function client(opts?: { apiKey?: string; signal?: AbortSignal; sleep?: (ms: number) => Promise<void> }) {
  FakeSocket.last = undefined
  FakeSocket.urls = []
  return createWahaClient({
    baseUrl: BASE,
    session: "default",
    apiKey: opts?.apiKey,
    signal: opts?.signal ?? new AbortController().signal,
    log: () => {},
    sleep: opts?.sleep ?? (() => Promise.resolve()),
    socket: (url) => new FakeSocket(url),
  })
}

describe("websocket — outbound only (OQ-004)", () => {
  test("dials out to /ws with the session and the events we consume", async () => {
    const c = client()
    const connected = c.connect()
    FakeSocket.last!.emit("open")
    await connected

    const u = new URL(FakeSocket.last!.url)
    expect(u.protocol).toBe("ws:")
    expect(u.pathname).toBe("/ws")
    expect(u.searchParams.get("session")).toBe("default")
    expect(u.searchParams.getAll("events")).toEqual(["message", "session.status"])
    // Not events=* — that would drag in engine.event debug noise for no benefit.
    expect(u.searchParams.getAll("events")).not.toContain("*")
  })

  test("uses wss when the base url is https", async () => {
    const c = createWahaClient({
      baseUrl: "https://waha.internal",
      session: "s",
      signal: new AbortController().signal,
      log: () => {},
      sleep: () => Promise.resolve(),
      socket: (url) => new FakeSocket(url),
    })
    const connected = c.connect()
    FakeSocket.last!.emit("open")
    await connected
    expect(FakeSocket.last!.url.startsWith("wss://")).toBe(true)
  })

  // WAHA only accepts the key as a query param on the WS — the reason redact.ts exists.
  test("carries the api key in the ws query string when set", async () => {
    const c = client({ apiKey: "sekret" })
    const connected = c.connect()
    FakeSocket.last!.emit("open")
    await connected
    expect(new URL(FakeSocket.last!.url).searchParams.get("x-api-key")).toBe("sekret")
  })

  test("omits the api key entirely when unset", async () => {
    const c = client()
    const connected = c.connect()
    FakeSocket.last!.emit("open")
    await connected
    expect(FakeSocket.last!.url).not.toContain("x-api-key")
  })
})

describe("websocket — reconnect", () => {
  test("reconnects on close and survives a WAHA restart", async () => {
    const c = client()
    const connected = c.connect()
    FakeSocket.last!.emit("open")
    await connected
    expect(FakeSocket.urls.length).toBe(1)

    FakeSocket.last!.emit("close")
    await Promise.resolve() // let the sleep(0) + dial microtasks flush
    await Promise.resolve()
    expect(FakeSocket.urls.length).toBe(2)
  })

  test("connect() resolves even if WAHA is not up yet (boot is not blocked)", async () => {
    const c = client()
    const connected = c.connect()
    FakeSocket.last!.emit("error") // never opened
    // Must not hang: the reconnect loop keeps trying in the background.
    await connected
  })

  test("close() stops the reconnect loop", async () => {
    const c = client()
    const connected = c.connect()
    FakeSocket.last!.emit("open")
    await connected

    await c.close()
    FakeSocket.last!.emit("close")
    await Promise.resolve()
    await Promise.resolve()
    expect(FakeSocket.urls.length).toBe(1) // no redial after close
  })

  test("backoff is capped exponential, matching the channel-client curve", () => {
    expect(backoffMs(0)).toBe(500)
    expect(backoffMs(1)).toBe(1_000)
    expect(backoffMs(6)).toBe(30_000)
    expect(backoffMs(50)).toBe(30_000) // capped, never unbounded
  })
})

describe("outbound HTTP — shapes pinned to the fixture", () => {
  test("sendText posts MessageTextRequest {chatId, text, session}", async () => {
    const c = client({ apiKey: "sekret" })
    const out = await c.sendText(JID, "hello")

    expect(calls[0].url).toBe(`${BASE}/api/sendText`)
    expect(calls[0].method).toBe("POST")
    expect(calls[0].body).toEqual({ chatId: JID, text: "hello", session: "default" })
    // HTTP takes the key as a header (unlike the WS).
    expect(calls[0].headers["X-Api-Key"]).toBe("sekret")
    expect(out.id).toBe("true_11111111111@c.us_AAAA")
  })

  // EditMessageRequest is {text} ONLY — session/chatId/messageId are PATH params. Putting
  // session in the body (as sendText does) would be silently ignored.
  test("editText PUTs {text} to the path route, with no session in the body", async () => {
    respond = () => Response.json({})
    const c = client()
    await c.editText(JID, "msg_1", "edited")

    expect(calls[0].method).toBe("PUT")
    expect(calls[0].url).toBe(`${BASE}/api/default/chats/${encodeURIComponent(JID)}/messages/msg_1`)
    expect(calls[0].body).toEqual({ text: "edited" })
  })

  // WAHA's vocabulary is "typing" — NOT Baileys'/ADR-0010's "composing".
  test("setPresence posts WAHASessionPresence with typing/paused", async () => {
    respond = () => Response.json({})
    const c = client()
    await c.setPresence(JID, "typing")
    expect(calls[0].url).toBe(`${BASE}/api/default/presence`)
    expect(calls[0].body).toEqual({ chatId: JID, presence: "typing" })

    await c.setPresence(JID, "paused")
    expect(calls[1].body).toEqual({ chatId: JID, presence: "paused" })
  })

  test("sendMedia sends an image as BinaryFile base64 to /api/sendImage", async () => {
    respond = () => Response.json({})
    const c = client()
    await c.sendMedia(JID, { bytes: new Uint8Array([1, 2, 3]), mimetype: "image/png", filename: "a.png" })

    expect(calls[0].url).toBe(`${BASE}/api/sendImage`)
    expect(calls[0].body).toEqual({
      chatId: JID,
      file: { mimetype: "image/png", data: Buffer.from([1, 2, 3]).toString("base64"), filename: "a.png" },
      session: "default",
    })
  })

  test("sendMedia routes non-images to /api/sendFile and carries a caption", async () => {
    respond = () => Response.json({})
    const c = client()
    await c.sendMedia(JID, { bytes: new Uint8Array([9]), mimetype: "application/pdf", caption: "report" })

    expect(calls[0].url).toBe(`${BASE}/api/sendFile`)
    expect(calls[0].body).toMatchObject({ caption: "report", file: { mimetype: "application/pdf" } })
  })

  test("a group JID is path-encoded and cannot escape the route", async () => {
    respond = () => Response.json({})
    const c = client()
    await c.editText("9999@g.us", "../../evil", "x")
    expect(calls[0].url).toBe(`${BASE}/api/default/chats/9999%40g.us/messages/..%2F..%2Fevil`)
  })

  test("a non-2xx surfaces as WahaError carrying status and route", async () => {
    respond = () => new Response("nope", { status: 422 })
    const c = client()
    const err = await c.sendText(JID, "x").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(WahaError)
    expect((err as WahaError).status).toBe(422)
  })

  test("environment() reads WAHAEnvironment for the tier/engine assertion", async () => {
    respond = () => Response.json({ version: "2026.7.1", engine: "NOWEB", tier: "CORE" })
    const c = client()
    expect(await c.environment()).toEqual({ version: "2026.7.1", engine: "NOWEB", tier: "CORE" })
  })

  test("downloadMedia fetches WAHA's own media url with the key attached", async () => {
    respond = () => new Response(new Uint8Array([7, 8]))
    const c = client({ apiKey: "sekret" })
    const bytes = await c.downloadMedia({ url: `${BASE}/api/files/x.oga`, mimetype: "audio/ogg" })
    expect(Array.from(bytes)).toEqual([7, 8])
    expect(calls[0].headers["X-Api-Key"]).toBe("sekret")
  })
})

describe("interpret — untrusted inbound frames (INV-004)", () => {
  const frame = (payload: Record<string, unknown>, event = "message") => JSON.stringify({ event, payload })

  test("maps a message frame to the narrow shape", async () => {
    const m = await interpret(frame({ id: "m1", from: JID, body: "hi", fromMe: false, hasMedia: false }))
    expect(m).toEqual({ id: "m1", from: JID, body: "hi", fromMe: false, hasMedia: false, media: undefined })
  })

  test("carries media when WAHA downloaded it", async () => {
    const m = await interpret(
      frame({
        id: "m1",
        from: JID,
        body: "",
        hasMedia: true,
        media: { url: "http://waha/api/files/a.oga", mimetype: "audio/ogg", filename: "a.oga" },
      }),
    )
    expect(m!.media).toEqual({ url: "http://waha/api/files/a.oga", mimetype: "audio/ogg", filename: "a.oga" })
  })

  // WAHA's own docs: hasMedia:true with media:null is normal (not downloaded per config).
  test("tolerates hasMedia:true with media:null", async () => {
    const m = await interpret(frame({ id: "m1", from: JID, hasMedia: true, media: null }))
    expect(m!.hasMedia).toBe(true)
    expect(m!.media).toBeUndefined()
  })

  test("drops non-message events (session.status rides the same socket)", async () => {
    expect(await interpret(frame({ status: "WORKING" }, "session.status"))).toBeUndefined()
  })

  test.each([
    ["malformed json", "{not json"],
    ["empty string", ""],
    ["non-string frame", 42],
    ["missing id", JSON.stringify({ event: "message", payload: { from: JID } })],
    ["missing from", JSON.stringify({ event: "message", payload: { id: "m1" } })],
    ["no payload", JSON.stringify({ event: "message" })],
  ])("drops %s rather than throwing (a bad frame must not kill the socket)", async (_label, raw) => {
    expect(await interpret(raw)).toBeUndefined()
  })

  test("a missing body becomes an empty string, never undefined", async () => {
    expect((await interpret(frame({ id: "m1", from: JID })))!.body).toBe("")
  })
})
