import { describe, expect } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { createTokenStore } from "@marid/auth"
import { instanceMaridDir, start, stop, type LaunchResolver } from "@marid/instance"
import { createChannelClient, type Streamer } from "@marid/channel-client"
import { TestLLMServer } from "../lib/llm-server"
import { testProviderConfig } from "../lib/test-provider"
import { it } from "../lib/effect"

// TEST-SYNC (WBS-3.1/3.3, KPI-001, ADR-0004): the §7 cross-interface flow + the
// EXP-001 concurrency semantics, scripted against a REAL authenticated `marid serve`
// subprocess driven by a TestLLMServer so prompts actually run. Deterministic
// (no real model), 3-OS.
//
// Note on the "TUI" role: the interactive SolidTUI is not driven headlessly here —
// there is no repo precedent for it and it is flake-prone across 3 OSes. The TUI's
// on-the-wire client behavior (bearer attach → discover session → read history →
// continue) is exercised exactly as `marid instance attach` drives it (ADR-0004:
// the TUI is an HTTP+SSE client of the instance server, a launch default not a fork).
//
// Heavy (a real server boot + prompt runs) — gated to the 3-OS marid-sync CI job via
// MARID_SYNC=1 so it stays out of the PR unit job.
const RUN = process.env.MARID_SYNC === "1"
const suite = RUN ? describe : describe.skip

const maridEntry = path.resolve(import.meta.dir, "../../src/marid.ts")
const launch: LaunchResolver = () => ({
  command: process.execPath,
  args: ["run", "--conditions=browser", maridEntry, "serve", "--port", "0"],
})
const testModel = { providerID: "test", modelID: "test-model" }

// The instance launch env: hermetic fake home + offline flags + a real on-disk DB
// (the preload forces :memory:, which a spawned child would inherit) + the test LLM.
function overlayFor(fakeHome: string, llm: TestLLMServer["Service"]): Record<string, string> {
  return {
    HOME: fakeHome,
    USERPROFILE: fakeHome,
    OPENCODE_TEST_HOME: fakeHome,
    OPENCODE_PURE: "1",
    OPENCODE_DISABLE_AUTOUPDATE: "1",
    OPENCODE_DISABLE_AUTOCOMPACT: "1",
    OPENCODE_DISABLE_MODELS_FETCH: "1",
    OPENCODE_AUTH_CONTENT: "{}",
    OPENCODE_DB: "opencode.db",
    OPENCODE_CONFIG_CONTENT: JSON.stringify(testProviderConfig(llm.url)),
  }
}

// Provision an instance tree + admin token + env WITHOUT starting the server, and
// register teardown (stop whatever is running + remove the tree) on the test scope.
// Lifecycle (start/stop/restart) is the caller's — the reconnect test needs that.
function prepareInstance(llm: TestLLMServer["Service"]) {
  return Effect.gen(function* () {
    const root = yield* Effect.promise(() => fs.mkdtemp(path.join(os.tmpdir(), "marid-sync-")))
    const dir = path.join(root, "inst")
    const fakeHome = path.join(root, "home")
    yield* Effect.promise(() => fs.mkdir(fakeHome, { recursive: true }))
    const token = yield* Effect.promise(() =>
      createTokenStore(instanceMaridDir(dir))
        .create("root", "admin")
        .then((r) => r.secret),
    )
    yield* Effect.addFinalizer(() =>
      Effect.promise(async () => {
        await stop(dir).catch(() => {})
        await fs.rm(root, { recursive: true, force: true }).catch(() => {})
      }),
    )
    return { dir, headers: { authorization: `Bearer ${token}` }, overlay: overlayFor(fakeHome, llm) }
  })
}

// Launch a real authenticated marid instance wired to `llm`, returning its base URL
// + bearer headers. Teardown is registered on the caller's test scope.
function launchInstance(llm: TestLLMServer["Service"]) {
  return Effect.gen(function* () {
    const { dir, headers, overlay } = yield* prepareInstance(llm)
    const record = yield* Effect.promise(() => start("inst", dir, launch, { env: overlay, timeoutMs: 60_000 }))
    return { url: `http://127.0.0.1:${record.port}`, headers, dir }
  })
}

