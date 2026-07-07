---
id: ADR-0005
status: Approved
version: v1.0
updated: 2026-07-03
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0005 — Channel gateways are separate processes speaking only the public API

**Status:** Approved (2026-07-03; gate 5, policy confirmed gate 8) · realizes CON-006/FR-045 · derives from C-7

**Context.** In-process plugins have zero isolation (R-04) — the wrong place for untrusted ingress.
The pattern "external process → public HTTP+SSE" is proven by upstream's slack prototype (R-06) and
Shaheen's WhatsApp gateway (R-07). Telegram long polling needs no public endpoint (R-09), matching the
private-network constraint.

**Decision.** marid-telegram (and future channels) are standalone processes holding: a scoped Marid API
token, the platform credential (bot token), the channel capability policy, ingress dedup (`update_id`),
egress formatting/rate compliance, and streaming simulation (edit-coalescing ≥ 2 s). Channel users map to
the operator identity through an explicit allowlist (OQ-003). The channel's agent is a dedicated
restricted agent (tools/permissions ruleset) — INV-001 enforced by configuration + token scope, not trust.

**Consequences.** Core stays untouched; a gateway crash or compromise is bounded by its token; each new
channel = a new package against stable contracts (ingress/egress/identity/attachment per §8).

**Rejected.** In-core channel plugin (B).
