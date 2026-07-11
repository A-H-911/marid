// TEST-SEC repro (surfaced by WBS-6.6 live model testing) — INV-001 leak on /global/event.
//
// A channel (non-admin) token must see ONLY the sessions it owns or is bound to. The live
// model harness (tg-model-e2e.ts) showed a channel token receiving + rendering a session it
// neither owns nor is bound to. This is the minimal, model-free, deterministic reproduction
// and root-cause demonstration.
//
// ROOT CAUSE: marid-auth gates its owns∪bound SSE filter on `isStream(request)`, which returns
// true ONLY when the request carries `Accept: text/event-stream` (middleware.ts:48). The SDK's
// SSE client (`sdk.global.event()` → serverSentEvents.gen.ts) does NOT send that header, so the
// firehose request is classified as a non-stream, the `if (stream)` filter block is skipped,
// and /global/event is returned UNFILTERED to the non-admin channel token.
//
// This script subscribes a CHANNEL token to /global/event three ways, creates an ADMIN-only
// session after each subscribe, and reports whether that session leaks into the channel stream:
//   1. raw fetch WITH    Accept: text/event-stream  → isolated (the filter works)
//   2. raw fetch WITHOUT the header                 → LEAK   (filter skipped)
//   3. sdk.global.event() (the real channel path)   → LEAK   (SDK omits the header)
//
//   cd packages/opencode && bun run scripts/global-event-isolation-repro.ts

import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { createTokenStore } from "@marid/auth"
import { instanceMaridDir, start, stop, type LaunchResolver } from "@marid/instance"

const AGENT = "build"
const maridEntry = path.resolve(import.meta.dir, "../src/marid.ts")
const launch: LaunchResolver = () => ({
  command: process.execPath,
  args: ["run", "--conditions=browser", maridEntry, "serve", "--port", "0"],
})
function overlay(fakeHome: string): Record<string, string> {
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
    OPENCODE_CONFIG_CONTENT: JSON.stringify({ formatter: false, lsp: false }),
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Read an SSE ReadableStream for `ms`, returning every `ses_…` id seen in the frames.
async function collectSessions(body: ReadableStream<Uint8Array>, ac: AbortController, ms: number): Promise<Set<string>> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const seen = new Set<string>()
  const pump = (async () => {
    let buffer = ""
    for (;;) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }))
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      for (const m of buffer.matchAll(/ses_[A-Za-z0-9]+/g)) seen.add(m[0])
      buffer = buffer.slice(-64) // keep a tail in case an id straddles a chunk
    }
  })()
  await sleep(ms)
  ac.abort()
  await pump.catch(() => {})
  return seen
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "gev-repro-"))
  const dir = path.join(root, "inst")
  const fakeHome = path.join(root, "home")
  await fs.mkdir(fakeHome, { recursive: true })
  const store = createTokenStore(instanceMaridDir(dir))
  const chanToken = await store.create("chan", "channel:telegram", AGENT).then((r) => r.secret)
  const adminToken = await store.create("adm", "admin").then((r) => r.secret)
  const record = await start("inst", dir, launch, { env: overlay(fakeHome), timeoutMs: 60_000 })
  const baseUrl = `http://127.0.0.1:${record.port}`
  const adminSdk = createOpencodeClient({ baseUrl, headers: { authorization: `Bearer ${adminToken}` } })
  const chanSdk = createOpencodeClient({ baseUrl, headers: { authorization: `Bearer ${chanToken}` } })

  // Subscribe (mode), create an admin-only session AFTER subscribing, report if it leaked.
  async function probe(label: string, subscribe: () => Promise<{ body: ReadableStream<Uint8Array>; ac: AbortController }>): Promise<boolean> {
    const { body, ac } = await subscribe()
    const done = collectSessions(body, ac, 2500)
    await sleep(400) // let the subscription settle before the session is created
    const s = await adminSdk.session.create({ agent: AGENT, title: label }, { throwOnError: true }).then((r) => r.data)
    const seen = await done
    const leaked = seen.has(s.id)
    console.log(`${leaked ? "LEAK  ◀" : "ok      "}  ${label}: admin session ${leaked ? "VISIBLE to channel (INV-001)" : "isolated"}`)
    return leaked
  }

  try {
    const withHeader = await probe("raw fetch WITH Accept: text/event-stream", async () => {
      const ac = new AbortController()
      const res = await fetch(`${baseUrl}/global/event`, { headers: { authorization: `Bearer ${chanToken}`, accept: "text/event-stream" }, signal: ac.signal })
      return { body: res.body!, ac }
    })
    const withoutHeader = await probe("raw fetch WITHOUT Accept header       ", async () => {
      const ac = new AbortController()
      const res = await fetch(`${baseUrl}/global/event`, { headers: { authorization: `Bearer ${chanToken}` }, signal: ac.signal })
      return { body: res.body!, ac }
    })
    const viaSdk = await probe("sdk.global.event() (real channel path) ", async () => {
      const ac = new AbortController()
      const events = await chanSdk.global.event({ signal: ac.signal })
      // Bridge the SDK's async-iterator of parsed frames back to bytes collectSessions can scan.
      const iter = events.stream as AsyncIterator<unknown>
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          const n = await iter.next().catch(() => ({ done: true, value: undefined }))
          if (n.done) return controller.close()
          controller.enqueue(new TextEncoder().encode(JSON.stringify(n.value)))
        },
      })
      return { body, ac }
    })

    console.log("\n── conclusion ──")
    console.log(`filter works when the request is recognised as a stream (WITH header): leaked=${withHeader}`)
    console.log(`filter SKIPPED without the header:                                     leaked=${withoutHeader}`)
    console.log(`the real SDK firehose call omits the header, so it leaks:              leaked=${viaSdk}`)
    if (withoutHeader || viaSdk) {
      console.log("\n❌ INV-001 LEAK CONFIRMED — /global/event is unfiltered for a non-admin token whose")
      console.log("   SSE request lacks `Accept: text/event-stream` (which the SDK does not send).")
      process.exitCode = 1
    } else {
      console.log("\n✅ no leak (filter effective on all paths)")
    }
  } finally {
    await stop(dir).catch(() => {})
    await fs.rm(root, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((err: { message?: string }) => {
  console.error("repro FAIL:", err?.message ?? String(err))
  process.exit(1)
})
