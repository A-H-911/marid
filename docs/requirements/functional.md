---
status: Draft
version: v0.2
updated: 2026-07-03
owner: operator (STK-001)
---

# Functional Requirements (FR-)

Extracted verbatim-first from `../brief.md`. Source column cites the brief section (§) — the quoted
phrasing in the brief is the authoritative provenance span. Priorities were resolved by clarification
batch 1 (`OQ-002`: all four capability blocks in MVP; WhatsApp post-MVP). Rows marked **Gate 6** carry a
"where justified / where useful" qualifier in the brief and get their final classification from the
current-state evidence at the keep/change/exclude/remove gate.

Legend: **MVP** = required for first usable release · **Full** = target product, post-MVP · **Gate 6** =
classification pending current-state evidence.

## A. Core runtime capabilities to preserve (§4)

The brief requires each of these to be classified keep-as-is / keep-with-changes / make-optional /
replace / remove / defer **with evidence** during current-state analysis (gate 6). Until then they are
requirements to *preserve or provide equivalent support*.

| ID | Requirement | Source | Priority | Status |
|---|---|---|---|---|
| FR-001 | Preserve the agent execution loop | §4 "Agent execution loop" | MVP | Draft |
| FR-002 | Durable sessions and conversation history | §4 | MVP | Draft |
| FR-003 | Interactive use through a TUI | §1, §4 | MVP | Draft |
| FR-004 | Agent and subagent management | §4 | MVP | Draft |
| FR-005 | Skills and slash commands | §4 | MVP | Draft |
| FR-006 | Rules and project instructions | §4 | MVP | Draft |
| FR-007 | Permission management and approval workflows | §4 | MVP | Draft |
| FR-008 | Plugin system | §4 | MVP | Draft |
| FR-009 | Tool registration and tool calling | §4 | MVP | Draft |
| FR-010 | Multiple LLM providers and model selection | §4 | MVP | Draft |
| FR-011 | Storage and schema migrations | §4 | MVP | Draft |
| FR-012 | Caching where justified | §4 "where justified" | Gate 6 | Draft |
| FR-013 | MCP clients and servers | §4 | MVP | Draft |
| FR-014 | LSP capabilities where useful outside IDE integration | §4 "where useful" | Gate 6 | Draft |
| FR-015 | Event publication and subscription | §4 | MVP | Draft |
| FR-016 | Streaming model output and tool events | §1, §4 | MVP | Draft |
| FR-017 | Session branching, cancellation, resumption, and recovery | §4 | MVP | Draft |
| FR-018 | Configuration and secret management | §4, §10 | MVP | Draft |
| FR-019 | Generated or supported SDKs | §4, §6 | MVP | Draft |
| FR-020 | Observability hooks | §4, §11 | MVP | Draft |
| FR-021 | Controlled shell, file, network, and process access | §4 | MVP | Draft |

## B. Remote agent interface (§6) — MVP block per OQ-002

| ID | Requirement | Source | Priority | Status |
|---|---|---|---|---|
| FR-022 | Session creation and discovery via remote API | §6 | MVP | Draft |
| FR-023 | Send prompts synchronously and asynchronously | §6 | MVP | Draft |
| FR-024 | Stream token, message, tool, permission, status, and lifecycle events to remote clients | §6 | MVP | Draft |
| FR-025 | SSE as the primary simple streaming option; evaluate bidirectional protocols only where SSE+HTTP is insufficient | §6 | MVP | Draft |
| FR-026 | Session history retrieval via API | §6 | MVP | Draft |
| FR-027 | Session cancellation and resumption via API | §6 | MVP | Draft |
| FR-028 | Permission requests and responses over the remote interface | §6 | MVP | Draft |
| FR-029 | Tool progress and subagent events exposed remotely | §6 | MVP | Draft |
| FR-030 | Structured errors, request correlation, and idempotency on the API | §6 | MVP | Draft |
| FR-031 | Authentication and authorization on the remote interface (single-operator model per OQ-003; private network per OQ-004) | §6, §20 | MVP | Draft |
| FR-032 | Rate limiting and quotas | §6, §20 | MVP | Draft |
| FR-033 | Audit logging of remote operations | §6, §11, §20 | MVP | Draft |
| FR-034 | Health, readiness, and version endpoints | §6 | MVP | Draft |
| FR-035 | API and event versioning; SDK-friendly contracts | §6 | MVP | Draft |
| FR-036 | Defined backpressure, disconnect, retry, reconnection, event ordering, and duplicate-event behavior | §6 | MVP | Draft |
| FR-037 | Optional durable event replay **where justified** | §6 "where justified" | Full | Draft |

