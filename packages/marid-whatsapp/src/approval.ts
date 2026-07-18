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
  // The ONLY way an inbound reply becomes an authorization.
  redeem(text: string, jid: string): Redeemed | Refused
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

  function drop(permissionID: string): void {
    for (const [token, p] of pending) if (p.permissionID === permissionID) pending.delete(token)
  }

  return { issue, redeem, drop, pendingCount: () => pending.size }
}
