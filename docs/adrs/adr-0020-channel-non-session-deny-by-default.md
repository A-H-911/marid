---
id: ADR-0020
status: Approved
version: 1.0.0
updated: 2026-07-19
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0020 — a `channel:` token must be deny-by-default on NON-session routes too (the `/pty` breach)

## Status

**Approved** (2026-07-19, operator STK-001) — drafted after an adversarial review surfaced a realized
INV-001 breach (see [RISK-026](../risks/risk-register.md)); approved for landing the same day. A failing
regression test (`packages/marid-gateway/test/pty-scope-breach.test.ts`) reproduces the breach through the
real `authorize()` + `createMaridAuth().handle()` path; the proposed fix (below) makes it pass with all 128
gateway tests green. It was **also confirmed live end-to-end** against a real marid-wrapped HTTP server
(`packages/opencode/scripts/pty-channel-breach-repro.ts` — boots `maridServe`, mints a real channel + admin
token): a `channel:` token got **`GET /pty/shells` = 200 before the fix, 403 after**, while `admin` stayed
200 (route works) and `channel GET /config` stayed 200 (no over-restriction). Lands in PR-0; the merge into
`develop` remains the operator's explicit call (INV-005).

## Context

`marid-auth` is the **sole** authentication/authorization gate: `packages/opencode/src/marid/serve.ts:27`
does `delete process.env.OPENCODE_SERVER_PASSWORD`, so the delegated upstream v1 handler's own per-route
auth (`.../httpapi/middleware/authorization.ts`) short-circuits to pass-through — both `Authorization` and
`PtyConnectAuthorization` become `(effect) => effect` when no password is set (authorization.ts:122,138).

`scope.ts`'s `authorize()` gated a `channel:` token deny-by-default **only on `/session/:id/*` sub-routes**
(`channelOwnedRouteAllowed`). For **non-session** (top-level) routes it returned a **blanket `ALLOW`**, the
same as a trusted `client` token (scope.ts, the `session === undefined` branch). The bound-agent guard in
`middleware.ts` (`channelAgentDenial`) fires only on `/session/:id/message|prompt_async`, so it does not
cover top-level routes either.

The served app mounts a top-level **`/pty`** surface (`.../httpapi/groups/pty.ts`, mounted via
`httpapi/server.ts` `ptyHandlers` + `ptyConnectApiRoutes`, served by `Server.Default()` which marid-auth
wraps). `POST /pty` = *"Create a new pseudo-terminal (PTY) session for running shell commands"*, plus
`POST /pty/:id/connect-token` and the WS `GET /pty/:id/connect`.

**Net breach:** an untrusted WhatsApp/Telegram `channel:` token — deny-by-default by design, restricted to a
bound agent, no direct execution — could reach `/pty` and **spawn + drive an OS shell**, bypassing the
entire agent/policy/permission model. This is gateway-wide (any `channel:` scope) and has existed since PH-4.
`scope.ts`'s own header promised channel tokens cannot reach `/shell`/`/command` — true for the *session*
routes it guarded, **false** for the top-level `/pty` surface it never considered.

**Proof (deterministic, model-free — `packages/marid-gateway/test/pty-scope-breach.test.ts`):**

| request (a real `channel:whatsapp` token, via `createMaridAuth().handle()`) | before fix | expected |
|---|---|---|
| `authorize(channel, GET /pty/shells)` | `allow: true` | `allow: false` |
| `GET /pty/shells` | **200 (reaches the pty handler)** | 403 |
| `POST /pty` (spawn a shell) | **200** | 403 |

The filter model for session routes was correct; **the defect is treating a channel like a client on
non-session routes.**

