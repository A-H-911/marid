import { describe, expect, test } from "bun:test"
import { createPermissions, type PermissionDeps, type Timer } from "../src/permission"

// WBS-7.4 / AC-022. The exactly-once claim + token-text approval, end to end. approval.ts
// owns the strict-parse matrix (approval.test.ts); this proves the surfacing/claim wiring.

const JID = "111@c.us"

// A controllable timer: nothing fires until we call flush().
function fakeTimers() {
  const cbs: Array<() => void> = []
  const timer: Timer = {
    set(cb) {
      cbs.push(cb)
      return () => {
        const i = cbs.indexOf(cb)
        if (i >= 0) cbs.splice(i, 1)
      }
    },
  }
  return { timer, flush: () => cbs.splice(0).forEach((c) => c()) }
}

function harness(over?: Partial<PermissionDeps>) {
  const sent: Array<{ sessionID: string; text: string }> = []
  const replies: Array<{ sessionID: string; permissionID: string; decision: string }> = []
  const jids = new Map<string, string>([["ses_1", JID]])
  const t = fakeTimers()
  const deps: PermissionDeps = {
    send: async (sessionID, text) => ({ id: `m_${sent.push({ sessionID, text })}` }), // 1st send -> m_1
    reply: async (sessionID, permissionID, decision) => void replies.push({ sessionID, permissionID, decision }),
    jidOf: (s) => jids.get(s),
    now: () => 1_000,
    timers: t.timer,
    timeoutMs: 300_000,
    approvalTtlMs: 300_000,
    log: () => {},
    ...over,
  }
  const permissions = createPermissions(deps)
  return { permissions, sent, replies, flush: t.flush }
}

// Pull the token out of the prompt the operator would see.
function tokenFrom(text: string): string {
  const m = /APPROVE ([0-9a-f]{8})/.exec(text)
  if (!m) throw new Error(`no token in prompt: ${text}`)
  return m[1]
}

describe("onAsk -> onReply happy path", () => {
  test("surfaces a token prompt, and APPROVE <token> approves exactly once", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })

    expect(h.sent).toHaveLength(1)
    expect(h.sent[0].text).toContain("bash")
    const token = tokenFrom(h.sent[0].text)

    const consumed = await h.permissions.onReply(JID, `APPROVE ${token}`)
    expect(consumed).toBe(true)
    expect(h.replies).toEqual([{ sessionID: "ses_1", permissionID: "per_1", decision: "once" }])
    expect(h.permissions.pendingCount()).toBe(0)
  })

  test("DENY <token> rejects", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    const token = tokenFrom(h.sent[0].text)
    await h.permissions.onReply(JID, `DENY ${token}`)
    expect(h.replies[0].decision).toBe("reject")
  })
})

describe("onReply — non-approval text flows on to the agent", () => {
  test("a normal message returns false and is NOT consumed", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    expect(await h.permissions.onReply(JID, "what is the weather")).toBe(false)
  })

  // #13 (EXP-012): a non-approval message while an approval is pending drew no response
  // before. It must be ACKED (the run is suspended) but still NOT swallowed.
  test("during a pending approval, a normal message is acked but still flows on (#13)", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    const before = h.sent.length
    const consumed = await h.permissions.onReply(JID, "what is the weather")
    expect(consumed).toBe(false) // NOT swallowed — flows on to the agent
    expect(h.sent.slice(before).some((m) => /still waiting/i.test(m.text))).toBe(true)
  })

  test("with NO pending approval, a normal message is not acked (#13)", async () => {
    const h = harness()
    const consumed = await h.permissions.onReply(JID, "hello")
    expect(consumed).toBe(false)
    expect(h.sent).toHaveLength(0) // no pending → no ack
  })

  test("a parsed-but-invalid token is consumed and explained, not passed to the agent", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    const consumed = await h.permissions.onReply(JID, "APPROVE deadbeef")
    expect(consumed).toBe(true) // looked like an approval; refused
    expect(h.sent.at(-1)!.text).toMatch(/not recognized/i)
    expect(h.replies).toEqual([]) // nothing authorized
  })

  test("wrong JID cannot approve another chat's pending request", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    const token = tokenFrom(h.sent[0].text)
    const consumed = await h.permissions.onReply("999@c.us", `APPROVE ${token}`)
    expect(consumed).toBe(true) // parsed but wrong-jid
    expect(h.replies).toEqual([]) // NOT approved
    expect(h.permissions.pendingCount()).toBe(1) // token survives for the real owner
  })
})

describe("exactly-once claim", () => {
  test("a second reply after approval loses the race", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    const token = tokenFrom(h.sent[0].text)
    await h.permissions.onReply(JID, `APPROVE ${token}`)
    await h.permissions.onReply(JID, `DENY ${token}`) // token already consumed
    expect(h.replies).toEqual([{ sessionID: "ses_1", permissionID: "per_1", decision: "once" }])
  })

  test("deny wins on timeout, and a late reply cannot flip it", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    const token = tokenFrom(h.sent[0].text)

    h.flush() // timeout fires
    expect(h.replies).toEqual([{ sessionID: "ses_1", permissionID: "per_1", decision: "reject" }])

    await h.permissions.onReply(JID, `APPROVE ${token}`) // too late — dropped on timeout
    expect(h.replies).toHaveLength(1)
  })
})

describe("surfacing guards", () => {
  test("an ask for an unbound session is not surfaced", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_x", sessionID: "ses_unbound", title: "bash" })
    expect(h.sent).toEqual([])
    expect(h.permissions.pendingCount()).toBe(0)
  })

  test("a duplicate ask id is ignored", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    expect(h.sent).toHaveLength(1)
  })

  test("recover re-surfaces pending asks after a restart", async () => {
    const h = harness()
    await h.permissions.recover([{ id: "per_1", sessionID: "ses_1", title: "bash" }])
    expect(h.sent).toHaveLength(1)
    expect(h.permissions.pendingCount()).toBe(1)
  })
})

describe("onReply — reply-quote approval (ADR-0021)", () => {
  test("a 'yes' quoting the prompt approves", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    // The prompt was sent as message m_1 (the harness returns m_<sent-count>).
    const consumed = await h.permissions.onReply(JID, "yes", "m_1")
    expect(consumed).toBe(true)
    expect(h.replies).toEqual([{ sessionID: "ses_1", permissionID: "per_1", decision: "once" }])
  })

  test("a 'no' quoting the prompt denies", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    await h.permissions.onReply(JID, "no", "m_1")
    expect(h.replies[0].decision).toBe("reject")
  })

  // INV-004 — the heart of ADR-0021: a bare "yes" with NO quote is never an authorization.
  test("a non-quoted 'yes' does NOT approve (INV-004)", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    const consumed = await h.permissions.onReply(JID, "yes") // no quotedMsgId
    expect(consumed).toBe(false) // flows on; nothing is authorized
    expect(h.replies).toEqual([])
    expect(h.permissions.pendingCount()).toBe(1) // still pending
  })

  test("a 'yes' quoting the WRONG message does not approve", async () => {
    const h = harness()
    await h.permissions.onAsk({ id: "per_1", sessionID: "ses_1", title: "bash" })
    const consumed = await h.permissions.onReply(JID, "yes", "m_999")
    expect(consumed).toBe(false)
    expect(h.replies).toEqual([])
  })
})
