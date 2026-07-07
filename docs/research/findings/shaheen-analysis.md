---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# R-07: Reference Analysis — github.com/ahmadabusa3/shaheen

Access: SUCCESS. Cloned `--depth 50` on 2026-07-03 into session scratchpad. Read-only analysis; no repo scripts executed, no dependencies installed. All verdicts below are PROPOSALS for the owner, not decisions.

## 1. What shaheen is

- **Not a git fork.** Fresh repo, 3 commits, all 2026-06-30 (`b0dbdba` initial, then 2 trivial commits). History was squashed at import.
- **A vendored hard fork of OpenCode** repackaged as a "headless multi-agent framework":
  - `src/runtime/` = OpenCode `packages/opencode/src` inherited at **tag v1.14.39 (commit `d35cdff…`, 2026-05-07)** from `anomalyco/opencode`, per `docs/adr/adr-00001-...md:30` and `docs/architecture/architecture-00001-overview.md:74-76`. `@opencode-ai/core` vendored into `src/runtime/core/`.
  - `src/framework/` = the owned domain layer (bootstrap, `/v1/*` HTTP routes, orchestrator pipeline/council/router, plugins, markdown agents).
  - `gateway/` = separate Node service bridging **WhatsApp (Baileys)** into runtime sessions.
- Explicitly "maintained independently" — **no upstream sync machinery exists** (no subtree/submodule, no sync scripts, no UPSTREAM file; `NOTICE.md` is referenced in docs but absent from the tree).
- Same Bun conditional-import pattern as upstream (`#hono`/`#db`/`#pty`, `package.json:23-44`); still depends on `@opencode-ai/plugin` + `@opencode-ai/sdk` 1.14.40 as external packages (`package.json:82-83`).

## 2. Patterns by topic (§15)

### 2.1 OpenCode customization approach — extend-hook layering
- **Source:** `src/runtime/server/server.ts:44` (`export function extend(fn: (app: Hono) => void)`), `src/framework/bootstrap.ts`, CHANGELOG.md:29-30. Dependency rule: framework imports runtime, never the reverse (`docs/architecture/architecture-00001-overview.md:66-68`).
- **Benefit:** all downstream code lives in one owned layer; the vendored core carries a single ~5-line diff (the hook), making the customization surface auditable.
- **To adopt:** add one `Server.extend(fn)` hook to `packages/opencode/src/server/server.ts` (or use plugin API if sufficient); keep downstream routes/plugins in a separate package.
- **Risks:** hook placement relative to middleware ordering (shaheen registers before workspace routing); trivially rebased.
- **Verdict candidate: ADOPT** — minimal-diff extension point is the cleanest downstream pattern in the repo.

### 2.2 Package reduction — physical deletion + hygiene tests
- **Source:** CHANGELOG.md:25-26 ("Stripped TUI, web, GitHub action installer, autoupdate, generator, and other CLI commands"); `docs/components.md:81` (`src/runtime/index.ts` deleted during inheritance); enforced by `tests/runtime/no-tui.test.ts` (no `@opentui/*` residue) per `docs/workflow/workflow-00002-testing-and-ci.md:38-40`.
- **Mechanism:** hard deletion of directories/files at import time — NOT build exclusion or flags. Deletion is then locked in by grep-based test guards so regressions fail CI.
- **Benefit:** small binary, no TUI/web deps, no autoupdate phoning home; test guard makes the reduction durable.
- **To adopt:** for a distribution built as a fork-in-place (not vendored), deletion creates permanent merge conflicts with upstream; prefer build-time exclusion unless going the vendored route.
- **Verdict candidate: ADAPT** — keep the *hygiene-test* idea (cheap, high value); choose deletion vs. build exclusion based on the sync strategy decided elsewhere.

