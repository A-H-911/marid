---
experiment: EXP-012
hypothesis: HYP-012
status: RUNBOOK (written, not run — burner-only, ban-exposed, NEVER a gate)
version: v1.0
updated: 2026-07-17
owner: operator (STK-001)
---

# EXP-012 — burner second-account real-protocol probe (runbook)

**Status: RUNBOOK — written, not run.** This is the manual, off-CI smoke test of the **real** WhatsApp
protocol using a throwaway ("burner") number. It is deliberately **not executed** as part of WBS-7.6: a
real WhatsApp session on an unofficial client carries genuine ban exposure (RISK-013/022), and MS-008's
exit is the **deterministic** tier ([EXP-011](exp-011-report.md)) alone. This tier exists so the operator
*can* smoke the live path on demand, accepting number loss — it **never** gates a merge (ADR-0014 tier 3).

Validates (when run) [HYP-012](../research/hypothesis-register.md): *A second-account burner probe can
smoke-test the real WhatsApp protocol off-CI without an unacceptable per-run ban rate for an inbound-only
responder bot.*

## Preconditions

- A **throwaway** phone number the operator is willing to lose. Never the operator's primary WhatsApp.
- The operator's real WhatsApp as the single allow-listed peer JID.
- A WAHA container running the pinned image on the private network:
  `devlikeapro/waha:noweb-2026.7.1@sha256:8717e9a689b723d0782aae9340dbf3d1234c9c6cd53c873382f921a5f466c119`.
- `@marid/whatsapp` config with the burner's WAHA session name and the operator JID in the allow-list;
  the channel token bound to an agent (INV-002: WAHA api-key + token via env only, never committed/logged).

## Procedure

1. Start WAHA; pair the burner session by scanning the QR at setup (auth-state persisted `0600`).
2. `marid whatsapp start` against a running `marid serve`; confirm the WS dials **out** (no inbound port).
3. From the operator's real WhatsApp, send a message to the burner. Expect a streamed reply
   (`presence("typing")` → text, coalesced edits) — the same round trip EXP-011 proves against the fake.
4. Send an image; expect it to land as a file part and be acknowledged.
5. Trigger a tool-gated action; expect an `APPROVE <token>` prompt; redeem the token; expect the ack.
6. From a **non**-allow-listed number, message the burner. Expect **zero** reply (INV-001, live).

## What it does NOT cover / accepted ceilings

- **Ban risk is accepted, not mitigated.** A ban ends the run; the number is disposable. Keep volume
  human-paced (RISK-013) and do not automate blast traffic.
- Real-world **edit window** (~15 min) and **rate** behaviour are observed here only anecdotally — they are
  not asserted and never gate.
- Because this is ban-exposed and non-deterministic, **no CI wiring**. If ever automated, it belongs in the
  separate non-gating `marid-whatsapp-burner.yml` (`workflow_dispatch` + label, warn-and-exit-0 when the
  burner secrets are absent) — the same shape as `marid-telegram-userbot.yml`.

## Result

Not run. To be filled if/when the operator executes the probe on a burner. A FAIL here does **not** block
MS-008 (deterministic tier is authoritative); it would open a follow-up on the specific live discrepancy.
