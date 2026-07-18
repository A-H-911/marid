import { createApprovals, type Decision } from "./approval"

// Permission surfacing for WhatsApp (WBS-7.4, AC-022, ADR-0015).
//
// This is the WhatsApp analogue of marid-telegram/permission.ts, and it keeps that
// module's ONE load-bearing property — the exactly-once claim — while replacing its
// interactive-keyboard mechanism with a token-bound text reply (approval.ts), because
// WhatsApp buttons are dead (ADR-0015).
//
// The claim discipline is preserved verbatim in spirit: a pending ask is resolved by
// exactly one of {operator APPROVE, operator DENY, timeout-deny}. approval.ts.redeem()
// consumes the token synchronously (single-use), and resolve() here deletes the pending
// entry before any await, so a double reply / late reply / post-restart redelivery all
// lose the race. Deny wins on timeout.
//
// The reply is UNTRUSTED (INV-001/INV-004): approval.ts is the strict parser, and this
// module never interprets free text. It also never decides SCOPE — it calls the server's
// ownership-gated reply route, and the server re-checks what the permission allows
// (act-via-ownership, ADR-0012).

export interface Timer {
  set(callback: () => void, ms: number): () => void // returns a cancel function
}

export interface PermissionAsk {
  id: string
  sessionID: string
  title?: string
}

export interface PermissionDeps {
  // Send the prompt text to the operator's chat for a session; returns nothing.
  send(sessionID: string, text: string): Promise<void>
  // The ownership-gated server reply (POST /session/:id/permissions/:pid).
  reply(sessionID: string, permissionID: string, decision: "once" | "reject"): Promise<void>
  // The JID bound to a session's chat — the sender a token is issued to.
  jidOf(sessionID: string): string | undefined
  now(): number
  timers: Timer
  timeoutMs: number
  approvalTtlMs: number
  log: (line: string) => void
}

export interface Permissions {
  onAsk(ask: PermissionAsk): Promise<void>
  // Feed EVERY inbound text from an allowlisted sender here first. Returns true if the
  // text was a valid approval reply (and was consumed) — the caller then does NOT treat
  // it as a prompt. Returns false for anything else, which flows on to the agent.
  onReply(jid: string, text: string): Promise<boolean>
  recover(asks: PermissionAsk[]): Promise<void>
  pendingCount(): number
}

interface Pending {
  permissionID: string
  sessionID: string
  cancel: () => void
  claimed: boolean
}

function promptText(title: string | undefined, token: string): string {
  const tool = title ?? "a tool"
  // Plain text, no markup: the tool name is untrusted model output (same reasoning as
  // the Telegram askText). The token is what authorizes; the words are just instructions
  // to the human.
  return `The agent needs approval to run: ${tool}\nReply  APPROVE ${token}  or  DENY ${token}`
}

export function createPermissions(deps: PermissionDeps): Permissions {
  const approvals = createApprovals({ now: deps.now, ttlMs: deps.approvalTtlMs })
  const pending = new Map<string, Pending>() // permissionID -> entry

  async function resolve(permissionID: string, decision: Decision, note: string): Promise<boolean> {
    const p = pending.get(permissionID)
    if (!p || p.claimed) return false
    p.claimed = true // claim BEFORE any await — exactly-once (same as Telegram permission.ts)
    p.cancel()
    pending.delete(permissionID)
    approvals.drop(permissionID)
    await deps.reply(p.sessionID, permissionID, decision === "approve" ? "once" : "reject").catch((e: unknown) => {
      deps.log(`permission ${permissionID}: server reply failed: ${e instanceof Error ? e.message : String(e)}`)
    })
    const jid = deps.jidOf(p.sessionID)
    if (jid) await deps.send(p.sessionID, note).catch(() => {})
    return true
  }

  async function onAsk(ask: PermissionAsk): Promise<void> {
    if (pending.has(ask.id)) return
    const jid = deps.jidOf(ask.sessionID)
    if (jid === undefined) {
      deps.log(`permission ${ask.id}: no chat bound to session ${ask.sessionID}; not surfaced`)
      return
    }
    const token = approvals.issue(ask.id, ask.sessionID, jid)
    const entry: Pending = { permissionID: ask.id, sessionID: ask.sessionID, claimed: false, cancel: () => {} }
    pending.set(ask.id, entry)
    await deps.send(ask.sessionID, promptText(ask.title, token)).catch((e: unknown) => {
      deps.log(`permission ${ask.id}: send failed: ${e instanceof Error ? e.message : String(e)}`)
    })
    if (!pending.has(ask.id)) return // resolved while sending
    // Deny wins on timeout: an unanswered prompt is rejected after timeoutMs.
    entry.cancel = deps.timers.set(() => void resolve(ask.id, "deny", "Timed out — denied"), deps.timeoutMs)
  }

  async function onReply(jid: string, text: string): Promise<boolean> {
    const redeemed = approvals.redeem(text, jid)
    if (!redeemed.ok) {
      // unparsed = not an approval attempt at all -> flows on to the agent as a normal
      // message. A parsed-but-refused reply (wrong/expired/wrong-jid token) is NOT a
      // prompt either, but we surface why so the operator isn't left guessing.
      if (redeemed.reason !== "unparsed") {
        await deps.send(jid, refusalNote(redeemed.reason)).catch(() => {})
        return true // consumed: it looked like an approval, just an invalid one
      }
      return false
    }
    const note = redeemed.decision === "approve" ? "Approved." : "Denied."
    await resolve(redeemed.permissionID, redeemed.decision, note)
    return true
  }

  async function recover(asks: PermissionAsk[]): Promise<void> {
    for (const ask of asks) if (!pending.has(ask.id)) await onAsk(ask)
  }

  return { onAsk, onReply, recover, pendingCount: () => pending.size }
}

function refusalNote(reason: "unknown-token" | "wrong-jid" | "expired"): string {
  if (reason === "expired") return "That approval has expired. The request was denied."
  if (reason === "wrong-jid") return "That approval token is not valid for this chat."
  return "That approval token is not recognized."
}
