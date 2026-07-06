import { describe, expect, test } from "bun:test"
import { createPermissions, type PermissionDeps } from "../src/permission"

// AC-012: a policy-gated tool surfaces as an inline keyboard; Approve allows exactly
// once, Deny blocks, and a timeout denies. Every resolution path is checked for the
// exactly-once claim (no double server reply) under button-mashing and restart.

interface Sent {
  chatId: number
  text: string
  messageId: number
  hasKeyboard: boolean
}
interface Edit {
  messageId: number
  text: string
}

function harness(opts?: { chatOf?: (s: string) => number | undefined }) {
  const sent: Sent[] = []
  const edits: Edit[] = []
  const acks: string[] = []
  const replies: Array<{ sessionID: string; permissionID: string; decision: string }> = []
  const timers: Array<() => void> = []
  let nextMessageId = 1000

  const deps: PermissionDeps = {
    bot: {
      sendMessage: async (chatId, text, o) => {
        const messageId = ++nextMessageId
        sent.push({ chatId, text, messageId, hasKeyboard: Boolean(o?.reply_markup) })
        return { message_id: messageId, chat: { id: chatId, type: "private" } }
      },
      editMessageText: async (_chatId, messageId, text) => void edits.push({ messageId, text }),
      answerCallbackQuery: async (_id, text) => void acks.push(text ?? ""),
    },
    reply: async (sessionID, permissionID, decision) => void replies.push({ sessionID, permissionID, decision }),
    chatOf: opts?.chatOf ?? (() => 42),
    timers: { set: (cb) => (timers.push(cb), () => {}) },
    timeoutMs: 60_000,
    log: () => {},
  }
  const fireTimeout = () => timers.forEach((cb) => cb())
  return { deps, sent, edits, acks, replies, fireTimeout, perms: createPermissions(deps) }
}

const ask = (id = "per_1", sessionID = "ses_1") => ({ id, sessionID, title: "bash: rm -rf" })

describe("createPermissions (AC-012)", () => {
  test("an ask renders exactly one keyboard message in the bound chat", async () => {
    const h = harness()
    await h.perms.onAsk(ask())
    expect(h.sent).toHaveLength(1)
    expect(h.sent[0]!.chatId).toBe(42)
    expect(h.sent[0]!.hasKeyboard).toBe(true)
    expect(h.perms.pendingCount()).toBe(1)
  })

  test("Approve replies once with 'once' and clears the prompt", async () => {
    const h = harness()
    await h.perms.onAsk(ask())
    await h.perms.onCallback({ id: "cq1", data: "p:per_1:a" })
    expect(h.replies).toEqual([{ sessionID: "ses_1", permissionID: "per_1", decision: "once" }])
    expect(h.acks.at(-1)).toContain("Approved")
    expect(h.edits.at(-1)!.text).toContain("Approved")
    expect(h.perms.pendingCount()).toBe(0)
  })

  test("Deny replies once with 'reject'", async () => {
    const h = harness()
    await h.perms.onAsk(ask())
    await h.perms.onCallback({ id: "cq1", data: "p:per_1:d" })
    expect(h.replies).toEqual([{ sessionID: "ses_1", permissionID: "per_1", decision: "reject" }])
  })

  test("timeout denies (deny wins) with exactly one reply", async () => {
    const h = harness()
    await h.perms.onAsk(ask())
    h.fireTimeout()
    await Promise.resolve() // let the timeout's async resolve settle
    await Promise.resolve()
    expect(h.replies).toEqual([{ sessionID: "ses_1", permissionID: "per_1", decision: "reject" }])
  })

  test("double-tap (Approve then Deny) yields exactly ONE server reply", async () => {
    const h = harness()
    await h.perms.onAsk(ask())
    await Promise.all([
      h.perms.onCallback({ id: "cq1", data: "p:per_1:a" }),
      h.perms.onCallback({ id: "cq2", data: "p:per_1:d" }),
    ])
    expect(h.replies).toHaveLength(1)
    expect(h.replies[0]!.decision).toBe("once") // first press wins
    expect(h.acks).toContain("Already handled")
  })

  test("a callback arriving AFTER the timeout does not double-reply", async () => {
    const h = harness()
    await h.perms.onAsk(ask())
    h.fireTimeout()
    await Promise.resolve()
    await h.perms.onCallback({ id: "cq1", data: "p:per_1:a" }) // late approve
    expect(h.replies).toHaveLength(1)
    expect(h.replies[0]!.decision).toBe("reject") // timeout already denied
    expect(h.acks.at(-1)).toContain("Already handled")
  })

  test("an unrecognized callback is acked but never replies", async () => {
    const h = harness()
    await h.perms.onAsk(ask())
    await h.perms.onCallback({ id: "cq1", data: "garbage" })
    await h.perms.onCallback({ id: "cq2" })
    expect(h.replies).toHaveLength(0)
    expect(h.perms.pendingCount()).toBe(1) // still pending
  })

  test("an ask for a session with no bound chat is dropped (not surfaced)", async () => {
    const h = harness({ chatOf: () => undefined })
    await h.perms.onAsk(ask())
    expect(h.sent).toHaveLength(0)
    expect(h.perms.pendingCount()).toBe(0)
  })

  test("recover re-renders keyboards for still-pending asks after a restart", async () => {
    const h = harness()
    await h.perms.recover([ask("per_7"), ask("per_8")])
    expect(h.sent).toHaveLength(2)
    expect(h.perms.pendingCount()).toBe(2)
    // a press on a recovered ask still resolves exactly once
    await h.perms.onCallback({ id: "cq", data: "p:per_7:a" })
    expect(h.replies).toEqual([{ sessionID: "ses_1", permissionID: "per_7", decision: "once" }])
  })
})