**Invalidated acceptance:** the INV-001 conjunct ("channel cannot widen tools / act beyond its restricted
agent / least privilege") of **AC-010, AC-011, AC-012** (Telegram), **AC-017**, **AC-018**, **AC-022**
(WhatsApp) is false at runtime; all are stamped Met. The non-INV-001 parts of each may still hold — each
needs re-audit once the fix lands.

## Decision (proposed)

Make `channel:` scope **deny-by-default on non-session routes** too, via a `channelNonSessionAllowed`
allowlist in `scope.ts`. A channel may reach ONLY:

- **read-only meta/list:** `GET /config`, `/agent`, `/provider`, `/doc`, `/status`, `GET /` (health);
- **the filtered firehoses:** `GET /event`, `GET /global/event` (body-filtered owns∪bound in `middleware.ts`);
- **the filtered lists:** `GET /permission`, `GET /session`, `GET /session/status` (meta);
- **session creation:** `POST /session` (already handled by the `createsSession` branch).

Everything else at the top level — crucially **`/pty/*`**, and `/file`, `/tui`, `/mcp`, `/command`,
`/experimental`, `/project`, `/instance`, … — is **DENIED**. `client` scope is unchanged (it keeps blanket
non-session `ALLOW`: it is the operator's own trusted credential, and the TUI/web `/pty` terminal uses it).

The flat `POST /permission/:requestID/reply` route is a non-session POST, so it is now **denied for channel
scope** by this allowlist — closing the old "route-allowed" residual (deferred-work #2) for the untrusted
case; the channel already uses the ownership-gated session-scoped reply route. (#2 for `client` scope remains
a separate follow-up.)

This is **Marid-owned** (one function + one branch in `marid-gateway/scope.ts`, an additive package),
**sync-durable**, and requires **no upstream edit and no new `P-*`**.

## Consequences

- **Positive:** closes the realized INV-001 shell-execution breach for every `channel:` scope
  (WhatsApp + Telegram); also closes deferred-work #2 for channel scope; restores the least-privilege
  guarantee the affected ACs assert.
- **Required with the fix (done):** a real-request regression test — a `channel:` token must be 403 on the
  `/pty` surface AND still reach its legitimate meta/firehose/session routes
  (`pty-scope-breach.test.ts`; the existing `scope.test.ts` channel-contract tests stay green, proving no
  over-restriction).
- **Re-verification (pending):** the INV-001 conjunct of AC-010/011/012/017/018/022 must be re-audited on
  the fixed path; their current "Met" evidence is invalidated on that clause (see the acceptance audit).
- **Audit obligation (met):** the fix is an **allowlist** (deny-by-default), so any top-level route not
  explicitly listed — including ones not yet enumerated — is denied by construction; `/pty` is not treated as
  the only dangerous route.
- **Neutral:** `admin` and `client` scopes are unchanged.

## Alternatives considered

- **Blocklist the known-dangerous routes (`/pty`, …) for channel.** Rejected: a blocklist is fragile — a
  future top-level route (or a sync-added one) is allowed by default, re-opening the class. INV-001 mandates
  deny-by-default.
- **Restore `OPENCODE_SERVER_PASSWORD` / keep upstream pty auth as defense-in-depth.** Rejected as the
  primary fix: upstream auth is Basic and re-enabling it would break the Bearer-token flow marid-auth is
  built on (ADR-0003); marid-auth is the intended sole gate. (A separate defense-in-depth hardening could be
  considered later, but the authorization gate is the correct place to fix this.)
- **Status quo.** Rejected: a standing INV-001 breach (arbitrary shell execution from untrusted channel
  ingress).

## Links

- Invariant: **INV-001** (deny-by-default channel capability policy).
- Risk: [RISK-026](../risks/risk-register.md).
- Evidence / regression: `packages/marid-gateway/test/pty-scope-breach.test.ts`; fix in
  `packages/marid-gateway/src/scope.ts` (`channelNonSessionAllowed`).
- Affected acceptance: AC-010/011/012 (Telegram INV-001), AC-017, AC-018, AC-022 (WhatsApp INV-001) — see
  [acceptance-audit](../validation/acceptance-audit.md).
- Related: ADR-0016 (the SSE firehose INV-001 fix — same class, additive-in-gateway), ADR-0011 (marid
  gateway), ADR-0003 (marid-auth facade, why the upstream password is deleted), deferred-work #2.
