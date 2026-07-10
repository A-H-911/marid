---
id: ADR-0009
status: Approved
version: 1.1.0
updated: 2026-07-10
supersedes: ADR-0008
superseded_by: none
owner: operator (STK-001)
---

# ADR-0009 — Telegram channel remediation: fix in place, not fork

**Status:** **Approved (2026-07-10 operator PH-6 gate)** · **supersedes [ADR-0008](adr-0008-telegram-gateway-fork.md)**
(fix-in-place replaces the fork direction; ADR-0005 still holds; EXP-005 validates at build) · relates to FR-036, FR-043,
FR-048, FR-049, INV-001, INV-002, DEC-009 (reuse-first), DEC-014, [deferred-work #8/#9](../execution/deferred-work-register.md),
[C-8](../architecture/technology-comparison.md), [R-11 findings](../research/findings/telegram-options.md).

**Amended 2026-07-10 (scope expansion, still fix-in-place).** Per operator directive, PH-6 grows the goal from
"fix the five defects" to the **full Telegram experience** (send/receive messages **and files** both ways,
**whitelisted slash commands**, inline keyboards, zero-bug bar), built on the new **`@marid/channel-client`**
foundation (ADR-0011) and participating in **cross-client mirroring** (ADR-0012). Approach is unchanged
(fix-in-place, `telegramify-markdown`), just wider. **SDK reconciliation:** the gateway imports
`@opencode-ai/sdk/v2` (the v2 SDK client talking the committed v1 routes) — this ADR's earlier "v1 SDK" wording
in ADR-0008 is imprecise; Marid is on the v2 SDK client. Test strategy per ADR-0013 (four tiers).

**Context.** ADR-0008 (Approved 2026-07-09) chose to replace the hand-rolled `packages/marid-telegram` gateway
with a fork of `grinev/opencode-telegram-bot`, on the premise that fixing in place "re-implements grammy/remark."
The operator reopened that decision ("forking is only a suggestion") and directed a proper evaluation (R-11 /
C-8). New evidence, verified at source, overturns ADR-0008's premise:

- `packages/marid-telegram` is **zero-runtime-dependency, hand-rolled** (raw Bot API client), **not grammy**. It
  already contains coalesced-edit streaming, unchanged-skip, 429 handling, and a **400 → plain-text fallback**.
- The only missing capability is **Markdown → Telegram conversion** — a single mature, typed, MIT npm dependency
  (`telegramify-markdown`, ~15k DL/wk), not a remark reimplementation.
- `resolveDownloadUrl` already exists in `media.ts` (unwired) — media landing is **wiring, not a rewrite**.
- `grinev` authenticates with OpenCode **Basic auth** (not a `channel:` bearer) and is a **feature-rich admin
  client** whose core features hit routes Marid's `channel:` scope **denies (403)** — so "adopt as fork" is
  really "port grinev's presentation modules," which is more code and coupling for a result the one npm dep
  already gives. No surveyed third-party bridge speaks Marid's channel-token + separate-process contract.

**Decision.** **Fix the five defects in place** in the Marid-owned gateway (PH-6), rather than fork or adopt:
(1) render Markdown via `telegramify-markdown` (`parse_mode` → MarkdownV2; existing 400→plain fallback covers
partial frames); (2) land inbound media into the workspace by wiring the existing `resolveDownloadUrl` → SDK
`FilePartInput`, behind an explicit INV-004 deny-by-default choice, with token'd-URL redaction (INV-002); (3)
route slash commands; (4) separate multi-part replies; (5) add SSE-firehose reconnect + authoritative-state
re-fetch (fixes deferred #8, contract v1.1). Estimated ~1 dependency + ~55-120 LOC across 3-4 existing files,
zero upstream patch surface. INV-001 stays server-enforced by `@marid/auth`. **Confirmed by EXP-005** (Telegram
fix-in-place spike; PASS = the four UX defects fixed + reconnect survives an SSE drop + INV-001 held + cadence
without 429s) before the PH-6 work is accepted.

**Consequences.** Smallest change and smallest sync surface (the operator's stated priority) and no new fork to
maintain (RISK-005). One new MIT runtime dependency enters `@marid/telegram` (pin + review). `grinev` is kept as
a **reference implementation** (its chunker + markdown-fallback confirm Marid's designs), not a base. On
approval, **ADR-0008 → Superseded** (the fork direction is withdrawn; its "beta-ships-with-known-issues"
disposition already happened at v0.1.0). ADR-0005 (separate process, public API, no provider keys) is unchanged.

**Rejected.** (1) **Fork grinev** (ADR-0008) — its features are largely incompatible with the `channel:` scope
(403), its auth is Basic not bearer, it's on SDK v1 vs Marid's v2, and adopting it is more code/coupling than
one npm dep; kept as reference. (2) **Port grinev's `render/` modules** — only worth it for entity-based
rendering (no `parse_mode`); drags unified+remark+grammy types in for a result `telegramify-markdown` already
gives. (3) **Adopt another bridge** — none speaks the channel-token + separate-process + deny-by-default
contract; all embed/spawn the agent or use Basic auth.
