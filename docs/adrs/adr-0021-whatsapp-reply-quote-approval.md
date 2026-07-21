---
id: ADR-0021
status: Approved
version: 1.1.0
updated: 2026-07-21
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0021 — Reply-quote as the primary WhatsApp approval UX (amends ADR-0015)

**Status:** **Approved (2026-07-20, operator confirm) · Implemented 2026-07-21 (PR #89)** — post-[EXP-012](../experiments/exp-012-runbook.md)
live burner probe. Reply-quote is now the **live primary** approval UX (`redeemQuote`/`bindPrompt` in `approval.ts`,
quoted-id read in `waha.ts interpretFrame`, security-reviewed — the non-quoted-"yes"-rejects invariant is tested).
**Amends [ADR-0015](adr-0015-whatsapp-permission-ux.md)** (does not supersede it — the token flow is
retained as the fallback). Relates to INV-001, INV-004,
[ADR-0010](adr-0010-whatsapp-adapter.md), [ADR-0012](adr-0012-cross-surface-mirroring.md),
[channel live-test scenarios F4](../validation/channel-live-test-scenarios.md).

**Context.** ADR-0015 chose `APPROVE <token>` text because WhatsApp interactive **buttons are unreliable on the
unofficial NOWEB protocol** (Cloud-API only). The 2026-07-20 live probe confirmed the token flow is **secure** — DENY,
reused-token, expired-TTL, wrong-token and bare "yes" were all correctly rejected — but the 8-hex token is **clunky**
(operator feedback, F4). Re-evaluating friendlier options against the **actual NOWEB transport** (not docs prose):

- **Buttons** — official WhatsApp Business Cloud API only; deprecated/broken on NOWEB. Still rejected (ADR-0015).
- **Reactions / polls** — WAHA NOWEB *models* them on the stored message, but the gateway WS subscribes to only
  `["message","session.status"]`, so they are **not delivered as live events** today (verified live: C10 — an inbound
  reaction never reached the gateway; polls additionally need vote decryption). Not viable without new event wiring.
- **Reply-quote** — the WhatsApp reply/quote context (`contextInfo`/`reply_to`) rides **inside the message frame the
  gateway already receives**. The adapter doesn't surface it yet (verified live: C11 — a quoted reply reached the agent
  **without** its quoted context; `InboundMessage` has no quoted field), but it is the **smallest change on the same
  event seam**.

**Decision.** The **primary** WhatsApp approval UX becomes **reply-quote**: the operator **quote-replies the approval
prompt** with `yes`/`no` (or `approve`/`deny`). The **binding comes from the quoted message-id**, not a typed token.

1. **Fallback retained.** `APPROVE <token>` / `DENY <token>` stays available — it disambiguates **multiple pending
   approvals** and works where a client can't quote. ADR-0015's token flow is unchanged as the fallback.
2. **Security is preserved, not weakened.** A quote-reply is an **unforgeable binding**: the reply must reference the
   exact prompt message, and the sender is already JID-bound to the operator. The server keeps the other properties
   from ADR-0015 — **single-use, short TTL, JID-bound**, and it **independently re-checks scope** before acting.
3. **Why this is NOT ADR-0015's rejected "free-text yes/no".** ADR-0015 rejected bare "yes/no" as *ambiguous,
   replayable, injection-prone*. The **quote reference supplies exactly the binding the bare form lacked**: a
   **non-quoted** "yes" stays **rejected** (so a prompt-injection in untrusted content — e.g. a file containing
   `APPROVE abc123` — still cannot approve, because it cannot quote a WhatsApp message the operator saw). This is the
   INV-004 defense, kept intact.
4. **Authorization stays server-side.** A handler may parse the *reply/reaction signal*, but the **LLM must never
   decide approval** — NLP interpretation would reopen the INV-004 hole.

**Consequences.** Friendlier one-swipe approval without a fragile UI element. **Requires adapter work** (surface
`contextInfo`/`reply_to` on `InboundMessage`; match the quoted message-id to the pending request), implemented later
via a **TDD → review → PR** cycle; until it ships, the ADR-0015 token flow is the live behaviour. **Emoji-reaction
👍/👎** is a possible **Phase-2** *iff* live reaction-event delivery is verified on the pinned image. The approval
parser's unit matrix (exact-match / wrong-token / wrong-JID / expired) extends to cover the quote-match path.

**Rejected.** (1) **Buttons** — Cloud-API only, unreliable on NOWEB. (2) **Polls** — encrypted votes, separate event,
awkward to bind a single-use approval to a binary choice. (3) **Reactions now** — live-event delivery unverified on the
transport. (4) **Bare "yes/no" without a quote** — the ADR-0015 injection case, unchanged. (5) **Agent/LLM NLP
approval** — reintroduces the INV-004 vector.
