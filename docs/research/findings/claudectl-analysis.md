---
artifact: claudectl-reference-analysis
status: Draft
version: v0.1
updated: 2026-07-03
---

# claudectl Reference Analysis (R-11, user-supplied 2026-07-03)

Source: https://github.com/A-H-911/claudectl (public, MIT, v0.2.0, Shell, ~272 lines of script;
cloned read-only to scratchpad). What it is: a cross-platform CLI that creates isolated Claude Code
instances by writing a thin launcher per instance that sets `CLAUDE_CONFIG_DIR` and execs the one
shared binary (README.md:44-58, docs/architecture.md:8-21).

## Patterns extracted (proposals for the FR-053 instance manager)

| # | Pattern | Source | Benefit | Verdict candidate |
|---|---|---|---|---|
| 1 | **Thin launcher + env-var composition**: per-instance launcher script exports the isolation env vars, then execs the shared binary; no daemon, no binary copies | architecture.md "Thin Launcher Design" | Matches OpenCode's existing seams (`OPENCODE_DB`, XDG dir overrides, `OPENCODE_CONFIG`); instance manager becomes a small NEW component with **zero core diff** → serves NFR-001/NFR-002 | **Adapt** (extend with port allocation + PID/lifecycle, which OpenCode needs and claudectl deliberately lacks) |
| 2 | Directory-as-registry: instances are just subdirs of a base dir; `list`/`path` read the filesystem; `--json` for scripting | README commands table | No state DB to corrupt; trivially inspectable | **Adopt** |
| 3 | `chmod 700` per-instance config dir; credentials never cloned (`clone` copies settings only) | README.md:44, example 2 | Secret hygiene per instance (INV-002) | **Adopt** |
| 4 | Lifecycle verbs: `add / list / path / reset / remove [--purge --force] / spawn / status / clone / config / token` | README commands table | A proven, minimal CLI vocabulary for FR-053 process discovery/teardown | **Adapt** (add `start/stop/logs` since our instances are server processes) |
| 5 | Honest "Known limitations" table naming exactly what is NOT isolated, with tracked issues + workarounds | architecture.md:33-46 | Template for our isolation contract: auth.json RMW races, LSP bin cache, global log are our equivalents (R-05 conflict inventory) | **Adopt** (documentation pattern) |
| 6 | Cross-platform launchers (`.cmd`/`.ps1` on Windows) + PATH setup command + 3-OS CI on a protected main | README platform table, CONTRIBUTING | Matches CON-011 and FR-062 needs | **Adopt** |
| 7 | Alternatives table steering users to a heavier tool (claude-squad) when they need full process isolation | architecture.md:48-59 | Keeps scope honest (NFR-002): don't rebuild what an existing tool does better | **Adopt** (documentation pattern) |

## Key difference from our target

claudectl instances are *interactive CLI configs* — "No daemon. No port binding. No IPC" — while a
product instance is a **server process** (one server per instance is the gate-5 direction). So the
launcher pattern is necessary but not sufficient: our manager must add port allocation, PID files,
graceful shutdown, and health checks. That is the extension, not a contradiction.

## Security note

Repo content treated as untrusted data (INV-004): patterns read from docs/scripts; nothing executed.
No secrets present; MIT license permits pattern reuse.
