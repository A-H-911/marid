// EXP-008 spike (throwaway) — proves full bidirectional cross-client mirroring is
// ADDITIVE: it composes the EXISTING, UNMODIFIED marid-auth primitives
// (`filterSseStream` for viewing, `authorize` for acting) with ONE new predicate
// (`isVisible`) fed by a throwaway session<->surface binding registry. Nothing in
// src/ is touched — that is the whole point of the experiment (ADR-0011/0012,
// RISK-019/024, AC-019/024). If this file is green, the production change (WBS-6.3)
// is a one-site predicate swap at middleware.ts:266-267, not a re-architecture.
//
// NOT production wiring. The real registry is durable (like ownership.json) and
// populated by an `/attach` command; here it is an in-memory stub sufficient to
// exercise the visibility/authorization/degradation properties.

import { describe, expect, test } from "bun:test"
import { filterSseStream } from "../src/event-filter"
import { authorize } from "../src/scope"
import type { Scope } from "../src/token"

// ── Test harness (same idiom as event-filter.test.ts) ─────────────────────────
const frame = (type: string, properties: Record<string, unknown>) =>
  `event: message\ndata: ${JSON.stringify({ id: "e", type, properties })}\n\n`

function byteStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}
async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let out = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }
  return out
}

// ── The ONE new piece the production change adds (everything else is reused) ───
// A durable session<->surface binding registry, written by `/attach`. Stubbed here.
interface BindingRegistry {
  boundTo(token: string): ReadonlySet<string>
}
const makeRegistry = (init: Record<string, string[]>): BindingRegistry => {
  const map = new Map(Object.entries(init).map(([t, ids]) => [t, new Set(ids)]))
  return { boundTo: (t) => map.get(t) ?? new Set<string>() }
}

// view-via-binding: a surface sees a session it OWNS or is ATTACHED to. This
// replaces the bare `owns` at the /event filter site (middleware.ts:266-267).
// Fail-closed + degrade-safe: any registry fault collapses to `owns` (today's
// non-mirrored behavior), never a throw — the blast-radius guarantee (RISK-024).
const makeIsVisible =
  (owned: ReadonlySet<string>, registry: BindingRegistry, token: string) =>
  (id: string): boolean => {
    if (owned.has(id)) return true
    return safeBound(registry, token).has(id)
  }
const safeBound = (registry: BindingRegistry, token: string): ReadonlySet<string> => {
  return tryBound(registry, token) ?? new Set<string>()
}
const tryBound = (registry: BindingRegistry, token: string): ReadonlySet<string> | undefined =>
  Result(() => registry.boundTo(token))
// tiny throw->undefined helper (package convention forbids try/catch in src; fine in a spike,
// but keep it uniform): returns the value or undefined on throw.
function Result<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

// ── Scenario ──────────────────────────────────────────────────────────────────
// ses_web  — owned by the Web/API surface (a `client` token).
// ses_tg   — owned by the Telegram channel surface (a `channel:tg` token).
// The operator runs `/attach ses_web` from Telegram: channel is now BOUND to ses_web.
const webOwned = new Set(["ses_web"])
const tgOwned = new Set(["ses_tg"])
const attached = makeRegistry({ "channel:tg": ["ses_web"] }) // tg attached to the web session
const unattached = makeRegistry({}) // nothing attached

describe("EXP-008 · view-via-binding — mirroring is a predicate swap, additive", () => {
  test("an ATTACHED channel surface receives the web session's frames (mirroring works)", async () => {
    const input = frame("server.connected", {}) + frame("message.part.updated", { sessionID: "ses_web" })
    const isVisible = makeIsVisible(tgOwned, attached, "channel:tg")
    const out = await readAll(filterSseStream(byteStream([input]), isVisible))
    expect(out).toContain("server.connected") // infra always passes
    expect(out).toContain("ses_web") // web turn mirrored into the channel
  })

  test("an UNATTACHED channel surface does NOT receive the web session (explicit-attach scope)", async () => {
    const input = frame("message.part.updated", { sessionID: "ses_web" })
    const isVisible = makeIsVisible(tgOwned, unattached, "channel:tg")
    const out = await readAll(filterSseStream(byteStream([input]), isVisible))
    expect(out).not.toContain("ses_web") // a fresh web session must not auto-appear
  })

  test("bidirectional: a surface attached to ses_tg receives the channel's frames too", async () => {
    // A second surface (e.g. a web dashboard token) attaches to the Telegram session.
    const dashOwned = new Set<string>() // owns nothing of its own here
    const dashAttached = makeRegistry({ dash: ["ses_tg"] })
    const input = frame("session.next.text.delta", { sessionID: "ses_tg", delta: "hi" })
    const isVisible = makeIsVisible(dashOwned, dashAttached, "dash")
    const out = await readAll(filterSseStream(byteStream([input]), isVisible))
    expect(out).toContain("ses_tg") // channel turn mirrored into the other surface
  })
})

