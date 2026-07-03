---
artifact: current-state-assessment
status: Approved (gate 4, 2026-07-03 — with approved principle: reuse over new unless justified)
version: v1.0
updated: 2026-07-03
---

# Current-State OpenCode Assessment (Gate 4)

Synthesis of research tracks R-01..R-08 against upstream `anomalyco/opencode@eb3476660` (dev,
2026-07-03). Detailed evidence lives in the numbered track documents in this directory and in
`../../research/findings/`. Verdicts here are **Proposed** — they become decisions only at gates 5–6.

## Headline

**Most of the target product already exists upstream.** The remote API + SSE (7/16 FRs as-is, 6 partial),
event-sourced session storage with durable replay, a rich event taxonomy, optional-by-config LSP, wired
OTLP export, and full cross-platform release machinery are present. The genuinely missing pieces are:
authentication beyond a single Basic credential, rate limiting, audit logging, multi-instance isolation,
channel adapters (Slack is a 146-line prototype), retention policy, and restart resume. The riskiest
in-flight upstream churn is the **v1→v2 API/SDK migration** (v2 marked Experimental everywhere).

## Capability assessment (§3 "Important" — exists / stability / fit / limits / proposed verdict)

| Capability | Exists? | Stability | Fits target? | Key limitations | Proposed verdict |
|---|---|---|---|---|---|
| HTTP server (Effect httpapi, not Hono) | Yes | v1 stable, v2 Experimental | Yes | No authz/rate-limit/audit; Basic auth optional, off by default | **Reuse + extend** (auth/rate/audit as added layer) |
| SSE streaming + event taxonomy | Yes | Stable core | Yes | Firehose live-only; no `Last-Event-ID`; v2 session SSE has `?after=<seq>` replay | **Reuse**; extend replay only if a gap shows |
| Session ops over HTTP (create/discover/history/prompt/cancel/resume/permissions) | Yes (7 FRs as-is) | Mixed v1/v2 | Yes | Dual API generations; idempotency partial (client IDs + ConflictError, no Idempotency-Key) | **Reuse**; pick v1-now/v2-when-stable at gate 7 |
| SDK | Yes (`@opencode-ai/sdk`) | Replacement in flight (client→sdk-next) | Yes | Migration churn; sdk-next README declares replacement intent | **Reuse v1 SDK now**; track migration as upstream-sync risk |
| Session storage (SQLite WAL + Drizzle, event-sourced v2 tables) | Yes | Core stable; v2 coordinator partially wired | Yes | Legacy JSON store still used by revert/CLI/stats; dual message models | **Reuse**; do not fork the storage layer |
| Cross-client sync | Partial | — | Partially | Live events are per-server-process only; two processes sharing the DB don't share events | **Extend**: one server process per instance is the natural fix (all clients attach to it) |
| Concurrency/queueing/steering | Partial | v2 queue built, partially wired | Partially | Second prompt implicitly joins running loop; single-writer + steal endpoint exists in v2 | **Reuse v2 design**; wire/verify rather than invent |
| Agent loop, tools, permissions, skills/commands, subagents | Yes | Stable (hot churn in server/session only) | Yes | Wildcard ruleset permissions, session-lifetime "always allow" (`unverified` persistence) | **Reuse as-is** |
| Plugins | Yes | Stable | Yes with caution | In-process, zero isolation, full shell/SDK access; runtime npm-install | **Reuse**; trust policy + supply-chain controls at gate 8 |
| MCP client (stdio+HTTP/SSE, OAuth) | Yes | Stable | Yes | Tool-output trust (threat model) | **Reuse** |
| LSP | Yes | Stable | Optional | Cleanly disableable (`lsp: false`) | **Make optional** (config-off by default in distribution profile) |
| Providers (models.dev catalog + AI SDK) | Yes | Stable | Yes | Runtime npm-install of provider packages = supply-chain surface | **Reuse**; pin/verify installs at gate 8 |
| Config layering | Yes (7-layer deep-merge) | Stable | Mostly | No instance layer; no secret references; managed-config layer is cloud-coupled | **Extend** (instance layer + secret refs) |
| Secrets | Partial | — | Partially | `auth.json` 0600 but unlocked RMW (lost-write across instances); no redaction guarantees audit | **Extend** |
| Caching | Yes (models.json Flock-guarded; LSP bin cache) | Stable | Yes | LSP binary cache lock `unverified` (torn-install risk) | **Reuse**; namespace per instance |
| Observability | Yes (OTLP logs+traces, opt-in) | Stable | Yes | No metrics exporter; no audit-vs-ops separation | **Extend** (metrics + audit stream; GenAI attrs pinned per R-10) |
| Multi-instance | No | — | No | Shared DB/auth.json/config/log/cache; port 4096 preference; no PID files; hard `process.exit()` | **New component** (instance manager / namespacing layer) |
| Channels | Prototype (`packages/slack`, one-off) | Prototype | Pattern only | No identity mapping, permissions, webhook validation, or streaming simulation | **New component** using the proven public-API gateway pattern (Slack + Shaheen both attest) |
| Release/packaging | Yes (12-target Bun binaries, npm, Docker/ghcr, install script, self-update) | Stable | Yes | Publishes to public channels; needs private re-targeting | **Reuse + re-target** to private releases |
| Web UI (`packages/app`) | Yes | Stable | Yes | Optional Basic auth only | **Keep**; rides the same public API |