### 2.3 Remote access / server & auth — two-layer auth
- **Source:** `docs/architecture/architecture-00001-overview.md:165-174`; `src/framework/server/routes.ts:13-14,43`; `src/runtime/server/middleware.ts` (AuthMiddleware).
- **Pattern:** runtime-level HTTP **Basic** (`SHAHEEN_SERVER_PASSWORD`, covers all routes when set — this is upstream OpenCode's `OPENCODE_SERVER_PASSWORD` renamed) + framework-level **Bearer** (`SHAHEEN_API_TOKEN`) wrapping only `/v1/*`. `/healthz`, `/workspaces`, `/channels/*` rely on the Basic layer + a fronting reverse proxy (Caddy).
- Multi-workspace routing via `?directory=` / `x-shaheen-directory` header (`server/routes/instance/httpapi/middleware/workspace-routing.ts`) — one runtime serves many agent workspaces.
- **Risks:** both auth vars are optional → server can boot fully open ("server is unsecured" log). Documented honestly, but a footgun for a private distribution.
- **Verdict candidate: ADAPT** — adopt bearer-wrapped domain API + header-based workspace selection; make the token mandatory (fail-fast at startup) rather than optional.

### 2.4 Channel adapters — WhatsApp gateway as separate service
- **Source:** `gateway/src/whatsapp/baileys.ts`, `gateway/src/core/pipeline.ts` (324 lines; `handleInbound`: route resolution → S3 media audit → session continuity per `(account,chat)` → `prompt_async` → poll reply → chunk/send), `gateway/src/core/routes.ts` (hot-reloaded `routes.json`, default-deny sender/group allowlists), `docs/adr/adr-00002` and `adr-00003` (per-account Baileys process, no webhook).
- **Pattern:** gateway is a **separate process** talking to the runtime only over its public HTTP API (`gateway/src/core/shaheen.ts:29,53` — `x-shaheen-directory` header + `POST /session/:id/prompt_async` + poll `GET /session/:id/message`). No Telegram/other channels present, but `docs/adr/adr-00002` frames the routes.json/admin-API design as channel-agnostic.
- **Verdict candidate: ADOPT (architecture), DEFER (Baileys specifically)** — process-per-channel over the public API keeps the core untouched; Baileys is an unofficial WhatsApp client with ban/breakage risk, so adopt only if WhatsApp is a confirmed requirement.

### 2.5 Configuration approach
- **Source:** `shaheen.json` (root: port/hostname, `default_agent`, `instructions[]`, provider catalog, tool permission defaults, `mcp:{}`); `.env.example` (73+ documented env vars); `docs/architecture/architecture-00002-...md` ("every env var the code reads").
- **Pattern:** upstream OpenCode config schema kept, renamed (`opencode.json` → `shaheen.json`); env prefix renamed `OPENCODE_*` → `SHAHEEN_*`; agents as markdown+YAML frontmatter in `src/framework/agents/*.md` and `.shaheen/agent/`. Docker bakes config via `SHAHEEN_CONFIG_DIR=/etc/shaheen` (Dockerfile:11-14).
- **Verdict candidate: ADOPT** — reusing the upstream config system unchanged (rename only) minimizes divergence; the exhaustive env-var reference doc is worth copying as a practice.

### 2.6 Session handling changes
- **Source:** `docs/architecture/architecture-00001-overview.md:83` — added `POST /session/:id/prompt_async` (fire-and-forget 204) alongside upstream's streaming message route; gateway maps `(account, chat) → sessionId` persistently (`gateway/src/core/sessions.ts`) and polls for completion.
- **Additions to core:** per-agent `mcp: string[]` frontmatter allowlist filtered in `MCP.tools()` so blocked servers never reach the LLM tool array (CHANGELOG.md:14-21, `tests/unit/agent-mcp-allowlist.test.ts`); `calc` deterministic decimal tool (CHANGELOG.md:5-13).
- **Verdict candidate: ADOPT** — `prompt_async` + external session-continuity map is the right shape for channel bots; the MCP allowlist is a genuinely good idea worth proposing upstream.

### 2.7 Headless permission policy (safety for untrusted input)
- **Source:** `docs/adr/adr-00005-headless-permission-policy-and-untrusted-input.md`; `src/framework/plugins/permission-policy.ts` (`decide()`: read-only → allow, suspicious bash regex → deny, other bash → ask, unknown → deny); `plugins/guardrails.ts` (`isSensitivePath`/`isDestructiveBash`/`redactSecrets`); per-turn `untrustedNotice` system framing at `gateway/src/core/pipeline.ts:25,203`.
- **Risks (self-acknowledged in ADR):** regex denylist is not a sandbox; prompt notice is mitigation, not guarantee.
- **Verdict candidate: ADAPT** — default-closed deterministic policy + untrusted-input framing are must-haves for any headless deployment; strengthen bash handling with a real sandbox rather than the regex.

### 2.8 Deployment
- **Source:** `Dockerfile` (bun --compile → distroless `gcr.io/distroless/cc-debian12`, single static binary, :7711); `gateway/deploy/shaheen-whatsapp@.service` (systemd **template unit**, one instance per WhatsApp account), `Caddyfile.snippet`, `sudoers.snippet`; `.github/workflows/deploy*.yml.example` (self-hosted runner, rsync excluding runtime state, `sudo systemctl restart`, health-check; shipped as `*.example` so Actions ignores them — README.md:40-44).
- **Verdict candidate: ADOPT** — distroless single-binary image and systemd template units are simple and appropriate; the `*.yml.example` convention for deploy templates is a nice touch.

### 2.9 Distribution
- **Source:** `scripts/build.ts:4-17` (5 cross-platform `bun build --compile` targets → `dist/`); `.github/workflows/release.yml` (tag `v*` → build all → GitHub Release via `softprops/action-gh-release`, auto release notes).
- **Verdict candidate: ADOPT** — mirrors upstream's own build approach, ~20 lines total; GitHub Releases on a private repo is the lowest-cost private distribution channel.

### 2.10 Upstream synchronization
- **Source:** `docs/adr/adr-00001:59` ("can modify it without upstream coupling"); `docs/architecture.md:28` ("fully owned"). No sync scripts, no subtree, no upstream remote, squashed history.
- **Pattern:** deliberate **no-sync hard fork** pinned at v1.14.39. The only machinery is the rebrand-hygiene tests. Referenced `NOTICE.md` is missing from the tree (attribution gap; OpenCode is MIT so low legal risk, but sloppy).
- **Verdict candidate: REJECT for our purposes** — a downstream *distribution* of OpenCode (vs. a divergent product) should track upstream; freezing at one tag forfeits security/model/provider updates within weeks. Also fix: any adopted approach must carry LICENSE/NOTICE properly.

### 2.11 Testing approach
- **Source:** `tests/unit/` (5 files: router, permission-policy, guardrails, calc, mcp-allowlist), `tests/runtime/` (2 grep-guard tests), `.github/workflows/ci.yml` (typecheck + `bun test tests/unit tests/runtime`), `gateway/src/core/{otp,routes}.test.ts`.
- **Gaps (self-documented at `docs/workflow/workflow-00002:44-56`):** `test:contract` and `test:integration` scripts point at directories that **do not exist**; CI does not run lint or build; the vendored runtime itself has essentially no tests. Coverage is thin — nowhere near an 80% bar.
- **Verdict candidate: ADAPT** — copy the grep-guard "hygiene tests" and testing-the-owned-layer focus; do not copy the phantom test scripts or the missing runtime coverage.

### 2.12 Branding / documentation
- **Source:** full mechanical rebrand `opencode → shaheen` incl. env prefix, XDG dirs (`~/.local/share/shaheen/`), DB name, config filename (CHANGELOG.md:27-28), enforced by `tests/runtime/no-opencode.test.ts` with a documented allowlist (SDK package names, LICENSE). Docs: numbered ADRs (`docs/adr/`), numbered architecture/workflow/rules docs, `docs/index.md` index, mermaid diagrams, per-doc file-path grounding, `.env.example` as canonical env reference.
- **Verdict candidate: ADOPT (docs discipline), ADAPT (rebrand)** — the allowlisted no-upstream-name test is the best branding idea here; the rebrand-everything approach only makes sense with the hard-fork strategy — a tracking fork should rebrand user-visible surfaces only.

## 3. Quality signals

- **Activity:** 3 commits, all 2026-06-30; shallow clone shows no earlier history (squashed import). Migration folders dated 2026-01→2026-05 match upstream's timeline, confirming the v1.14.39 baseline.
- **Docs:** unusually good — 5 ADRs, exhaustive env/API references, honest about gaps (open `/v1` when token unset, missing test dirs, missing prod infra). Docs quality > code-coverage quality.
- **Tests:** thin but real; the two rebrand-guard tests are the standout novelty.
- **Secrets:** none found committed. `.env.example` and `gateway/.env.example` contain empty placeholders only (verified by grep for key/token/password patterns).
- **Concern:** missing `NOTICE.md` despite doc references; single-author, single-day import — treat as a design reference, not a battle-tested base.

## 4. Summary of proposal candidates

| # | Pattern | Verdict candidate |
|---|---------|-------------------|
| 1 | `Server.extend` hook + owned framework layer | ADOPT |
| 2 | Deletion + grep hygiene tests for package reduction | ADAPT (keep tests; pick exclusion mechanism per sync strategy) |
| 3 | Two-layer auth (Basic + Bearer /v1) + workspace header | ADAPT (make tokens mandatory) |
| 4 | Channel gateway as separate process over public API | ADOPT (Baileys itself: DEFER) |
| 5 | Upstream config schema reused, renamed | ADOPT |
| 6 | `prompt_async` + external session map; MCP frontmatter allowlist | ADOPT |
| 7 | Deterministic headless permission policy + untrusted framing | ADAPT (add real sandbox) |
| 8 | Distroless single-binary Docker + systemd template units | ADOPT |
| 9 | Tag-triggered cross-platform release to GitHub Releases | ADOPT |
| 10 | No-sync hard fork frozen at v1.14.39 | REJECT (track upstream instead) |
| 11 | Phantom contract/integration test scripts | REJECT |
| 12 | Full mechanical rebrand incl. internals | REJECT as-is (rebrand user-visible surfaces only) |