// Collect events off the global SSE stream into `sink` until aborted. Started before
// any activity because the firehose is live-only — a subscriber only sees what is
// emitted after it connects. Frames are routing-wrapped: { directory, project,
// payload: { id, type, properties } }; session events carry properties.sessionID.
function collectEvents(
  client: ReturnType<typeof createOpencodeClient>,
  signal: AbortSignal,
  sink: Array<{ type: string; sessionID?: string }>,
): Promise<void> {
  return (async () => {
    const events = await client.global.event({ signal })
    const stream = events.stream as AsyncIterator<{
      payload?: { type: string; properties?: Record<string, unknown> }
    }>
    while (!signal.aborted) {
      const next = await stream.next()
      if (next.done) break
      const payload = next.value.payload
      if (!payload) continue
      const sid = payload.properties?.sessionID
      sink.push({ type: payload.type, sessionID: typeof sid === "string" ? sid : undefined })
    }
    await stream.return?.(undefined)
  })().catch(() => {})
}

const settle = (ms: number) => Effect.promise(() => new Promise((r) => setTimeout(r, ms)))

// Poll a predicate until true (or the timeout), scaled by OPENCODE_TIMING_SCALE for slow CI.
async function waitUntil(predicate: () => boolean, timeoutMs = 20_000): Promise<boolean> {
  const deadline = timeoutMs * (Number(process.env.OPENCODE_TIMING_SCALE) || 1)
  const started = Date.now()
  while (Date.now() - started < deadline) {
    if (predicate()) return true
    await new Promise((r) => setTimeout(r, 25))
  }
  return predicate()
}

// Recording streamer sinks (mirrors the channel-client unit test): capture every push/finish
// per session so the live reconnect E2E can assert what the loop flushed.
function recordingStreamers() {
  const created: Array<{ sessionID: string; pushes: string[]; finishes: string[] }> = []
  const createStreamer = (sessionID: string): Streamer => {
    const rec = { sessionID, pushes: [] as string[], finishes: [] as string[] }
    created.push(rec)
    return { push: async (t) => void rec.pushes.push(t), finish: async (t) => void rec.finishes.push(t) }
  }
  return { created, createStreamer }
}

// Cap backoff/poll sleeps at ~1ms so the WBS-6.5 reconnect loop advances fast in-test.
const fastSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.min(ms, 1)))

// Wrap a real sdk so `global.event`'s live stream can be force-ENDED once — a real SSE drop
// (the server stays up), not a restart. `session.messages` delegates straight through to the
// real durable store, so refetchOwned recovers authoritative state. The channel client only
// ever calls sdk.global.event + sdk.session.messages, so this partial proxy is sufficient.
function droppableSdk(real: ReturnType<typeof createOpencodeClient>) {
  let dropActive: (() => void) | null = null
  const event = async (opts: { signal?: AbortSignal }) => {
    const events = await real.global.event(opts)
    const realStream = events.stream as AsyncIterator<unknown>
    const ended: IteratorResult<unknown> = { done: true, value: undefined }
    let dropped = false
    let signalDrop: (() => void) | null = null
    const dropPromise = new Promise<IteratorResult<unknown>>((resolve) => {
      signalDrop = () => resolve(ended)
    })
    dropActive = () => {
      dropped = true
      signalDrop?.()
      void realStream.return?.(undefined)
    }
    const stream: AsyncIterator<unknown> = {
      next: () => (dropped ? Promise.resolve(ended) : Promise.race([realStream.next(), dropPromise])),
      return: () => realStream.return?.(undefined) ?? Promise.resolve(ended),
    }
    return { stream }
  }
  const sdk = {
    global: { event },
    session: { messages: (args: { sessionID: string }) => real.session.messages(args) },
  } as unknown as ReturnType<typeof createOpencodeClient>
  return { sdk, drop: () => dropActive?.() }
}