describe("EXP-008 · act-via-ownership — INV-001 held, no privilege escalation via mirroring", () => {
  const channelScope: Scope = "channel:tg"
  // The channel is ATTACHED to ses_web (can VIEW it) but does NOT own it.
  const owns = (id: string) => tgOwned.has(id)

  test("a bound-but-not-owner channel CANNOT reply to a permission on the web session", () => {
    const decision = authorize({
      scope: channelScope,
      method: "POST",
      pathname: "/session/ses_web/permissions/per_x",
      owns, // acting is gated by OWNERSHIP, unaffected by the binding registry
    })
    expect(decision.allow).toBe(false) // view-via-binding, act-via-ownership
  })

  test("a bound-but-not-owner channel CANNOT prompt the web session", () => {
    const decision = authorize({ scope: channelScope, method: "POST", pathname: "/session/ses_web/prompt_async", owns })
    expect(decision.allow).toBe(false)
  })

  test("the channel CAN still act on the session it actually owns", () => {
    const decision = authorize({ scope: channelScope, method: "POST", pathname: "/session/ses_tg/prompt_async", owns })
    expect(decision.allow).toBe(true)
  })

  test("a bound channel still cannot reach /shell on the bound session (deny-by-default intact)", () => {
    const decision = authorize({ scope: channelScope, method: "POST", pathname: "/session/ses_web/shell", owns })
    expect(decision.allow).toBe(false)
  })
})

describe("EXP-008 · blast-radius — a no-op for plain clients, degrades safely (RISK-024/AC-024)", () => {
  test("with nothing attached, isVisible is byte-identical to owns for every id", () => {
    const owns = (id: string) => webOwned.has(id)
    const isVisible = makeIsVisible(webOwned, unattached, "client")
    for (const id of ["ses_web", "ses_tg", "ses_other", "ses_"]) {
      expect(isVisible(id)).toBe(owns(id)) // plain-client path unchanged
    }
  })

  test("a THROWING registry degrades to non-mirrored (owns-only) behavior, never crashes", async () => {
    const faulty: BindingRegistry = {
      boundTo() {
        throw new Error("registry fault injected")
      },
    }
    const isVisible = makeIsVisible(tgOwned, faulty, "channel:tg")
    // The channel still sees its OWN session; the (unavailable) mirror silently drops.
    expect(isVisible("ses_tg")).toBe(true)
    expect(isVisible("ses_web")).toBe(false)
    // And the SSE filter still runs end-to-end under the fault (auth path unbroken).
    const input = frame("message.part.updated", { sessionID: "ses_tg" }) + frame("message.part.updated", { sessionID: "ses_web" })
    const out = await readAll(filterSseStream(byteStream([input]), isVisible))
    expect(out).toContain("ses_tg")
    expect(out).not.toContain("ses_web")
  })
})

describe("EXP-008 · first-responder-wins — no double-approve across surfaces", () => {
  // Cross-surface permission reply is single-use. Only owners can act (proven above);
  // among owner connections the FIRST reply applies and later ones are no-ops. Model
  // the idempotent guard the production reply path needs (single respond per permission).
  test("a permission is answered exactly once; the second reply is a no-op", () => {
    const answered = new Set<string>()
    const respond = (permissionID: string): "applied" | "ignored" => {
      if (answered.has(permissionID)) return "ignored"
      answered.add(permissionID)
      return "applied"
    }
    expect(respond("per_x")).toBe("applied") // surface A (owner) approves first
    expect(respond("per_x")).toBe("ignored") // surface B's later reply does not double-apply
  })
})
