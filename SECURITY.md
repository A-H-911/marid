# Security

## IMPORTANT

We do not accept AI-generated security reports. If you submit one it will be ignored.

## What Marid is (for threat-modeling)

**Marid** is a private, single-operator distribution built as a tracking fork of OpenCode. It runs one
runtime serving a TUI, a token-secured HTTP+SSE API, a web UI, and a Telegram gateway — as XDG-isolated
multiple instances, intended for **one operator on a private network**. The repository and signed releases
are public; the *usage* is single-operator.

Marid **adds** a security layer on top of the inherited OpenCode runtime — but it does not change the
runtime's fundamental trust model. Read both halves below.

### What Marid adds

- **Authentication + authorization (`marid-auth`).** The HTTP surface is fronted by a bearer-token wrapper:
  scoped tokens (`admin` / `client` / `channel:<name>`), per-token rate limits, request-ID correlation, and
  an append-only audit log. Unauthenticated calls get `401`; out-of-scope calls get `403`.
- **Deny-by-default channel policy (INV-001).** Untrusted ingress (Telegram) reaches the server only through
  a `channel:` token that is strictly weaker than a client token — it may prompt only its own bound agent,
  on its own sessions, and can never widen tools/permissions or reach privileged routes.
- **Instance isolation.** Each `marid instance` runs with its own XDG data/cache/config/state roots, so
  instances do not read or write each other's data.
- **Audit without secrets (INV-002).** The audit stream logs token *names*, never bearer values or request
  bodies; secrets live in env / hashed stores.

### What Marid does **not** do (know these before relying on it)

- **No agent-tool sandbox.** As with upstream OpenCode, the permission system is a human-in-the-loop UX
  feature, **not** a security sandbox. An approved tool call runs with the privileges of the process. If you
  need true isolation, run Marid inside a container or VM.
- **No full secret redactor yet.** A configured-secret-value redactor across all egress/log/export surfaces
  is **deferred post-MVP** (AC-016, ADR-0007). Today, secret-in-egress is *contained* by the authorization
  boundary (a restricted channel agent cannot read `auth.json`), not by redaction.
- **Provider / MCP data handling** is governed by those third parties, outside Marid's trust boundary.

### Authoritative model

The full threat model, trust boundaries, and invariants (`INV-001`..`INV-008`) are in
[`docs/architecture/security-threat-model.md`](docs/architecture/security-threat-model.md) and
[`docs/requirements/invariant-register.md`](docs/requirements/invariant-register.md). Those are the source
of truth; this file is a summary.

### Out of scope

| Category | Rationale |
| --- | --- |
| **Agent-tool actions after approval** | The permission system is not a sandbox (see above). |
| **Sandbox escapes** | Marid does not sandbox agent tools. |
| **LLM provider data handling** | Governed by your configured provider's policies. |
| **MCP server behavior** | External MCP servers you configure are outside the trust boundary. |
| **Operator-controlled config** | You control your own config/instances; modifying them is not an attack vector. |

## Reporting a vulnerability

Report privately via this repository's GitHub **Security Advisories → "Report a vulnerability"** tab — not
in a public issue. As a single-operator project, triage is best-effort; you'll get a response on next steps
and be kept informed toward a fix.