## Package classification (R-01 merged with R-06 corrections)

- **Required (15):** opencode, core, llm, schema, protocol, server, tui, plugin, sdk, ui, app, session-ui, effect-drizzle-sqlite, effect-sqlite-node, script.
- **Exclude candidates (9, no dangling edges):** desktop (Electron), console (cloud portal: OpenAuth/Stripe/Planetscale), stats (public telemetry site), slack (prototype; pattern harvested), function (CF Worker share backend), enterprise (self-hosted share-link server — *decide: share feature wanted?*), containers (CI images), docs, identity (logo assets only).
- **Needs-decision (8):** cli (hidden `lildax` rewrite), client + sdk-next + httpapi-codegen (v2 SDK chain — keep to track upstream migration), codemode (experimental, zero consumers), storybook (dev tooling), web (docs site — keep only if product docs wanted), http-recorder (test utility — likely keep, tests use it).

## Strategic findings that shape the architecture (gate 5 inputs)

1. **One server process per instance** resolves cross-client sync naturally: live events already reach
   every client of the same server; nothing shares events across processes today (R-03).
2. **The public-API gateway pattern is proven twice** (Slack prototype, Shaheen WhatsApp gateway):
   channels live outside the core and speak HTTP+SSE only — matching CON-006 with zero core diff.
3. **The v1→v2 migration is the largest upstream-sync hazard**: build on v1 (stable, published SDK) while
   tracking v2; revisit at each sync (feeds DEC-003/DEC-004 and the risk register).
4. **Multi-instance = mostly environment variables**: `OPENCODE_DB`, XDG dir overrides, and port selection
   already exist as seams; the missing piece is an instance manager that composes them plus locks for
   auth.json and the LSP bin cache (R-05 conflict inventory). The user-supplied claudectl reference
   (R-11, `../../research/findings/claudectl-analysis.md`) proves the shape: thin launchers + env vars +
   directory-as-registry, extended with port allocation and PID/lifecycle because our instances are
   server processes.
5. **Security posture for the threat model** (gate 8): plugins in-process/unsandboxed; bash tree-sitter
   parsing but no OS sandbox; runtime npm-install; default-unauthenticated server; single Basic credential
   as the only local auth. OWASP LLM01 mitigations must sit at the tool-authorization boundary (R-10).
6. **Licensing is clean**: MIT; keep copyright + permission notice in the private fork (R-01, closes OQ-008).
7. **Known-stale documentation**: CLAUDE.md says Hono (gone) and Tauri (it's Electron). Diagram
   validation (R-08, `07-diagram-validation.md`): of the 19 diagrams, 7 ACCURATE, 8 MINOR-DRIFT,
   4 OUTDATED (16-message-domain-model, 10-streaming-pipeline, 13-deployment, 03-tech-stack). R-08 also
   corrected R-03: a v2 `permission` table does exist (`packages/core/src/permission/sql.ts`).

## Open items carried out of gate 4

- OQ-005 (web-surface keep list) — evidence gathered; final call at gate 6 (recommend: keep app+ui+session-ui;
  web only if docs wanted; drop console/desktop/storybook from the distribution).
- Whether the session **share feature** (enterprise/function/web share pages) is wanted at all — new question for gate 6.
- v2-queue wiring completeness (U-2) — needs a two-client concurrency experiment before the sync design is final (Stage 13).
