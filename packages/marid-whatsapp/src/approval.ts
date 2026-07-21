import crypto from "node:crypto"

// Token-bound text-reply permission approval (WBS-7.4, AC-022, ADR-0015, RISK-021).
//
// WhatsApp has no usable interactive UI: buttons are deprecated/broken on the Web-MD
// protocol and list messages ride the same reverse-engineered path and can silently
// fail to render. A permission gate is security-critical and must not depend on a UI
// element that may never appear on the approver's client — so approval is a PLAIN TEXT
// reply carrying an unguessable token:
//
//   Approve tool "bash" (scope=...)?  Reply:  APPROVE 7f3a1c9d   or   DENY 7f3a1c9d
//
// The inbound reply is UNTRUSTED input (INV-001, INV-004): it arrives over a channel
// whose content may be shaped by the model's own output (indirect prompt injection).
// The defenses, in order:
//
//   1. STRICT EXACT MATCH — `APPROVE <token>` / `DENY <token>`, nothing else. No NLP,
//      no free-text interpretation, no "yes"/"1"/"ok". THE STRICT MATCHER IS THE
//      INJECTION DEFENSE: anything a model could talk the operator into typing that
//      isn't this exact shape is simply not an authorization.
//   2. JID-BOUND — the token only redeems for the sender it was issued to. A token
//      leaked into a transcript cannot be spent from another chat.
//   3. SINGLE-USE — redeeming consumes the token (claimed synchronously, before any
//      await), so a double-send / replay / out-of-order retry loses the race.
//   4. SHORT TTL — an unanswered prompt expires; expiry is a rejection, not a pass.
//
// This module only decides "is this text a valid AUTHORIZATION from this JID?". It
// never decides SCOPE: the server independently re-checks what the permission allows
// (act-via-ownership, ADR-0012). The reply authorizes; it never defines.

export type Decision = "approve" | "deny"

// Why a rejection was refused. Returned (not thrown) so the caller can audit every
// refusal, and so the unit tests can assert the exact reason rather than a bare false.
export type RejectReason =
  | "unparsed" // not the exact APPROVE/DENY <token> shape
  | "unknown-token" // no live pending request for that token
  | "wrong-jid" // token exists but was issued to a different sender
  | "expired" // past its TTL

export interface ParsedApproval {
  decision: Decision
  token: string
}

export interface Redeemed {
  ok: true
  permissionID: string
  sessionID: string
  decision: Decision
}

export interface Refused {
  ok: false
  reason: RejectReason
}

export interface Approvals {
  // Mint a token for a pending permission, bound to one sender.
  issue(permissionID: string, sessionID: string, jid: string): string
  // Record the outbound prompt's WhatsApp message-id so a quote-reply can bind to it (ADR-0021).
  bindPrompt(permissionID: string, promptMsgId: string): void
  // The token path: `APPROVE <token>` / `DENY <token>` (ADR-0015). Kept as the fallback.
  redeem(text: string, jid: string): Redeemed | Refused
  // ADR-0021: a quote-reply (yes/no/approve/deny) whose quoted id matches a pending prompt.
  // The QUOTE is the binding — unforgeable, it references the exact prompt the operator saw —
  // which is why a relaxed yes/no is safe HERE but never as bare free text (INV-004). Same
  // JID-bound / TTL / single-use guarantees as redeem(); a non-quoted message never reaches
  // this path (the caller only calls it with a real quoted id).
  redeemQuote(text: string, jid: string, quotedMsgId: string): Redeemed | Refused
  // Drop a pending token (resolved elsewhere: timeout, another surface, restart).
  drop(permissionID: string): void
  pendingCount(): number
}

export interface ApprovalsDeps {
  now(): number
  ttlMs: number
  // Injected only so tests get deterministic tokens; production uses real entropy.
  token?(): string
}

// 8 lowercase hex = 32 bits. Unguessable in the threat model that matters: the sender
// is already allowlisted (deny-by-default), the token is JID-bound, single-use, and
// TTL'd, so this defends against injection/replay rather than an online brute force.
// Long enough to be safe, short enough to retype on a phone.
const TOKEN_BYTES = 4

// Strict by construction. Anchored, one keyword, one token, nothing else.
// `\s+` (not a single literal space) is the ONE concession: a phone keyboard may send
// a double space, and that is a typing artifact, not an ambiguity — the token itself
// still has to match exactly. Leading/trailing whitespace is trimmed for the same
// reason. Everything else — extra words, punctuation, a bare "yes" — is unparsed.
const REPLY = /^(approve|deny)\s+([0-9a-f]{8})$/

