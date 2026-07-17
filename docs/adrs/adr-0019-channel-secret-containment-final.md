---
id: ADR-0019
status: Approved
version: v1.0
updated: 2026-07-16
supersedes: ADR-0007
superseded_by: none
owner: operator (STK-001)
---

# ADR-0019 — Channel secret safety is containment, final: the egress redactor is dropped from scope

**Status:** Approved (2026-07-16, operator) · supersedes [ADR-0007](adr-0007-channel-secret-containment.md),
carrying its containment posture forward unchanged and closing its one open clause (the deferred
redactor) · relates to [AC-016](../validation/acceptance-criteria.md), RISK-007, RISK-004, INV-002 ·
raised by the post-v0.3.0 acceptance sweep (2026-07-16)

> **Note on how this ADR is expressed in the acceptance audit (2026-07-17, operator-directed — substance
> unchanged).** This ADR's dispositions are *superseded* (AC-007) and *accepted-with-deviation* (AC-016).
> Keystone's `G-PROGRESS` gate admits only `Met | Partial | Not-met | Pending`, so the
> [acceptance audit](../validation/acceptance-audit.md) carries **`Not-met`** for both rows, with the true
> disposition leading each row's Notes. For AC-016 that label is literally accurate — this ADR itself says
> "NOT Met, and will not be built". For AC-007 it under-describes a criterion that is **void, not failed**.
> The decision below is unaffected: nothing here was re-litigated, only re-labelled to fit the validator's
> vocabulary. If Keystone's `ALLOWED_VERDICTS` is widened to accept `Superseded`/`Accepted` (both already
> valid `DOCUMENT_STATUSES` in that tool), those two cells revert with no change to this ADR.

**Context.** [ADR-0007](adr-0007-channel-secret-containment.md) (Approved 2026-07-07) established that
channel secret safety in Marid is **authorization-boundary containment, not egress redaction**, and
deferred a configured-secret-value redactor to **PH-5**. PH-5 shipped and **MS-006 was accepted at
execution gate 14 without the redactor**; PH-8 then shipped v0.3.0. The deliverable was therefore
tracked to a phase that closed without it — it was never rejected and never built, it simply outlived
its owner. `AC-016` has sat at **Partial** ever since, and `RISK-007` still carries mitigation text
promising a PH-5 control that no longer has a phase to land in.

The containment posture that ADR-0007 chose has meanwhile held up in practice and is unchanged:

- The highest-value secret (provider keys in `auth.json`) sits **outside the restricted channel agent's
  workspace roots** — the agent physically cannot read it to echo it (B4/B2 boundary).
- The audit stream never carries the bearer: it logs the token **name**, with no request bodies.
- Secrets live only in env / sha256-hashed stores, never in config files.
- The Telegram **bot-token literal** is masked in gateway logs (`marid-telegram` `redact.ts` via
  `safeLog`).
- `marid export` is a **local CLI command with no scope and no `marid-auth` in its path** — a channel
  token cannot reach it.

What remains absent is the **defence-in-depth second layer**: no configured-secret-value redactor on
channel egress (`stream.ts`), no generic runtime log/error redactor, and `marid export` writing the raw
transcript by default.

**Decision.** Adopt ADR-0007's containment posture as **final**, and **drop the configured-secret-value
redactor from scope entirely** (it is no longer deferred, no longer tracked, and no longer a
deliverable of any phase).

1. **Redactor — dropped.** Rationale: Marid is a **single-operator private deployment** (per the
   charter, "private" names the intended deployment: one operator on a private network). The party the
   redactor would protect the operator from is the operator. The B4/B2 authorization boundary is the
   control, and the threat model itself endorses that framing ("defense is authorization-boundary
   containment, not detection"). A redactor would be a second layer against a threat the first layer
   already contains, at the cost of a value-registry, four wiring points, and permanent false-negative
   risk (a redactor that misses one encoding reads as safety while providing none).
2. **`AC-016` — Accepted with deviation, closed.** The criterion's asserted control (redaction) is
   **not** delivered and will not be; the containment control that supersedes it **is** delivered and
   holds. `AC-016` is closed as **Accepted** with this ADR as its rationale, not as Met.
3. **`RISK-007` — accepted, closed.** The residual "secret relayed to a channel" is formally accepted
   under containment for the single-operator deployment.
4. **`marid export` — retained from ADR-0007 sub-decision (c), unchanged.** The operating guardrail
   stands (operators pass `--sanitize` when exporting channel/untrusted transcripts). **P-4** (flipping
   the *global* export default to sanitized — an upstream-file edit) stays **reserved and not
   activated**; this ADR does not decide P-4, it only re-homes it from the closed PH-5 to "reserved,
   operator-activated if ever wanted".

**INV-002 is not weakened.** INV-002 requires that secrets are never committed and never stored
unencrypted in logs, session history, or diagnostics. Its enforcement was never the redactor — ADR-0007
recorded that the redactor was *absent* while INV-002 held, because secrets are kept out of those
surfaces at the source (env/hashed stores, no bodies in audit, boundary-isolated `auth.json`). Dropping
a control that was never enforcing the invariant does not change the invariant's standing.

**Consequences.** The acceptance surface stops promising a control Marid does not have and will not
build: `AC-016` closes honestly as Accepted-with-deviation rather than lingering at Partial forever,
and `RISK-007` closes as an accepted residual. **The three holes stop being tracked anywhere** — this is
the accepted cost of the decision and is stated here so it is not later mistaken for an oversight:
channel egress, general logs/errors, and raw `marid export` carry no secret-value redaction, and the
sole control is the authorization boundary. **If Marid's deployment assumption ever changes — more than
one operator, an untrusted operator, or a public/multi-tenant surface — this ADR must be revisited
first**, because its entire rationale rests on that assumption.

**Rejected.**
1. **Building the redactor** — rejected as defence-in-depth against a threat containment already covers,
   in a deployment where the protected-from party is the operator.
2. **Re-deferring it to a future phase (PH-7 or later)** — rejected: that is exactly the failure mode
   that produced this ADR. Deferring to an unowned future phase is how AC-016 stayed Partial across two
   releases. Either it is scope or it is not.
3. **Leaving AC-016 at Partial** — rejected: an acceptance criterion permanently parked at Partial with
   its remedy tracked to a closed phase is a false tracker, and a false tracker is a defect.
4. **Marking AC-016 Met** — rejected outright: the criterion as written asserts redaction, which is not
   delivered. Closing it as **Accepted** records the deviation; calling it Met would be a lie.
