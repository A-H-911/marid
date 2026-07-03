---
artifact: adr
status: Approved (gate 5; verified by EXP-002)
version: v1.0
updated: 2026-07-03
---

# ADR-0006 — Instance = isolated runtime via env-composed directory namespaces

**Status:** Approved (2026-07-03) · realizes OQ-001 answer + FR-053 · derives from R-05, R-11 (claudectl)

**Context.** OQ-001 (gate 1): an instance is an isolated runtime — own config, storage, cache, ports,
secrets, logs; may host several projects. R-05's conflict inventory shows today's shared state (DB,
auth.json, config, log, caches, port preference). OpenCode already honors `XDG_*` overrides,
`OPENCODE_DB`, `OPENCODE_CONFIG`; claudectl proves the thin-launcher + env pattern cross-platform.

**Decision.** **marid-instance** manages `~/.marid/instances/<name>/` trees (0700) containing config,
data (DB), cache, logs, secrets, and a port/PID record. It writes per-instance launchers that compose the
env (XDG + OPENCODE_* + port) and exec the shared binary; adds what claudectl lacks: port allocation,
PID files, graceful shutdown, status/health, per-instance MCP/LSP child processes by inheritance.
Registry = the directory listing (`list --json`). Isolation is by **namespacing, not locking**: no two
instances share a mutable file. Verified by EXP-002 against the full R-05 inventory.

**Consequences.** No daemon/supervisor in MVP (launchers + PID files suffice for a single operator);
cross-instance resource limits (CPU/memory) delegated to OS mechanisms documented per platform, enforced
limits deferred with a trigger (instance count > operator comfort).

**Rejected.** One daemon hosting many logical instances (weaker isolation, bigger blast radius);
per-agent-process instances (coordination overhead without benefit).