## C. Cross-interface session synchronization (§7) — MVP block per OQ-002

| ID | Requirement | Source | Priority | Status |
|---|---|---|---|---|
| FR-038 | A session remains consistent when the same user interacts through different interfaces (API-started session visible and continuable in TUI; subscribers on other channels receive updates) | §7 example flow | MVP | Draft |
| FR-039 | Defined authoritative session store, session identity, and user/channel identity mapping | §7 | MVP | Draft |
| FR-040 | Defined concurrency behavior: simultaneous prompt handling, prompt queueing and steering, event ordering | §7 | MVP | Draft |
| FR-041 | Session ownership, access control, locking where required, and conflict resolution | §7 | MVP | Draft |
| FR-042 | TUI refresh/subscription behavior for externally-driven updates | §7 | MVP | Draft |
| FR-043 | Session recovery after process restart; defined behavior when one interface disconnects | §7 | MVP | Draft |
| FR-044 | Session retention, archival, export, and deletion | §7 | Full | Draft |

## D. External communication channels (§8) — Telegram in MVP; WhatsApp post-MVP per OQ-002

| ID | Requirement | Source | Priority | Status |
|---|---|---|---|---|
| FR-045 | Channel-adapter mechanism **outside the agent core** with stable ingress, egress, identity, attachment, and event contracts | §8 | MVP | Draft |
| FR-046 | Telegram adapter (Bot API) | §8 | MVP | Draft |
| FR-047 | WhatsApp adapter — an **unofficial client under private-network containment** (amended from "official Business/Cloud APIs" per DEC-016, approved 2026-07-10; official excluded: it needs public inbound ingress vs OQ-004) | §8, DEC-016 | Full | Draft |
| FR-048 | Streaming simulation for platforms without token streaming; message formatting within platform limits | §8 | MVP | Draft |
| FR-049 | Attachments/media, replies/threads/conversation mapping, and commands on channels | §8 | MVP | Draft |
| FR-050 | User identity linking, channel allowlists, and administrative approval | §8 | MVP | Draft |
| FR-051 | Webhook signature validation, replay protection, retry and dead-letter handling, rate limits | §8 | MVP | Draft |
| FR-052 | Channel capability policy restricting: available agents, tools, projects/workspaces, filesystem boundaries, models/providers, token+cost limits, session retention, admin operations | §8 | MVP | Draft |
| FR-066 | Live **bidirectional session mirroring** across all clients (TUI/Web/API/Telegram/WhatsApp): a session the operator **attaches** to a surface streams every turn to every bound surface and vice-versa, with defined cross-surface permission-surfacing (view-via-binding, act-via-ownership) and concurrency; explicit-attach scope (a fresh session does not auto-appear on a channel) | operator directive 2026-07-10 (extends FR-038/042) | Full | Draft |

> **PH-6 / PH-7 (post-MVP, 2026-07-09).** FR-046 remediation is scheduled as **PH-6** (fix-in-place, ADR-0009 /
> DEC-014 / R-11). **FR-047:** a **Proposed, operator-gated amendment (DEC-016)** would change "official
> Business/Cloud APIs" to permit an **unofficial client under private-network containment** — the official Cloud
> API needs a public inbound webhook, contradicting OQ-004; see ADR-0010 / DEC-015 / R-12. **DEC-016 APPROVED
> 2026-07-10 — the FR-047 statement above is amended accordingly** (unofficial client under containment; official
> kept as rejected-with-reason, INV-006).

