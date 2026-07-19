import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

// AC-018 / OQ-004: "the connection is outbound-only with no public inbound endpoint".
//
// This is an ARCHITECTURAL property, so it gets a structural proof rather than a
// behavioral one. You cannot demonstrate the absence of a listening socket by observing
// a passing round trip — the socket would simply be somewhere the test never looked.
// So: assert the source cannot open one at all.
//
// This is the same shape as the repo's TEST-BUILD hygiene greps, and it is deliberately
// coarse. It fails loudly if anyone later reaches for WAHA's webhook mode (which needs an
// inbound endpoint and is the OQ-004-excluded alternative — R-12 §D) or stands up a
// server "just for a health check".

const SRC = path.join(import.meta.dir, "..", "src")

// Anything that binds a port, in any runtime this package could plausibly use.
const LISTENERS = [
  /\bBun\.serve\s*\(/,
  /\bBun\.listen\s*\(/,
  /\bcreateServer\s*\(/,
  /\bnode:https?\b/,
  /\bfrom\s+["']node:net["']/,
  /\.listen\s*\(/,
  /\bnew\s+WebSocketServer\b/,
]

// Scan CODE, not prose. These files explain at length WHY webhook mode is excluded, and
// a guard that greps raw text would fire on its own rationale — so strip comments first.
// (This is not a parser; it does not need to be. It only has to stop a comment from
// reading as an implementation.)
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
}

async function sources(): Promise<Array<{ file: string; text: string }>> {
  const names = await fs.readdir(SRC)
  return Promise.all(
    names
      .filter((n) => n.endsWith(".ts"))
      .map(async (n) => ({ file: n, text: stripComments(await fs.readFile(path.join(SRC, n), "utf8")) })),
  )
}

describe("outbound-only (OQ-004, AC-018)", () => {
  test("no source file can open a listening socket", async () => {
    const offenders: string[] = []
    for (const { file, text } of await sources()) {
      for (const pattern of LISTENERS) {
        if (pattern.test(text)) offenders.push(`${file} matches ${pattern}`)
      }
    }
    expect(offenders).toEqual([])
  })

  // The positive half: the WhatsApp connection is a client dialing OUT. If this ever
  // reads "webhook", OQ-004 has been broken.
  test("the WAHA transport dials out (WebSocket client), never registers a webhook", async () => {
    const waha = (await sources()).find((s) => s.file === "waha.ts")!.text
    expect(waha).toMatch(/new WebSocket\(/)
    expect(waha).toMatch(/u\.pathname = "\/ws"/)
    // We never hand WAHA a URL to call us back on. Comments are stripped, so this fires
    // only on real webhook wiring — not on the paragraph explaining why there is none.
    expect(waha).not.toMatch(/webhook/i)
  })

  test("the package declares no third-party runtime dependency (RISK-014 containment)", async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(import.meta.dir, "..", "package.json"), "utf8")) as {
      dependencies?: Record<string, string>
    }
    // WAHA-primary's entire supply-chain argument is that Marid pulls NO WhatsApp
    // dependency — the client is fetch + WebSocket against a pinned sidecar image. If a
    // `baileys` (or anything else) ever lands here, that argument is void and RISK-014
    // needs re-scoring first (ADR-0010).
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["@marid/channel-client"])
  })
})
