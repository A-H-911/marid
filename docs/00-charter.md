---
status: Approved (gate 2, 2026-07-03)
version: v1.0
updated: 2026-07-03
owner: operator (STK-001)
---

# Project Charter — Marid (private agent platform on OpenCode)

## Problem

OpenCode is a mature coding agent with a strong runtime (sessions, tools, permissions, providers, TUI,
server), but it is shaped as a developer-tool product. The owner needs a **general-purpose agentic
backend**: privately distributed, remotely usable by applications, consistent across interfaces, reachable
through messaging channels, and runnable as several isolated instances on one machine — without losing the
ability to pull upstream improvements.

## Mission (from brief §1–§2)

Create a maintainable private downstream distribution of OpenCode that preserves the agent runtime,
removes what the target product does not need, exposes stable remote/embedded interfaces, and stays
reasonably easy to synchronize with upstream.

## Goals

| # | Goal | Traces to |
|---|---|---|
| G-1 | Preserve the OpenCode agent runtime and TUI experience | FR-001..021 |
| G-2 | Secure remote API with SSE streaming for programmatic/embedded use | FR-022..036 |
| G-3 | Cross-interface session consistency (API ↔ TUI ↔ channels) | FR-038..043 |
| G-4 | External channel adapters outside the core, Telegram first | FR-045..052 |
| G-5 | Multiple isolated runtimes per machine without conflicts | FR-053 |
| G-6 | Independent-product operations: config, secrets, observability, distribution, CI/CD, testing | FR-054..064 |
| G-7 | Sustainable upstream synchronization with a small, enumerated downstream delta | FR-061, NFR-001 |
| G-8 | Distinct identity: name, branding, README, attribution + non-affiliation | FR-065 |

## Non-goals (explicit)

- Desktop apps, IDE/editor integrations, and enterprise/cloud components unrelated to the core runtime (CON-004).
- Multi-tenant user management — MVP is **single operator** (OQ-003).
- Public-internet API exposure in the MVP — **private network only** (OQ-004); the design must not block later hardening.
- WhatsApp adapter in the MVP (OQ-002) — deferred, contract-compatible with the Telegram adapter.
- Multi-node / distributed deployment and horizontal scaling (brief §7 explicitly separates this; single-machine only).
- Feature parity with upstream's product direction; upstream is a source, not a roadmap.

## MVP definition

A single operator can, on one machine, run **two or more isolated runtime instances**, each offering:
TUI + private-network HTTP API with SSE streaming (sessions, prompts, events, permissions, health);
a session started via the API is visible and continuable in the TUI and vice versa, with live updates to
subscribers; a Telegram bot mapped to the operator can converse with a designated agent under a
restrictive channel capability policy (INV-001); installation via one supported distribution method;
upstream sync workflow documented and exercised at least once; CI green on Linux/macOS/Windows.

Deferred to Full: WhatsApp (FR-047), durable event replay (FR-037), retention/archival/export (FR-044),
extended metrics catalog (FR-058), any public-exposure hardening beyond design headroom.

## Success metrics

| ID | Metric | Target | Verifies |
|---|---|---|---|
| KPI-001 | §7 example flow demo: API-started session continued in TUI, updates visible to an API subscriber | Works end-to-end, repeatably, on all 3 OSes | G-2, G-3 |
| KPI-002 | Telegram round trip incl. a permission prompt honored under the channel policy | Works; policy denial paths verified | G-4, INV-001 |
| KPI-003 | ≥ 2 concurrent instances pass the multi-instance isolation test suite | Zero cross-instance interference | G-5, NFR-008 |
| KPI-004 | One full upstream sync cycle executed on the fork | ≤ 1 person-day; delta report generated | G-7, NFR-001 |
| KPI-005 | Traceability: every MVP FR reachable to ≥ 1 decision, task, and test | 100 % at readiness gate | INV-008 |
| KPI-006 | CI pipeline (§18 set) green on the release candidate | All mandatory jobs passing | G-6 |

## Stakeholders

| ID | Who | Role |
|---|---|---|
| STK-001 | Owner/operator (Eng. Anas Hammo) | Sponsor, sole approver at all 14 gates, MVP user |
| STK-002 | Execution agent (Claude Code or equivalent) | Implements from the handoff package |
| STK-003 | Upstream OpenCode project (anomalyco) | Source of truth for sync; no direct relationship implied |

## Scope-change rule

After this charter is approved (gate 2), any scope change requires a recorded `DEC-` with rationale;
silent drift is a gate failure.

## Amendments (post-approval)

- **2026-07-03 — DEC-010 (operator-directed):** the source repository `A-H-911/marid` is **public**,
  amending the "private downstream distribution" premise of the Mission for the *source repository* (and,
  by cascade, GitHub Releases — flagged for WBS-5.1 reconciliation). **Unchanged:** the private-network-only
  API-exposure non-goal (OQ-004) — the running service stays private-network-only — and INV-002 (secrets
  never committed). Rationale + consequences: `docs/decisions/open-decision-register.md` (DEC-010 detail);
  blocker context: `docs/decisions/deviation-branch-protection.md`.
