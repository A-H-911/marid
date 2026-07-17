---
status: Approved (gate 8, 2026-07-03)
version: v1.1
updated: 2026-07-07
owner: operator (STK-001)
---

<!-- v1.1 (2026-07-07): B7 + residual-risks corrected to true state after the PH-4 threat-model audit —
the "redaction filters on channel egress" mitigation is claimed but not implemented; only the Telegram
bot-token literal is value-redacted (in gateway logs). See AC-016 and ADR-0007
for the containment-vs-redaction disposition and the PH-5 redactor deferral. Fact correction
only; the design decision itself is recorded in ADR-0007 (Approved 2026-07-07).
v1.2 (2026-07-16): ADR-0007 is SUPERSEDED by ADR-0019 (operator gate) — the redactor is **dropped from
scope**, not deferred; containment is the final accepted control. AC-016 closed as Accepted-with-deviation
(not Met); RISK-007 accepted + closed. B7 and the residual-risk entry below are updated to say "will not
be built" rather than "not yet implemented". -->


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
| B7 | Secrets at rest / in flight | auth.json exposure; secrets in history/logs relayed to channels (LLM02) | Per-instance 0700 dirs; secrets never in config files (env/secret-refs, FR-055); audit stream excludes payload bodies (logs the token *name*, never the bearer or request bodies). **Redaction (corrected v1.1):** only the Telegram bot-token literal is masked, in the gateway's own logs; a general configured-secret-value redactor on logs/errors/session-export/channel-egress **does not exist and will NOT be built** — **dropped from scope 2026-07-16 by [ADR-0019](../adrs/adr-0019-channel-secret-containment-final.md)** (supersedes ADR-0007's PH-5 deferral; AC-016 closed Accepted-with-deviation, RISK-007 accepted+closed). Secret-in-egress is **permanently** contained by the B2/B4 authorization boundary — the restricted channel agent cannot read `auth.json` (outside its workspace roots) to echo it |
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
- **Egress secret redaction not implemented (surfaced by the PH-4 audit, 2026-07-07).** The B7
  "redaction filters on channel egress" control does not exist beyond bot-token masking in gateway logs;
  session exports are raw by default. Secret-in-egress is contained today only by the B2/B4
  authorization boundary (provider keys in `auth.json` are unreadable by the restricted channel agent).
  A configured-secret-value redactor across logs/errors/export/egress is **dropped from scope** (2026-07-16,
  **[ADR-0019](../adrs/adr-0019-channel-secret-containment-final.md)**, operator gate) — it is **no longer a
  deliverable of any phase and is tracked nowhere**; ADR-0007's PH-5 deferral is superseded. Containment is
  the final accepted control (AC-016 Accepted-with-deviation; RISK-007 accepted + closed). Accepted because
  Marid is a **single-operator private deployment**. **Trigger to revisit — reopen ADR-0019 first:** any path
  by which an untrusted channel agent gains read access to a secret store, or **any multi-operator,
  untrusted-operator, or public/multi-tenant exposure** (that assumption is ADR-0019's whole basis).
- **B5 supply-chain controls not yet built (PH-5).** The plugin allowlist (empty by default), provider
  exact-version pinning, and FR-064 CI dependency/secret/license scanning are PH-5/WBS-5.1 work; in the
  current phase the "in-process plugin compromise" residual is mitigated only by the operator installing
  no plugins, not by an enforced allowlist or scanning. Trigger: third-party plugin use, or PH-5 start.

## Process

Security reporting/patching: private GitHub security advisories on the Marid repo; upstream security
releases fast-pathed (ADR-0001). CI: dependency, secret, and license scanning on every PR (FR-064).
