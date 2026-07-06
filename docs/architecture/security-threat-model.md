---
status: Approved (gate 8, 2026-07-03)
version: v1.0
updated: 2026-07-03
owner: operator (STK-001)
---

# Security & Permission Model + Threat Model (Gate 8)

Deployment context (approved): single operator, private network, one machine, multiple instances.
References: OWASP LLM Top-10 2025 and indirect-prompt-injection guidance (R-10,
`../research/findings/fork-security-otel-research.md`); runtime security posture (R-04).

## Assets

A1 provider API keys + Telegram bot token + Marid bearer tokens · A2 session history (may contain code,
secrets-adjacent text) · A3 the filesystem/projects the tools can touch · A4 the machine itself (shell
execution) · A5 audit integrity.

## Actors

Operator (trusted) · operator's apps (semi-trusted, scoped tokens) · Telegram senders (untrusted until
allowlisted; content untrusted always) · repository/tool/MCP content (untrusted data) · upstream code
(reviewed at sync) · LAN peers (untrusted network actors).

## Trust boundaries & attack paths → mitigations

| # | Boundary / path | Threats (OWASP ref) | Mitigations (MVP unless noted) |
|---|---|---|---|
| B1 | Telegram → gateway | Unsolicited senders; injection via message/media (LLM01); flooding | Operator-ID allowlist (deny-by-default); `update_id` dedup + replay protection; media size caps; per-sender rate limit; content wrapped as untrusted data in prompts |
| B2 | Gateway → server | Token theft; over-privileged channel | `channel:<name>` scope bound to a dedicated **restricted agent**: read-only tool set by default, deny shell/write/network tools, ask-mode for anything sensitive (INV-001); model + token/cost caps in policy; gateway holds no provider keys |
| B3 | Clients → server (LAN) | Unauthenticated access; sniffing; brute force | Mandatory bearer auth (401 without token — stricter than upstream default); bind to localhost by default, non-localhost bind requires explicit config + warning; rate limiting; TLS guidance for VPN-less LAN (post-MVP hardening headroom per OQ-004) |
| B4 | Model output → tools ("excessive agency", LLM06/08) | Injected instructions cause harmful tool calls | Enforcement at the tool-authorization boundary (R-10): permission rulesets last-match-wins, deny-by-default for channel agents; approval prompts for writes/shell; wildcard "always allow" scoped narrowly |
| B5 | Plugins/MCP in-process (supply chain, LLM03/05) | Malicious/compromised plugin = full compromise | MVP: plugin allowlist per instance (empty by default), MCP servers pinned by explicit config; runtime npm-install of providers pinned to exact versions in the profile; CI dependency/secret scanning (FR-064). OS-level sandboxing: **deferred** with trigger "any third-party plugin adopted" |
| B6 | Fork ← upstream | Malicious/vulnerable upstream change | Sync review checklist incl. dependency diff + security advisories; INV-004 (upstream content never executed as instructions during review) |
| B7 | Secrets at rest / in flight | auth.json exposure; secrets in history/logs relayed to channels (LLM02) | Per-instance 0700 dirs; secrets never in config files (env/secret-refs, FR-055); redaction filters on logs + channel egress; audit stream excludes payload bodies |
| B8 | Multi-instance | Cross-instance reads/writes | Namespacing by construction (ADR-0006); EXP-002 verification; distinct tokens per instance |

## Permission model (layered, all reusing upstream rulesets)

1. **Instance defaults** (Marid profile): safe defaults, `lsp:false`, no plugins, telemetry opt-in.
2. **Agent rulesets** (upstream permission system): per-agent tool allow/ask/deny wildcards.
3. **Channel capability policy** (config consumed by gateway + expressed as the channel agent's ruleset +
   token scope): agents, tools, workspace roots, models/providers, cost caps, retention, admin ops = deny.
4. **Token scopes** (marid-auth): admin / client / channel:* as in the API contract.
5. **Human approval**: permission asks surface in TUI and as Telegram inline keyboards; deny wins on timeout.

## Residual risks (accepted, with triggers)

- In-process plugin compromise if the operator installs a malicious plugin (mitigation = allowlist +
  scanning; sandbox deferred). Trigger: third-party plugin use.
- LAN attacker + no TLS: bearer tokens sniffable on untrusted LAN segments. Guidance: localhost/VPN only
  in MVP. Trigger: any non-private exposure → TLS + hardening phase (charter headroom).
- Prompt injection can never be fully eliminated (LLM01); defense is authorization-boundary containment,
  not detection. Accepted per R-10.

## Process

Security reporting/patching: private GitHub security advisories on the Marid repo; upstream security
releases fast-pathed (ADR-0001). CI: dependency, secret, and license scanning on every PR (FR-064).
