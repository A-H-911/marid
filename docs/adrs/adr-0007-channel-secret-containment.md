---
id: ADR-0007
status: Superseded
version: v1.1
updated: 2026-07-16
supersedes: none
superseded_by: ADR-0019
owner: operator (STK-001)
---

# ADR-0007 — Channel secret safety is authorization-boundary containment, not egress redaction (MVP)

**Status:** **SUPERSEDED by [ADR-0019](adr-0019-channel-secret-containment-final.md) (2026-07-16, operator
gate).** ADR-0019 carries this ADR's **containment posture forward unchanged** — that decision was never
reversed — and closes its one open clause: the redactor this ADR deferred to **PH-5** is **dropped from
scope** (PH-5 closed without it, so the deferral had outlived its owner). The `marid export` sub-decision
(c) and the reserved-but-not-activated **P-4** are likewise carried forward by ADR-0019. Read ADR-0019 for
the live decision; this ADR is retained as history. — *original status line follows:* Approved (2026-07-07,
operator) · the **core decision** (containment-first MVP posture +
redactor deferred to PH-5) is accepted; the **`marid export` sub-decision is resolved to (c)** (operator,
2026-07-07): document the guardrail and defer the default-flip (P-4) to PH-5 · corrects the B7 claim in
[security-threat-model.md](../architecture/security-threat-model.md) · relates to AC-016, RISK-007,
RISK-004 · raised by the PH-4 threat-model audit (2026-07-07)

**Context.** The gate-8 threat model (B7) lists *"redaction filters on logs + channel egress"* as a
mitigation, and AC-016 asserts that any configured secret value appearing in *"any log, error output,
session export, or channel message"* is redacted. The PH-4 audit found this is **not implemented**:

- The only configured-secret-value redaction anywhere is the Telegram **bot-token literal**, masked in
  the gateway's own log lines (`marid-telegram/redact.ts`, wired via `safeLog`).
- There is **no** secret-value redactor on channel egress (`stream.ts` sends assistant text un-filtered),
  **no** generic runtime log/error redactor inherited from core, and `marid export` writes the **raw**
  transcript by default (`--sanitize` is opt-in and does *structural field-blanking*, not secret-value
  redaction).
- What *does* hold: the audit stream never carries the secret (it logs the token **name**, not the
  bearer, with no request bodies), secrets live only in env / hashed stores (never config files), and —
  critically — the **highest-value secret (provider keys in `auth.json`) sits outside the restricted
  channel agent's workspace roots**, so the agent physically cannot read it to echo it.

So the *effective* control for secret-in-egress today is the **B4/B2 authorization boundary**
(containment), which the threat model itself endorses ("defense is authorization-boundary containment,
not detection"), **not** the redaction filter B7 names.

**Decision (proposed).** Adopt authorization-boundary **containment** as the accepted MVP posture for
channel secret safety, and **defer** a configured-secret-value redactor to PH-5:

1. A configured-secret registry + value-redactor across all four surfaces (logs, error output, session
   export, channel egress) is **PH-5 hardening**, landing alongside the other B5 controls (plugin
   allowlist, provider exact-version pinning, FR-064 CI scanning) that are already PH-5.
2. Interim controls that land **now** (PH-4 audit follow-up): the threat model / acceptance-audit are
   corrected to the true state (B7 claim marked not-implemented; AC-016 verdict **Partial**); the
   instance server is pinned to a loopback bind explicitly (B3 drift guard); RISK-007 / RISK-004
   mitigation text is corrected to describe containment + the PH-5 gap.

**Sub-decision — RESOLVED to (c) (operator, 2026-07-07).** `marid export` egresses the raw transcript
by default. `export` is a **local CLI command with no scope and no marid-auth in its path — a channel
token cannot reach it**, so this is an operator-initiated data-handling footgun, not an
attacker-reachable egress. Options considered:
- **(a)** Flip the *global* export default to sanitized — an **upstream-file edit** (reserved as **P-4**
  in the [patch-surface register](../architecture/architecture.md)); affects every export, adds sync
  surface.
- **(b)** Provenance-aware sanitize (default-on only for channel-originated sessions) — not cheap; needs
  session provenance tracking.
- **(c)** *(CHOSEN — operator-confirmed 2026-07-07)* Document the operating guardrail (operators pass
  `--sanitize` when exporting channel/untrusted transcripts) and defer the default-flip (a) to PH-5.
  P-4 stays **reserved / deferred**; no upstream edit now.

**Consequences.** The threat model no longer over-claims a control it lacks; the acceptance surface is
honest (AC-016 Partial, evidence corrected). The residual "secret relayed to a channel" is accepted for
the MVP under containment, with the redactor as a tracked PH-5 deliverable. If the operator selects (a),
P-4 is activated; otherwise it stays reserved and deferred.

**Rejected.** (1) Leaving B7/AC-016 asserting redaction as "Met" — a false tracker is a defect. (2)
Rewording B7 to assert containment as the *accepted design* before this ADR is approved — that would
render a Proposed decision as settled (INV-005).
