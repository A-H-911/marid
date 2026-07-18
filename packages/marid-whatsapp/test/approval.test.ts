import { describe, expect, test } from "bun:test"
import { createApprovals, parseApproval } from "../src/approval"

// AC-022 / RISK-021. The approval parser is the one security-critical piece of the
// WhatsApp channel: the reply is untrusted input and the strict matcher IS the
// injection defense (ADR-0015). Every rejection the AC names gets an explicit test.

const JID = "111111111@c.us"
const OTHER = "222222222@c.us"
const TOKEN = "7f3a1c9d"

function approvals(opts?: { now?: () => number; ttlMs?: number; token?: () => string }) {
  return createApprovals({
    now: opts?.now ?? (() => 1_000),
    ttlMs: opts?.ttlMs ?? 300_000,
    token: opts?.token ?? (() => TOKEN),
  })
}

describe("parseApproval — the exact shape, and nothing else", () => {
  test("parses APPROVE <token>", () => {
    expect(parseApproval(`APPROVE ${TOKEN}`)).toEqual({ decision: "approve", token: TOKEN })
  })

  test("parses DENY <token>", () => {
    expect(parseApproval(`DENY ${TOKEN}`)).toEqual({ decision: "deny", token: TOKEN })
  })

  test("is case-normalized in both keyword and token (ADR-0015)", () => {
    expect(parseApproval("approve 7F3A1C9D")).toEqual({ decision: "approve", token: TOKEN })
    expect(parseApproval("ApPrOvE 7f3a1c9d")).toEqual({ decision: "approve", token: TOKEN })
  })

  test("tolerates surrounding whitespace and a double space (phone keyboards)", () => {
    expect(parseApproval(`  APPROVE  ${TOKEN}  `)).toEqual({ decision: "approve", token: TOKEN })
  })

  // The heart of RISK-021: ambiguous affirmatives are NOT authorizations. A model
  // that talks the operator into "yes" has authorized nothing.
  test.each(["yes", "y", "1", "ok", "sure", "approve", "APPROVE", "deny", "yes please"])(
    "rejects ambiguous free text: %p",
    (text) => {
      expect(parseApproval(text)).toBeUndefined()
    },
  )

  // No trailing/leading payload — an injected suffix must not ride along.
  test.each([
    `APPROVE ${TOKEN} please`,
    `please APPROVE ${TOKEN}`,
    `APPROVE ${TOKEN}; DENY ${TOKEN}`,
    `APPROVE ${TOKEN}\nDENY ${TOKEN}`,
    `"APPROVE ${TOKEN}"`,
    `APPROVE ${TOKEN}.`,
  ])("rejects extra content around the reply: %p", (text) => {
    expect(parseApproval(text)).toBeUndefined()
  })

  test.each([
    "APPROVE 7f3a", // too short
    "APPROVE 7f3a1c9dd", // too long
    "APPROVE 7F3A1C9Z", // not hex
    "APPROVE", // no token
    "APPROVE ", // no token
  ])("rejects malformed tokens: %p", (text) => {
    expect(parseApproval(text)).toBeUndefined()
  })
})

