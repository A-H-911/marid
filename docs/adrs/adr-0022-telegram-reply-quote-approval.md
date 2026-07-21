---
id: ADR-0022
status: Proposed
version: 1.0.0
updated: 2026-07-21
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0022 — Telegram reply-quote approval + pending-ack (parity with WhatsApp; additive to buttons)

**Status:** **Proposed (2026-07-21, operator-directed)** — the operator selected "port both #13 and ADR-0021 to
Telegram." Implemented in the same change (marid-telegram `permission.ts`/`gateway.ts`/`telegram.ts` + tests);
reconcile to **Accepted** on operator merge (INV-005). Relates to INV-001, INV-004,
[ADR-0021](adr-0021-whatsapp-reply-quote-approval.md) (the WhatsApp analogue), AC-012 (Telegram inline-keyboard
approval), issue #13 (pending-approval ack).

**Context.** Telegram and WhatsApp approve permissions differently, for a good reason:

- **WhatsApp** (ADR-0015/ADR-0021) has **no reliable buttons** on the NOWEB transport, so approval is a text reply —
  first `APPROVE <token>`, now primarily a **reply-quote** (`redeemQuote`) with the token retained as fallback.
- **Telegram** (AC-012) has **working inline keyboards**: the prompt carries an Approve/Deny `reply_markup`, and a tap
  arrives as a `callback_query`. Buttons are the **primary, safer, one-tap** UX and are *not* going away.

Two WhatsApp behaviours landed there only (PRs #88/#89) and have no Telegram equivalent:

- **#13 — pending-approval ack.** With an approval pending, the run is suspended on the gate; a non-approval message
  gets no response. WhatsApp acks it ("still waiting…"). Telegram had no ack — though the on-screen buttons make the
  gap milder than WhatsApp's token-only prompt.
- **ADR-0021 — reply-quote approval.** Approve by quote-replying the prompt with `yes`/`no`.

**Decision.** Add both to Telegram as an **additive** layer; **inline buttons remain the primary path.**

1. **Reply-quote is secondary, not a replacement.** The operator may tap Approve/Deny **or** quote-reply the prompt with
   `yes`/`no` (`approve`/`deny`). The **binding is the quoted `reply_to_message.message_id`** matched against a live
   pending prompt in the **same chat**. Buttons stay; the token machinery WhatsApp retains is **not** ported — Telegram
   never had a token, and buttons + quote already cover it.
2. **Security is preserved, not weakened.** The relaxed `yes/no` grammar is reachable **only** with a quoted id that
   matches a live prompt bound to that chat — a **non-quoted** "yes" never authorizes (INV-004, identical to WhatsApp
   `redeemQuote`). The sender is already operator-allowlisted; `resolve()` keeps the **exactly-once** claim shared with
   the buttons and the timeout-deny; the server independently re-checks scope.
3. **The new seam must be gateway-gated.** This introduces an **inbound-text → approval** path Telegram did not have
   (text previously only ever reached `session.prompt`). The load-bearing guarantee — *a message consumed as an approval
   reply is NOT also forwarded to the agent* — lives in gateway wiring (`onMessage`: `if (await onReply(...)) return`)
   and is proven by a `gateway-integration.test.ts` boundary case, not just the `permission.ts` return contract.
4. **#13 ack.** A non-approval message while an approval is pending in that chat is acked ("tap ✅/🚫 above") and **flows
   on** to the agent (the ack never consumes the message and never approves).

**Consequences.** Telegram reaches approval-UX parity with WhatsApp at low cost (one `reply_to_message` field, an
`onReply` method reusing the existing `pending` map + `resolve()`, one gateway call). The `yes/no` regexes are
**duplicated** locally from `marid-whatsapp/src/approval.ts` rather than shared — extracting ~2 regexes would couple two
sibling channel packages for no real gain. The permission unit matrix extends to the quote path (approve/deny,
chat-bound refusal, non-quote-never-approves, exactly-once across button+quote and quote+timeout).

**Rejected.** (1) **Port WhatsApp's token flow** — Telegram has buttons; a token adds nothing. (2) **Extract the grammar
to `channel-client`** — sibling-package coupling + scope-creep edits into a working package. (3) **Bare "yes/no" without a
quote** — the INV-004 injection case, kept rejected. (4) **Skip #13 on Telegram** — considered (buttons stay visible),
but an operator who *types* instead of tapping still gets silence, so the ack has real value.
