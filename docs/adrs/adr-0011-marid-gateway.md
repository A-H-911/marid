---
id: ADR-0011
status: Approved
version: 1.2.0
updated: 2026-07-12
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0011 — Marid Gateway: marid-auth becomes a component of a server-side gateway

**Status:** **Approved (2026-07-10 operator PH-6 gate; EXP-008 validates additive-mirroring at build)** · relates to FR-031/032/033/035/038/042/045, FR-066, INV-001,
CON-006, NFR-001, DEC-017, ADR-0003/0004/0005, [C-11](../architecture/technology-comparison.md),
[R-11/R-12 + gateway study](../research/findings/telegram-options.md). Design derived from OpenClaw + Shaheen
(read directly, 2026-07-10).

**Context.** `marid-auth` today is a server-side **outer HTTP middleware wrapper** on the exported
`Server.Default().app.fetch` (the EXP-004 seam) — token-verify, scope authz (`scope.ts`), rate-limit, audit, and
per-connection SSE/list **event-filter** ownership isolation (`event-filter.ts`), with **zero upstream patch
surface** (P-1 struck). Channels are separate processes that talk the public HTTP+SSE API via
`@opencode-ai/sdk/v2` with a `channel:` bearer token; there is **no shared client wrapper** (each channel re-wires
the SDK). The operator wants `marid-auth` to grow into a **Gateway** — a component that unifies auth/authz with
the HTTP+SSE surface and coordinates cross-client session mirroring (ADR-0012). The two named references were
studied at source: **OpenClaw** (MIT) — a typed wire API, connect-auth + device-token scope-binding, event
fan-out (per-connection `seq`, `stateVersion`, "no replay; refresh on gap"), a session-identity/docking model, and
**server-side capability-allowlist enforcement**; its *channels* are in-process plugins (wrong template) but its
**nodes** (separate process + token + server-enforced allowlist) are the right analog. **Shaheen** — a
separate-process gateway over the public API behind one `Server.extend(fn)` hook (the additive-patch template).

**Decision.** Evolve `marid-auth` into a **server-side Marid Gateway**; `marid-auth` (authn/authz/rate-limit/
audit/event-filter) becomes one **module** within it. Design (ADOPT/ADAPT/REJECT per concept):

1. **Auth — ADAPT.** Keep the static `channel:` **bearer + server-side scope set**, made **mandatory/fail-fast**
   (Shaheen footgun fix). Adopt OpenClaw's **device-token scope-binding** concept: a token carries its scopes,
   supports rotate/revoke, and can never self-expand. **REJECT** OpenClaw's per-device keypair challenge-nonce
   handshake — overkill for a small set of operator-provisioned channels.
2. **One HTTP+SSE plane — ADAPT.** Collapse OpenClaw's WS control-plane onto Marid's **HTTP+SSE** (req/res → HTTP
   POST + idempotency key; server-push → SSE). Do **not** import OpenClaw's OpenAI-compat `/v1/*` "messaging
   plane" (model inference, already covered by OpenCode).
3. **Package split — ADOPT (shape), ADAPT (transport).** A schema/types package + a thin client-side
   **`@marid/channel-client`** mirroring `@openclaw/gateway-client` (SDK v2 + channel-token + event-pump +
   session-binding + streamer + reconnect/backoff/SSE-resume) that all channels consume. **REJECT** OpenClaw's
   in-process channel-plugin model; **ADOPT its node model** on **Shaheen's separate-process-over-public-API
   topology**.
4. **Server-side allowlist enforcement — ADAPT.** OpenClaw enforces node capability allowlists server-side — the
   exact shape for **INV-001 server-side**: the channel *declares* intent, the gateway *enforces*. Combine with
   Shaheen's default-deny sender allowlist.

**NFR-001 containment (load-bearing).** The new server-side surface — the fan-out/mirroring coordination
(ADR-0012), the session↔surface binding registry, and the cross-surface INV-001 enforcement point — is routed
through **ONE additive `Server.extend`-style ingress hook** (Shaheen pattern), never scattered across upstream
routes. Verified additive: mirroring rides the **existing** `/event` firehose + per-connection `event-filter`
(ADR-0012), so **no new broadcast bus and no upstream edit** are required; the binding registry is additive state
(like the existing `ownership.json`). The one residual upstream-edit risk — a write path *iff* OpenCode owns
session metadata the registry needs — becomes the single enumerated `P-*` and nothing more. Reconcile the SDK
**v1→v2** wording (ADR-0008 says "v1"; the code imports `@opencode-ai/sdk/v2` — the v2 SDK client talking the
committed v1 routes) while editing the ADRs.

