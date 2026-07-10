---
status: Accepted (gate 13, 2026-07-03)
version: v1.0
updated: 2026-07-03
owner: operator (STK-001)
---

# Review Prompts

## PR review (per WBS item)

> Review PR #<n> against: (1) its WBS DoD in docs/planning/roadmap.md; (2) the invariants
> (docs/requirements/invariant-register.md) — especially INV-001/002 for anything touching channels or
> secrets; (3) the approved contract (docs/architecture/api-event-contract.md) for any API-adjacent
> change; (4) patch-surface discipline — flag ANY edit to an upstream file not registered as P-* in
> docs/architecture/architecture.md; (5) test adequacy per docs/validation/test-strategy.md (no mocked
> runtime; deterministic fixtures). Report findings by severity; block on invariant or contract breaks.

## Security review (before each release and after PH-4)

> Audit against docs/architecture/security-threat-model.md: verify each B1–B8 mitigation exists and is
> tested; run the policy-denial and redaction suites (AC-010/012/016); attempt the injection probes in
> TEST-SEC; confirm plugins/providers pinning; check no secret appears in logs, audit lines, session
> exports, or Telegram egress. Report residual-risk deltas against the accepted list.

## Channel-adapter review (PH-6 Telegram remediation / PH-7 WhatsApp)

> For a channel PR: verify it stays a **separate process speaking ONLY the public API with a `channel:` token**
> (ADR-0005) — no in-core imports, no provider keys; **INV-001 is server-enforced** — the adapter must not
> re-implement or widen policy (confirm stranger-ignored + bound-agent + no tool/permission widening). Check new
> runtime deps are **pinned + provenance-checked** (RISK-014 — especially WhatsApp/Baileys; prefer the WAHA
> sidecar so Marid pulls no WhatsApp dep) and license-clean (MIT/Apache). For WhatsApp: **outbound-only, no
> public inbound endpoint** (OQ-004). Run AC-017 (Telegram) / AC-018 (WhatsApp) + the injection/policy-denial
> suite. Block on INV-001, contract, or unpinned-dep breaks.

## Sync-PR review (each upstream merge)

> For sync PR #<n>: confirm the delta report is attached and matches the P-* register; contract tests
> green; review flagged migrations; scan upstream changes for security advisories and for changes to
> server/session/v2-API areas (RISK-001 watch — quote evidence); confirm rollback is a single revertable
> merge commit. Recommend merge / hold with reasons.

## Readiness re-run (MS-006 / any go-no-go)

> Recompute readiness per docs/handoff/execution-readiness-report.md: KPI-001..006 evidence links,
> traceability regeneration (no MVP FR unlinked), invariant audit result, open Proposed decisions.
> Output READY or NOT-READY with the exact gap list. Never mark ready with a failing critical gate.
