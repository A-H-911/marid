---
id: ADR-0015
status: Approved
version: 1.0.1
updated: 2026-07-17
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0015 — WhatsApp permission-approval UX: token-bound text reply (not buttons)

**Status:** **Approved (2026-07-10 operator PH-7 gate)** · relates to FR-028/049/052, INV-001, INV-004, RISK-003/021, DEC-021, ADR-0010,
ADR-0012 (cross-surface permission), ADR-0005, [C-14](../architecture/technology-comparison.md),
[R-12](../research/findings/whatsapp-options.md).

> **Amended 2026-07-20 by [ADR-0021](adr-0021-whatsapp-reply-quote-approval.md).** After the
> [EXP-012](../experiments/exp-012-runbook.md) live probe (operator feedback: the 8-hex token is unfriendly),
> the **primary** approval UX becomes **reply-quote** ("yes"/"no" quoting the prompt — the quote is the binding).
> This token-text flow is **retained as the fallback** and remains the **shipped behaviour until ADR-0021 is
> implemented**. The security model here (single-use / TTL / JID-bound / server re-check / no-NLP) is unchanged.

> **Fact correction (2026-07-17, design unchanged).** The "**list messages** exist only on WAHA Plus (paid)"
> premise below is **stale**: WAHA collapsed **Plus → Core (free) on 2026-06-21** (v2026.6.1), so lists are no
> longer a paid feature. This **does not change the decision** — the reason lists/buttons are rejected is
> **client-render reliability** (a security-critical gate must not hinge on a UI element that can silently
> fail to render on the approver's client), **not** price. The shipped adapter uses `APPROVE <token>` text.

**Context.** On Telegram, a channel permission prompt is an **inline keyboard** (tap Approve/Deny). On **unofficial
WhatsApp this is not available**: interactive **buttons are deprecated/broken** on the Web-MD protocol (Meta pushed
them to the Cloud API; Baileys open bug #2465 + a long history of button breakage; WAHA maintainer calls buttons
"fragile… use polls/text"); **list messages** exist only on **WAHA Plus (paid, NOWEB/GOWS)** and are "relatively"
stable but still ride the reverse-engineered protocol. A **permission gate is security-critical** and must not
depend on a UI element that can silently fail to render on the approver's client.

**Decision.** WhatsApp permission approval is a **token-bound text-reply flow**, server-enforced:

1. **Prompt.** The gateway sends a plain message carrying an **unguessable request token**, e.g.:
   `Approve tool "deploy" (scope=prod)? Reply:  APPROVE 7f3a   or   DENY 7f3a`.
2. **Reply.** The operator replies with the exact keyword + token: `APPROVE 7f3a`.
3. **Strict server-side parsing (INV-001, INV-004 — the reply is untrusted input).** Match **exactly**
   `APPROVE <token>` / `DENY <token>` (case-normalized); the token must correspond to a **live pending request bound
   to that sender JID**, be **single-use**, and within a **short TTL**. Anything ambiguous (bare "yes"/"1", wrong
   token, wrong JID, expired, out-of-order) is **rejected**. **No NLP / no free-text interpretation** — the strict
   matcher IS the injection defense. The message only **authorizes**; the **server independently re-checks scope**
   before acting (it never lets the reply define scope).
4. **Cross-surface (ADR-0012).** This preserves **view-via-binding, act-via-ownership**: a WhatsApp surface can
   approve only for sessions it **owns**; first-responder-wins across bound surfaces; no double-approve. A
   mirrored high-scope session's permission is **not** approvable from a low-scope WhatsApp channel.
5. **Optional convenience (not a dependency).** On WAHA Plus, the gateway MAY *additionally* send a **list message**
   whose rows emit the same `APPROVE <token>` text — but the **text-reply path must remain fully sufficient**
   (lists can fail to render). **Buttons are not used.** Polls rejected (no per-option token binding, hard to make
   single-use).

**Consequences.** A reliable, injection-resistant approval UX that does not depend on fragile WhatsApp interactive
UI; INV-001 held by strict parsing + server-side scope re-check + ownership gating. The one security-critical piece
(the approval parser) gets a focused unit test (exact-match, wrong-token, wrong-JID, expired all → rejected).
Realized in PH-7 (WBS-7.4); the same token-text pattern is a portable fallback for any future channel lacking
reliable buttons. UX is slightly less slick than a tap, accepted for security + reliability.

**Rejected.** (1) **Baileys/WAHA interactive buttons** — deprecated/broken, would need risky forks. (2) **WAHA-Plus
lists as the primary** — paid, engine-restricted, only relatively stable; permission must not hinge on it. (3)
**Free-text "yes/no" without a token** — ambiguous, replayable, injection-prone. (4) **Polls** — awkward to bind a
single-use token per option.