describe("redeem — token binding, single-use, TTL", () => {
  test("an issued token redeems once, for the JID it was issued to", () => {
    const a = approvals()
    const token = a.issue("per_1", "ses_1", JID)
    expect(a.pendingCount()).toBe(1)

    expect(a.redeem(`APPROVE ${token}`, JID)).toEqual({
      ok: true,
      permissionID: "per_1",
      sessionID: "ses_1",
      decision: "approve",
    })
    expect(a.pendingCount()).toBe(0)
  })

  test("DENY redeems the same way and carries the deny decision", () => {
    const a = approvals()
    const token = a.issue("per_1", "ses_1", JID)
    expect(a.redeem(`DENY ${token}`, JID)).toMatchObject({ ok: true, decision: "deny" })
  })

  // Single-use: replay / double-send / out-of-order retry all lose.
  test("a token cannot be redeemed twice (replay is refused)", () => {
    const a = approvals()
    const token = a.issue("per_1", "ses_1", JID)
    expect(a.redeem(`APPROVE ${token}`, JID).ok).toBe(true)
    expect(a.redeem(`APPROVE ${token}`, JID)).toEqual({ ok: false, reason: "unknown-token" })
  })

  test("APPROVE-then-DENY: the first reply wins, the second is refused", () => {
    const a = approvals()
    const token = a.issue("per_1", "ses_1", JID)
    expect(a.redeem(`APPROVE ${token}`, JID)).toMatchObject({ ok: true, decision: "approve" })
    expect(a.redeem(`DENY ${token}`, JID)).toEqual({ ok: false, reason: "unknown-token" })
  })

  test("wrong token is refused", () => {
    const a = approvals()
    a.issue("per_1", "ses_1", JID)
    expect(a.redeem("APPROVE deadbeef", JID)).toEqual({ ok: false, reason: "unknown-token" })
  })

  // JID binding: a token leaked into a transcript cannot be spent from another chat.
  test("wrong JID is refused, and does NOT consume the token", () => {
    const a = approvals()
    const token = a.issue("per_1", "ses_1", JID)

    expect(a.redeem(`APPROVE ${token}`, OTHER)).toEqual({ ok: false, reason: "wrong-jid" })
    expect(a.pendingCount()).toBe(1)
    // The rightful sender can still use it — a wrong-JID attempt is not a denial-of-service.
    expect(a.redeem(`APPROVE ${token}`, JID).ok).toBe(true)
  })

  test("expired is refused, and expiry is terminal", () => {
    let clock = 1_000
    const a = approvals({ now: () => clock, ttlMs: 5_000 })
    const token = a.issue("per_1", "ses_1", JID)

    clock = 6_000 // past expiresAt (1_000 + 5_000)
    expect(a.redeem(`APPROVE ${token}`, JID)).toEqual({ ok: false, reason: "expired" })
    // Rewinding the clock must not resurrect it — the entry is gone.
    clock = 1_000
    expect(a.redeem(`APPROVE ${token}`, JID)).toEqual({ ok: false, reason: "unknown-token" })
    expect(a.pendingCount()).toBe(0)
  })

  // expiresAt = 1_000 + 5_000 = 6_000, and the check is `now >= expiresAt`.
  test("a token is live at expiresAt-1", () => {
    let clock = 1_000
    const a = approvals({ now: () => clock, ttlMs: 5_000 })
    const token = a.issue("per_1", "ses_1", JID)
    clock = 5_999
    expect(a.redeem(`APPROVE ${token}`, JID).ok).toBe(true)
  })

  test("a token is expired exactly at expiresAt", () => {
    let clock = 1_000
    const a = approvals({ now: () => clock, ttlMs: 5_000 })
    const token = a.issue("per_1", "ses_1", JID)
    clock = 6_000
    expect(a.redeem(`APPROVE ${token}`, JID)).toEqual({ ok: false, reason: "expired" })
  })

  test("unparsed text is refused without touching pending state", () => {
    const a = approvals()
    a.issue("per_1", "ses_1", JID)
    expect(a.redeem("yes", JID)).toEqual({ ok: false, reason: "unparsed" })
    expect(a.pendingCount()).toBe(1)
  })

  test("drop() removes a pending token (resolved elsewhere / timed out)", () => {
    const a = approvals()
    const token = a.issue("per_1", "ses_1", JID)
    a.drop("per_1")
    expect(a.pendingCount()).toBe(0)
    expect(a.redeem(`APPROVE ${token}`, JID)).toEqual({ ok: false, reason: "unknown-token" })
  })

  test("real tokens are unguessable and distinct (no injected mint)", () => {
    const a = createApprovals({ now: () => 1_000, ttlMs: 300_000 })
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) seen.add(a.issue(`per_${i}`, "ses_1", JID))
    expect(seen.size).toBe(200)
    for (const t of seen) expect(t).toMatch(/^[0-9a-f]{8}$/)
  })
})