## E. Multi-instance operation (§9) — MVP block per OQ-002

| ID | Requirement | Source | Priority | Status |
|---|---|---|---|---|
| FR-053 | Multiple independent instances on the same machine without conflicts, covering: instance IDs, port allocation, storage/db/cache namespaces, temp dirs, PID/lock files, sockets/pipes, log+telemetry attributes, config dirs, credentials, MCP/LSP processes, working dirs, plugin state, update/migration locks, process discovery and shutdown, CPU/memory/concurrency limits | §9 | MVP | Draft |

> **Unblocked** by OQ-001 (batch 1): an *instance* is an **isolated runtime** — its own config, storage,
> cache, ports, secrets, and logs; may serve one or more projects/workspaces internally.

## F. Configuration and secrets (§10)

| ID | Requirement | Source | Priority | Status |
|---|---|---|---|---|
| FR-054 | Layered configuration: built-in defaults, system, user, project, instance, env vars, CLI overrides — with clearly defined precedence and merge rules | §10 | MVP | Draft |
| FR-055 | Secret references; runtime API updates where safe; validation and diagnostics; schema versioning and migrations; redaction in logs and errors | §10 | MVP | Draft |

## G. Observability (§11)

| ID | Requirement | Source | Priority | Status |
|---|---|---|---|---|
| FR-056 | Structured logs, metrics, and distributed traces with OpenTelemetry/OTLP export | §11 | MVP | Draft |
| FR-057 | Correlation across API request → session → prompt → provider call → subagent → tool call → external-channel message | §11 | MVP | Draft |
| FR-058 | Model latency/token usage, tool latency/failure, queue+streaming metrics, permission decisions, session lifecycle, process/resource metrics | §11 | Full | Draft |
| FR-059 | Operational telemetry separated from security audit records; sensitive-data redaction; local dev output + production exporters | §11 | MVP | Draft |

## H. Distribution, upstream sync, workflow (§12–§14, §17–§19)

| ID | Requirement | Source | Priority | Status |
|---|---|---|---|---|
| FR-060 | An MVP distribution method plus a later expansion path (evaluate binaries, npm/Bun, Docker, Compose, native packages, private releases/registries, signing, checksums, SBOM, manifests, update channels, migrations, rollback, release notes) | §12 | MVP | Draft |
| FR-061 | Upstream synchronization workflow: remote config, baseline tracking, update frequency, automated update branches, CI validation, conflict ownership, migration review, security-patch priority, dependency updates, rollback, documentation, and an upstream-delta report of all downstream modifications | §13 | MVP | Draft |
| FR-062 | Adapted Git Flow: protected main, develop, feature/release/hotfix/upstream-sync branches, naming, PR rules, required checks, reviews, commit conventions, tagging, release process, changelog automation where useful | §14 | MVP | Draft |
| FR-063 | Risk-based testing strategy per §17 (unit → cross-platform smoke; boundaries, fixtures, provider mocks, deterministic modes, coverage thresholds, flaky policy, per-gate evidence; Linux/macOS/Windows CI; PR/nightly/release/post-sync tiers) | §17 | MVP | Draft |
| FR-064 | GitHub Actions CI/CD covering the §18 workflow list (format, lint, typecheck, tests, matrix, compat, migrations, security/dependency/secret/license scans, SBOM, container+binary builds, install smoke, docs, RCs, signed releases, sync validation, scheduled runs, retention, publishing) | §18 | MVP | Draft |
| FR-065 | Naming and branding package: candidate names, availability findings, README plan with attribution + non-affiliation notice, logo brief in editable vector format | §19 | MVP | Draft |

## Deliverable-type requirements (the mission itself)

The §21 deliverables list (charter, registers, matrices, threat model, roadmap, prompts, readiness report,
etc.) is the contract for **this planning package**, not the product; it is tracked in the package
`manifest.json` and the traceability matrix rather than duplicated here as FRs.
