---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# Non-Functional Requirements (NFR-)

The brief demands "non-functional requirements with measurable thresholds" (§21). Where the brief gives a
quality but no number, the threshold below is **proposed** (marked ⊕) and backed by an assumption row; it
becomes binding only at the scope/architecture gates.

| ID | Requirement | Threshold | Source | Priority | Status |
|---|---|---|---|---|---|
| NFR-001 | Upstream synchronizability: the fork remains "reasonably easy to synchronize with upstream OpenCode"; prefer "a small, isolated downstream patch surface" | ⊕ Routine upstream sync (weekly–monthly) completable by one person in ≤ 1 day; downstream diff to upstream confined to an enumerated file list in the upstream-delta report | §2.4, §13 | MVP | Draft |
| NFR-002 | Simplicity: avoid "unnecessary complexity and premature platform engineering"; "the smallest architecture that safely satisfies the approved MVP" | Qualitative gate at architecture approval (gate 5); every new component must name the requirement it serves | §2.5, §23 | MVP | Draft |
| NFR-003 | Operability as an independent product: distributable, configurable, operable, observable, testable, upgradeable, securable | Each dimension has at least one artifact + acceptance criterion at readiness (gate 14) | §2.6 | MVP | Draft |
| NFR-004 | Cross-platform: Linux, macOS, Windows | CI smoke green on all three OSes for every release; x64 required, ARM64 "only where upstream dependencies and delivery needs justify it" | §12 | MVP | Draft |
| NFR-005 | Security as a core architectural concern: least privilege, safe defaults, sandboxing, prompt-injection and supply-chain defenses per §20 list | Threat model exists with trust boundaries + mitigations; all §20 items mapped to a mitigation, accepted risk, or deferral at gate 8 | §20 | MVP | Draft |
| NFR-006 | Streaming responsiveness: full response and event streaming across TUI, API, external channels | ⊕ First streamed token relayed to an API subscriber ≤ 500 ms after provider emission under nominal load; no event loss on reconnect within the replay window | §1, §6 | MVP | Draft |
| NFR-007 | Session consistency: cross-interface convergence | ⊕ An event committed on one interface is observable on other live subscribers ≤ 1 s (same machine); no lost or duplicated messages after reconnect (ordering + dedup contract, FR-036) | §7 | MVP | Draft |
| NFR-008 | Multi-instance isolation: no cross-instance interference | Zero shared mutable state between instances except what the isolation model explicitly declares; concurrent instances pass an isolation test suite (§17) | §9 | MVP | Draft |
| NFR-009 | Observability on open standards "where practical" (OpenTelemetry/OTLP) | Signals exportable via OTLP; local dev output usable without a collector | §11 | MVP | Draft |
| NFR-010 | Documentation quality: README plan per §19; docs validated in CI | §18 "documentation validation" job green | §18, §19 | MVP | Met (README per §19; `validate_package.py docs/` green in CI; WBS-8.6 reconciled docs to the PH-8 deep-rebrand + data isolation) |
| NFR-011 | Test rigor: risk-based coverage with explicit thresholds and per-gate evidence | ⊕ Coverage threshold set per package at test-strategy approval (upstream baseline measured first — do not invent a number before measuring) | §17 | MVP | Draft |
| NFR-012 | Language/tone of all deliverables: simple, clear English suitable for non-native speakers | Review check at each gate | §23 | MVP | Draft |
