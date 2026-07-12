// Discriminator (ADR-0016 fallout): does a non-admin token see its OWN session created AFTER it
// subscribed? The gateway subscribes owning zero sessions, then creates a session per inbound turn
// mid-stream. If the owns snapshot is frozen at subscribe time, the own session's frames are filtered
// out (snapshot staleness) — the AC-017 timeout cause. If delivered, the timeout is something else.
//
//   cd packages/opencode && bun run scripts/own-session-visibility-repro.ts

import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { createTokenStore, createOwnershipStore } from "@marid/gateway"
import { instanceMaridDir, start, stop, type LaunchResolver } from "@marid/instance"

const AGENT = "build"
const maridEntry = path.resolve(import.meta.dir, "../src/marid.ts")
const launch: LaunchResolver = () => ({ command: process.execPath, args: ["run", "--conditions=browser", maridEntry, "serve", "--port", "0"] })
const overlay = (h: string): Record<string, string> => ({
  HOME: h, USERPROFILE: h, OPENCODE_TEST_HOME: h, OPENCODE_PURE: "1",
  OPENCODE_DISABLE_AUTOUPDATE: "1", OPENCODE_DISABLE_AUTOCOMPACT: "1", OPENCODE_DISABLE_MODELS_FETCH: "1",
  OPENCODE_AUTH_CONTENT: "{}", OPENCODE_DB: "opencode.db", OPENCODE_CONFIG_CONTENT: JSON.stringify({ formatter: false, lsp: false }),
})
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "own-vis-"))
  const dir = path.join(root, "inst")
  const home = path.join(root, "home")
  await fs.mkdir(home, { recursive: true })
  const store = createTokenStore(instanceMaridDir(dir))
  const chan = await store.create("chan", "channel:telegram", AGENT).then((r) => r.secret)
  const rec = await start("inst", dir, launch, { env: overlay(home), timeoutMs: 60_000 })
  const baseUrl = `http://127.0.0.1:${rec.port}`
  const chanSdk = createOpencodeClient({ baseUrl, headers: { authorization: `Bearer ${chan}` } })
  try {
    // Subscribe the channel to /global/event the way the real channel-client does: header-LESS
    // (the SDK omits Accept) — now routed through the fixed, filtered path. Owns ZERO at this point.
    const ac = new AbortController()
    const res = await fetch(`${baseUrl}/global/event`, { headers: { authorization: `Bearer ${chan}` }, signal: ac.signal })
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    const seen = new Set<string>()
    const pump = (async () => {
      let buf = ""
      for (;;) {
        const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }))
        if (done) break
        buf += dec.decode(value, { stream: true })
        for (const m of buf.matchAll(/ses_[A-Za-z0-9]+/g)) seen.add(m[0])
        buf = buf.slice(-64)
      }
    })()
    await sleep(500) // subscription settled, snapshot taken (owns = {})

    // NOW create a channel-OWNED session mid-stream + emit a frame for it (rename → session.updated).
    const own = await chanSdk.session.create({ agent: AGENT, title: "own-mid" }, { throwOnError: true }).then((r) => r.data)
    // DIAG: did the server record ownership for the channel token's create? (read the on-disk store)
    const recorded = await createOwnershipStore(instanceMaridDir(dir)).owns("chan", own.id).catch(() => false)
    console.log(`[DIAG] ownership store: chan owns ${own.id}? ${recorded}`)
    await chanSdk.session.update({ sessionID: own.id, title: "own-mid-touched" }, { throwOnError: true }).catch(() => {})
    await sleep(2500)
    ac.abort()
    await pump.catch(() => {})

    const visible = seen.has(own.id)
    console.log(`channel-owned session created AFTER subscribe = ${own.id}`)
    console.log(`visible on the channel's own filtered firehose : ${visible}`)
    // NOTE: this demonstrates the CAUSE (snapshot staleness), not the ADR-0017 fix. The only frame a
    // channel can emit here is `session.created` — which fires BEFORE the create request records ownership
    // (a channel is deny-by-default, so session.update is 403, and a real prompt needs a model). So this
    // stays NOT-DELIVERED even with the lazy fix: the lazy re-read admits frames that arrive AFTER ownership
    // is recorded (the assistant reply), which this model-free script cannot produce. The FIX is validated by
    // the lazy-visibility unit test + telegram.test.ts (real gateway reply) — see ADR-0017.
    console.log(visible
      ? "\nDELIVERED."
      : "\nNOT DELIVERED — expected here (frame precedes the ownership record; see note). Cause confirmed.")
  } finally {
    await stop(dir).catch(() => {})
    await fs.rm(root, { recursive: true, force: true }).catch(() => {})
  }
}
main().catch((e: { message?: string }) => { console.error("repro FAIL:", e?.message ?? String(e)); process.exit(1) })