suite("TEST-SYNC: §7 cross-interface flow (live, real marid serve + LLM)", () => {
  it.live(
    "API-started session is discovered and continued by a second client; a subscriber sees both",
    () =>
      Effect.gen(function* () {
        const llm = yield* TestLLMServer
        const { url, headers } = yield* launchInstance(llm)

        const api = createOpencodeClient({ baseUrl: url, headers }) // interface 1: the API
        const tui = createOpencodeClient({ baseUrl: url, headers }) // interface 2: the TUI's client role
        const sub = createOpencodeClient({ baseUrl: url, headers }) // interface 3: an event subscriber

        // Subscriber connects FIRST (live-only firehose).
        const seen: Array<{ type: string; sessionID?: string }> = []
        const ctrl = new AbortController()
        const collector = collectEvents(sub, ctrl.signal, seen)
        yield* settle(500) // let the SSE attach

        // (1) API starts a session and prompts it — the assistant replies via the LLM.
        yield* llm.text("hello from the assistant")
        const created = yield* Effect.promise(() =>
          api.session.create({ title: "from-api" }, { throwOnError: true }).then((r) => r.data),
        )
        const sessionID = created.id
        expect(sessionID.startsWith("ses")).toBe(true)
        yield* Effect.promise(() =>
          api.session.prompt(
            { sessionID, model: testModel, parts: [{ type: "text", text: "start via api" }] },
            { throwOnError: true },
          ),
        )

        // (2) The session appears in the second interface, with its history.
        const listed = yield* Effect.promise(() => tui.session.list({}, { throwOnError: true }).then((r) => r.data))
        expect(listed.map((s) => s.id)).toContain(sessionID)
        const history = yield* Effect.promise(() =>
          tui.session.messages({ sessionID }, { throwOnError: true }).then((r) => r.data),
        )
        expect(history.length).toBeGreaterThan(0)

        // (3) The user continues through the second interface.
        yield* llm.text("continued via the tui")
        yield* Effect.promise(() =>
          tui.session.prompt(
            { sessionID, model: testModel, parts: [{ type: "text", text: "continue via tui" }] },
            { throwOnError: true },
          ),
        )

        // (4) The subscriber received updates driven by BOTH interfaces, for this session.
        yield* settle(500) // let the tail flush
        ctrl.abort()
        yield* Effect.promise(() => collector)

        expect(seen.some((e) => e.type === "session.created" && e.sessionID === sessionID)).toBe(true)
        const updates = seen.filter((e) => e.sessionID === sessionID && e.type.startsWith("message."))
        expect(updates.length).toBeGreaterThanOrEqual(2)

        // History now holds both turns (api start + tui continue).
        const finalHistory = yield* Effect.promise(() =>
          api.session.messages({ sessionID }, { throwOnError: true }).then((r) => r.data),
        )
        expect(finalHistory.length).toBeGreaterThan(history.length)
      }).pipe(Effect.provide(TestLLMServer.layer)),
    300_000,
  )

  // WBS-3.3: EXP-001's concurrency authority, asserted THROUGH the marid wrapper.
  // Two clients prompt one session concurrently; upstream's per-session Runner
  // serializes them (join/steer, never two parallel runs), so the result is a
  // single coherent, non-corrupted history — both user prompts present, session
  // still queryable (idle). The fine-grained queue-vs-steer wording is EXP-001's,
  // documented in api-event-contract.md; this proves the wrapper preserves it.
  it.live(
    "concurrent prompts to one session from two clients are serialized without corruption",
    () =>
      Effect.gen(function* () {
        const llm = yield* TestLLMServer
        const { url, headers } = yield* launchInstance(llm)
        const a = createOpencodeClient({ baseUrl: url, headers })
        const b = createOpencodeClient({ baseUrl: url, headers })

        const created = yield* Effect.promise(() =>
          a.session.create({ title: "concurrency" }, { throwOnError: true }).then((r) => r.data),
        )
        const sessionID = created.id

        yield* llm.text("response one")
        yield* llm.text("response two")

        // Fire two prompts to the SAME session concurrently.
        const results = yield* Effect.promise(() =>
          Promise.allSettled([
            a.session.prompt(
              { sessionID, model: testModel, parts: [{ type: "text", text: "alpha" }] },
              { throwOnError: true },
            ),
            b.session.prompt(
              { sessionID, model: testModel, parts: [{ type: "text", text: "bravo" }] },
              { throwOnError: true },
            ),
          ]),
        )
        // The run-state authority admits both (join/steer) — at least one fulfils and
        // neither corrupts; a rejection here would only be a well-formed BusyError.
        expect(results.some((r) => r.status === "fulfilled")).toBe(true)

        // Both user prompts landed in a single coherent history; the session is still
        // queryable (not wedged busy or corrupted).
        const history = yield* Effect.promise(() =>
          a.session.messages({ sessionID }, { throwOnError: true }).then((r) => r.data),
        )
        const blob = JSON.stringify(history)
        expect(blob).toContain("alpha")
        expect(blob).toContain("bravo")
        const session = yield* Effect.promise(() =>
          a.session.get({ sessionID }, { throwOnError: true }).then((r) => r.data),
        )
        expect(session.id).toBe(sessionID)
      }).pipe(Effect.provide(TestLLMServer.layer)),
    300_000,
  )

  // WBS-6.1b (AC-024, EXP-014): the admin-gated attach/detach/bindings endpoints are
  // DOCUMENTED by intercepting GET /doc and merging a Marid-owned OpenAPI fragment into
  // the upstream spec. The unit test proves the merge with a synthetic spec; this proves
  // the LIVE pipeline: an admin token requests /doc WITH accept-encoding: gzip, the
  // middleware strips it so upstream returns plain JSON (a gzipped >1KB spec would be
  // opaque to the merge), and augmentDoc adds the paths. If the strip ever regresses,
  // augmentDoc's .json().catch(()=>undefined) silently returns the UN-augmented spec —
  // 200 + valid OpenAPI, just missing /marid/attach — which this assertion catches.
  it.live(
    "GET /doc is live-augmented with the Marid gateway paths (real gzip→strip→merge)",
    () =>
      Effect.gen(function* () {
        const llm = yield* TestLLMServer
        const { url, headers } = yield* launchInstance(llm)
        const res = yield* Effect.promise(() => fetch(`${url}/doc`, { headers: { ...headers, "accept-encoding": "gzip" } }))
        expect(res.status).toBe(200)
        const spec = (yield* Effect.promise(() => res.json())) as { paths?: Record<string, unknown> }
        expect(spec.paths?.["/marid/attach"]).toBeDefined() // the additive merge survived the live pipeline
        expect(spec.paths?.["/marid/detach"]).toBeDefined()
        expect(spec.paths?.["/marid/bindings"]).toBeDefined()
      }).pipe(Effect.provide(TestLLMServer.layer)),
    120_000,
  )

  // WBS-3.2 (FR-036/043, RISK-006): no state loss across a server restart. The
  // firehose is live-only (no ?after= replay — contract v1.1); recovery is by
  // re-reading the authoritative, durable event-sourced store on reconnect. A
  // message written before the restart is recovered after it, and the restarted
  // server accepts new work.
  it.live(
    "survives a server restart: a reconnecting client re-fetches history written before the restart",
    () =>
      Effect.gen(function* () {
        const llm = yield* TestLLMServer
        const { dir, headers, overlay } = yield* prepareInstance(llm)

        // Boot #1 — create a session and prompt it; the turn is persisted to the DB.
        const rec1 = yield* Effect.promise(() => start("inst", dir, launch, { env: overlay, timeoutMs: 60_000 }))
        const before = createOpencodeClient({ baseUrl: `http://127.0.0.1:${rec1.port}`, headers })
        yield* llm.text("persisted before the restart")
        const sessionID = yield* Effect.promise(() =>
          before.session.create({ title: "restart" }, { throwOnError: true }).then((r) => r.data.id),
        )
        yield* Effect.promise(() =>
          before.session.prompt(
            { sessionID, model: testModel, parts: [{ type: "text", text: "remember me" }] },
            { throwOnError: true },
          ),
        )
        const pre = yield* Effect.promise(() =>
          before.session.messages({ sessionID }, { throwOnError: true }).then((r) => r.data),
        )
        expect(pre.length).toBeGreaterThan(0)

        // Restart: stop (the client's SSE drops), then start again on the SAME tree
        // (same durable DB). The port changes — a real client re-resolves it from the
        // instance record; here we read the new record's port.
        yield* Effect.promise(() => stop(dir).then(() => undefined))
        const rec2 = yield* Effect.promise(() => start("inst", dir, launch, { env: overlay, timeoutMs: 60_000 }))
        expect(rec2.port).toBeGreaterThan(0)

        // Reconnect (new port) and reconcile by re-reading authoritative state: the
        // pre-restart message survived — no state lost across the restart.
        const after = createOpencodeClient({ baseUrl: `http://127.0.0.1:${rec2.port}`, headers })
        const recovered = yield* Effect.promise(() =>
          after.session.messages({ sessionID }, { throwOnError: true }).then((r) => r.data),
        )
        expect(JSON.stringify(recovered)).toContain("remember me")
        expect(recovered.length).toBeGreaterThanOrEqual(pre.length)

        // The restarted server accepts new work, and history keeps growing.
        yield* llm.text("after the restart")
        yield* Effect.promise(() =>
          after.session.prompt(
            { sessionID, model: testModel, parts: [{ type: "text", text: "continue after restart" }] },
            { throwOnError: true },
          ),
        )
        const final = yield* Effect.promise(() =>
          after.session.messages({ sessionID }, { throwOnError: true }).then((r) => r.data),
        )
        expect(final.length).toBeGreaterThan(recovered.length)
      }).pipe(Effect.provide(TestLLMServer.layer)),
    300_000,
  )

  // WBS-6.5 (FR-036/043, RISK-006): the SAME reconnect+re-fetch machinery, but driven END-TO-END
  // through the real @marid/channel-client loop against a live `marid serve` — the merged 6.5 code
  // has unit coverage (channel-client/test/reconnect.test.ts, faked queue) but nothing exercised it
  // against a real firehose + real durable store until now. A turn is persisted BEFORE the client
  // subscribes, so the live-only firehose never delivers it on the wire; only refetchOwned (run on
  // the server-drop reconnect path) can recover it. We force-END the live stream (a real SSE drop,
  // server stays up) and assert the loop flushes the recovered assistant text into its streamer.
  it.live(
    "WBS-6.5: the channel-client reconnect loop recovers an owned session's pre-drop turn from the durable store",
    () =>
      Effect.gen(function* () {
        const llm = yield* TestLLMServer
        const { url, headers } = yield* launchInstance(llm)
        const real = createOpencodeClient({ baseUrl: url, headers })

        // Persist a completed turn while NOTHING is subscribed — the firehose is live-only, so this
        // assistant text is only ever recoverable via a durable re-read (session.messages), never live.
        const marker = "recovered-via-refetch-6point5"
        yield* llm.text(marker)
        const sessionID = yield* Effect.promise(() =>
          real.session.create({ title: "sse-drop" }, { throwOnError: true }).then((r) => r.data.id),
        )
        yield* Effect.promise(() =>
          real.session.prompt(
            { sessionID, model: testModel, parts: [{ type: "text", text: "go" }] },
            { throwOnError: true },
          ),
        )

        // Start the real WBS-6.5 loop over a droppable transport; beginTurn marks the session OWNED
        // (the precondition for refetchOwned to re-read it — a bound session would be owns-gated).
        const recs = recordingStreamers()
        const controller = new AbortController()
        const { sdk, drop } = droppableSdk(real)
        const client = createChannelClient({
          sdk,
          signal: controller.signal,
          createStreamer: recs.createStreamer,
          onAsk: () => {},
          sleep: fastSleep,
        })
        client.beginTurn(sessionID)
        const { done } = yield* Effect.promise(() => client.start())

        // Live-only: the pre-subscription turn is NOT replayed on the wire, so nothing is streamed yet.
        yield* settle(300)
        expect(recs.created.some((c) => c.pushes.some((t) => t.includes(marker)))).toBe(false)

        // Drop the firehose → server-drop path → backoff → refetchOwned re-reads the durable store and
        // flushes the persisted assistant text into a (lazily created) streamer for the owned session.
        drop()
        const recovered = yield* Effect.promise(() =>
          waitUntil(() =>
            recs.created.some((c) => c.sessionID === sessionID && c.pushes.some((t) => t.includes(marker))),
          ),
        )
        expect(recovered).toBe(true)

        controller.abort()
        yield* Effect.promise(() => done.catch(() => {}))
      }).pipe(Effect.provide(TestLLMServer.layer)),
    300_000,
  )
})