**Blast radius + gateway surface (added 2026-07-10, operator concern).** The gateway is a **shared component by
construction** — `marid-auth` already sits on the ingress path of every `marid serve` request, so TUI/Web/API
**already** depend on it (the gateway makes an existing dependency do more; it does not add a new hop). To keep the
*incremental* blast radius near zero:
- **Strict path isolation.** The proven **auth/scope/event-filter path stays untouched and independent**
  (TEST-AUTH/TEST-SEC keep it green — RISK-017); mirroring/binding/fan-out is a **separate additive module**.
- **No-op for plain clients.** A TUI/Web/API request for an **unattached** session takes a code path **byte-for-byte
  identical to today** (the binding-aware `isVisible` is a strict superset of the current ownership filter — no
  binding ⇒ current behavior).
- **Graceful degradation (fail-safe).** A fault in the mirroring/registry module **degrades to today's non-mirrored
  behavior** (channels/TUI/Web still work, mirroring just stops) and **never** takes down auth or a plain-client
  request. EXP-008 tests this explicitly.
- **New endpoints are contracted, not scattered.** The gateway's new **attach / binding / mirror-control**
  endpoints are **additive to the existing OpenAPI** (the server already generates one — FR-035), covered by the
  existing **health/readiness/version** surface (FR-034), **pinned by TEST-CONTRACT**, and **sync-durable** — they
  live in the additive gateway hook, not in edited upstream routes (NFR-001). AC-024 asserts this.
- Rejected as a mitigation: a **separate proxy process** (C-11 option C) — it would ADD a network hop + its own SPOF
  in front of every client, not reduce blast radius; server-side module isolation + fail-safe is the right control.

**Consequences.** Channels stop re-wiring the SDK (DRY via `@marid/channel-client`); the gateway is the single
place that carries auth + the session-sync coordination; the INV-001 enforcement Marid already proved stays
server-side and must remain green (TEST-AUTH/TEST-SEC — RISK-017). Additive posture preserved (new package +
expanded wrapper + at most one enumerated hook). Realized in PH-6 (WBS-6.1). ADR-0005 unchanged (channels stay
separate processes holding no provider keys).

**Rejected.** (1) **Client-side `@marid/channel-client` only** (no server-side gateway) — doesn't satisfy "marid-auth
is a component in the gateway" and can't coordinate cross-surface mirroring/permissions server-side. (2) **A
standalone proxy process** in front of `marid serve` — heaviest; buys nothing the wrapper + firehose can't already
do additively. (3) **Importing OpenClaw's WS + in-process-channel model wholesale** — wrong transport (Marid is
HTTP+SSE) and wrong isolation (Marid channels are separate processes); its *nodes* model + Shaheen topology are the
right adaptation.

**Realization note (2026-07-12).** The package that carried this component was renamed to match the decision:
**`@marid/auth` → `@marid/gateway`** (`packages/marid-auth/` → `packages/marid-gateway/`). This is a
**behaviour-neutral** realization of the Decision above — the package now *is* the Marid Gateway, and `marid-auth`
(authn/authz/rate-limit/audit/event-filter) remains one **module** within it (unchanged source; the 13 suites pass
identically under the new name). Nothing depends on the literal string `"marid-auth"` at runtime (the on-disk token
store path is `${Global.Path.data}/marid`, not the package name), so the rename touched only the package name, the
`@opencode-ai/opencode` workspace dep, the `@marid/gateway` import specifiers, the `ci.yml` test-step `--cwd` path,
and `bun.lock`. **Zero new patch surface** — the wrapper seam (P-1 resolved, EXP-004) is unchanged. Historical
references to `marid-auth`/`@marid/auth` in prior ADRs, experiment reports, and the progress log are left intact as
dated records; they name the auth module, which persists.