export function parseApproval(text: string): ParsedApproval | undefined {
  // Case-normalized (ADR-0015): "Approve 7F3A1C9D" is the same authorization as
  // "approve 7f3a1c9d". Normalizing the token too keeps the map lookup exact.
  const m = REPLY.exec(text.trim().toLowerCase())
  if (!m) return undefined
  return { decision: m[1] === "approve" ? "approve" : "deny", token: m[2] }
}

interface Pending {
  permissionID: string
  sessionID: string
  jid: string
  expiresAt: number
  promptMsgId?: string // the outbound prompt's WhatsApp id, for ADR-0021 quote-matching
}

// ADR-0021 quote-reply grammar. RELAXED (approve/yes/y/ok/👍 · deny/no/n/👎) because the
// binding is the QUOTE, not a secret token. This parser is only ever reached WITH a quoted
// message-id that matches a live prompt, so a bare "yes" (no quote) never authorizes anything
// — the ADR-0015 injection defense is intact.
const QUOTE_APPROVE = /^(approve|yes|y|ok|👍)$/
const QUOTE_DENY = /^(deny|no|n|👎)$/
export function parseQuoteReply(text: string): Decision | undefined {
  const t = text.trim().toLowerCase()
  if (QUOTE_APPROVE.test(t)) return "approve"
  if (QUOTE_DENY.test(t)) return "deny"
  return undefined
}

export function createApprovals(deps: ApprovalsDeps): Approvals {
  // token -> pending. Keyed by token (not permissionID) because redeem() starts from
  // the token; drop() walks the small map, which is bounded by the number of prompts
  // in flight (one operator, TTL'd) — ponytail: linear scan, index it if that changes.
  const pending = new Map<string, Pending>()
  const mint = deps.token ?? (() => crypto.randomBytes(TOKEN_BYTES).toString("hex"))

  function issue(permissionID: string, sessionID: string, jid: string): string {
    const token = mint()
    pending.set(token, { permissionID, sessionID, jid, expiresAt: deps.now() + deps.ttlMs })
    return token
  }

  function redeem(text: string, jid: string): Redeemed | Refused {
    const parsed = parseApproval(text)
    if (!parsed) return { ok: false, reason: "unparsed" }
    const p = pending.get(parsed.token)
    if (!p) return { ok: false, reason: "unknown-token" }
    // JID check BEFORE expiry so a token spent from the wrong chat reports the real
    // problem, and so a wrong-JID attempt can never consume someone else's token.
    if (p.jid !== jid) return { ok: false, reason: "wrong-jid" }
    if (deps.now() >= p.expiresAt) {
      pending.delete(parsed.token) // expired is terminal — never redeemable later
      return { ok: false, reason: "expired" }
    }
    // Single-use: consume synchronously, before returning and before any caller await.
    // JS is single-threaded, so this delete IS the atomic claim — a second redeem of
    // the same token cannot observe it.
    pending.delete(parsed.token)
    return { ok: true, permissionID: p.permissionID, sessionID: p.sessionID, decision: parsed.decision }
  }

  function bindPrompt(permissionID: string, promptMsgId: string): void {
    for (const p of pending.values())
      if (p.permissionID === permissionID) {
        p.promptMsgId = promptMsgId
        break // one pending entry per permissionID (onAsk guards duplicates); stop at the first
      }
  }

  function redeemQuote(text: string, jid: string, quotedMsgId: string): Redeemed | Refused {
    const decision = parseQuoteReply(text)
    if (!decision) return { ok: false, reason: "unparsed" }
    // Find the pending prompt this quote references. Scan is bounded by prompts-in-flight.
    let hit: [string, Pending] | undefined
    for (const entry of pending) {
      if (entry[1].promptMsgId === quotedMsgId) {
        hit = entry
        break
      }
    }
    if (!hit) return { ok: false, reason: "unknown-token" }
    const [token, p] = hit
    // Same discipline as redeem(): JID-bound BEFORE expiry, expiry terminal, single-use claim
    // synchronously before any await. The quoted-id match replaces the token secret; every
    // other guarantee is identical.
    if (p.jid !== jid) return { ok: false, reason: "wrong-jid" }
    if (deps.now() >= p.expiresAt) {
      pending.delete(token)
      return { ok: false, reason: "expired" }
    }
    pending.delete(token)
    return { ok: true, permissionID: p.permissionID, sessionID: p.sessionID, decision }
  }

  function drop(permissionID: string): void {
    for (const [token, p] of pending) if (p.permissionID === permissionID) pending.delete(token)
  }

  return { issue, bindPrompt, redeem, redeemQuote, drop, pendingCount: () => pending.size }
}
