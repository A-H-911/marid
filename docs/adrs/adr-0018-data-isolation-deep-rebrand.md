---
id: ADR-0018
status: Proposed
version: 1.0.0
updated: 2026-07-13
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0018 — Total data isolation from co-installed OpenCode + deep rebrand (PH-8)

## Status

**Proposed** (2026-07-13, drafted at PH-8 Phase 0 by the execution agent) — **awaiting the operator
approval gate at Phase 0 exit (INV-005).** No code phase (PH-8 Phase 1+) begins until this ADR is Approved.
The four operator decisions locked in the twice-reviewed plan §2 are recorded below as **Approved** DECs
with provenance; the one plan *recommendation* not yet operator-ruled (no DB rename) is recorded **Proposed**.

## Context

The public **Marid v0.2.0** binary (`marid.exe`, `v0.2.0` tag `f8847664`) was run by the operator on a
machine with a co-installed OpenCode. It still leaks the OpenCode identity and **shares machine state** with
that co-installed OpenCode. Six issues were reported:

1. **Update popup** — "v1.17.18 available… update now?" (upstream auto-update; would overwrite the marid
   binary with opencode).
2. **Model/token surprise** — a "fresh" binary showed "Build · glm-5.2 nvidia" + a token. **Verified NOT a
   bundled-secret leak** (the profile build disables dotenv/bunfig autoload; the `define` block bakes only
   version/models/worker paths — no secret). **Root cause: shared machine-global directories** —
   `~/.local/share/opencode/auth.json` (provider `nvidia-custom`) and `~/.local/state/opencode/model.json`
   are read by both installs. **Fixed by data isolation; no token rotation required.**
3. **TUI still OpenCode in places** — separate `/exit` goodbye wordmark + `opencode -s` hint, sidebar footer
   "● OpenCode {version}", notification title "opencode", the update toast, an OpenCode-GO upsell, and a
   startup flame/wordmark that diverges from the brand spec.
4. **Agent self-identity** — "What is your role?" answers "You are **opencode**…" (system-prompt text files);
   the agent is even instructed to WebFetch `opencode.ai/docs` to describe itself.
5. **Web UI** — favicon / PWA icons / `Mark`+`Splash` glyphs / social image / notification icon /
   release-notes popup (fetches `opencode.ai/changelog.json`) still OpenCode. The web UI is **not embedded in
   the binary** (verified) — a separate track that does not gate the TUI/binary release.
6. **Total isolation** — co-installed OpenCode and Marid share dirs / auth / sessions / config / DB.

**This triggers the branding boundary Marid deliberately deferred.** `branding.md` ("Rebrand boundary")
states internal identifiers, `OPENCODE_*` env prefixes, XDG dir names, and DB names *"stay upstream to keep
the sync surface small — revisit only if a conflict with genuine OpenCode installs on the same machine
emerges (instance dirs already prevent it)."* That exact conflict has now emerged for a **plain
(non-instance) run** of the public binary. PH-8 revisits the boundary: **XDG dir names change (data
isolation); `OPENCODE_*` env stays (ecosystem compat); the DB file name stays (internal, now inside the
isolated dir).**

> **Line-number note (plan §1.5 trap):** PH-8 Phase 1 is an upstream sync (167 commits / 458 files) that
> lands *before* any isolation/rebrand code. Every source location in this ADR is **pre-sync and
> illustrative** — each code phase re-enumerates its target sites against post-sync `develop`. This ADR
> records *mechanism + decision*, not line numbers.

## Decision (proposed)

### D1 · Total DATA isolation via a build-time app-name — keep `OPENCODE_*` env (DEC-022, Approved)

Marid's data/state/config directories and file lock derive from a single upstream constant (`global`'s
`const app = "opencode"`, which seeds `~/.local/share/<app>`, `~/.local/state/<app>`, `~/.config/<app>`, and
the `Flock` name). Isolate all of them at once by making that constant read a **build-time `define`**:

- `const app = process.env.__MARID_APP ?? "opencode"` (**dot notation** — the proven define form, see
  `assumptions` / `marid-build.ts`'s existing `process.env.OPENTUI_LIBC` define). **P-6.**
- The profile build (`script/marid-build.ts`) bakes `"process.env.__MARID_APP": '"marid"'`; the dev entry
  (`src/marid.ts`) sets `__MARID_APP` on its first line so **`bun run src/marid.ts`** (the marid dev path —
  **never `bun dev`**, which runs upstream `index.ts`) matches the binary.
- **`OPENCODE_*` env is KEPT unchanged** (DEC-009 reuse — third-party OpenCode plugins/extensions read them;
  Marid's own instance/test infra sets them). Isolation is achieved by the app-name, **not** by renaming env.
- **Pierce disclosure (mandatory).** A user who has data-layer `OPENCODE_*` overrides set globally
  (`OPENCODE_CONFIG_DIR`, `OPENCODE_DB=<abs>`, `OPENCODE_CONFIG`/`OPENCODE_CONFIG_CONTENT`,
  `OPENCODE_AUTH_CONTENT`) will have isolation *pierced* — these point at concrete paths/content that survive
  the app-name change. These cannot be dropped (Marid needs them) and must not be silently honored: on boot
  the binary **logs a WARN naming each active data-layer override**, `usage.md` carries an "env vars that
  pierce isolation" table, and negative tests assert the disclosed behavior.

### D2 · Config filename + fallback (DEC-023, Approved)

- **`marid.json` / `.jsonc` is the primary config name at every level.**
- **Project level:** fall back to a repo's existing `opencode.json` (so checked-in OpenCode repos keep
  working) — a Marid `marid.json` wins when both exist.
- **Global level:** read **`~/.config/marid/` only — never `~/.config/opencode/`.** A global OpenCode config
  fallback would re-import the very model/provider bleed reported (issue 2); it is explicitly rejected.
- Config **writers** (`cli/cmd/mcp.ts`, which creates config files) write `marid.json`; the `$schema` URL
  written into user files (`config.ts`) and managed-config identifiers (`config/managed.ts`,
  `C:\ProgramData\opencode`, `ai.opencode.managed`) are covered by the `$schema` policy in D7. **P-7.**

### D3 · `.opencode/` project directories KEPT upstream-named (DEC-024, Approved)

The `.opencode/` project-dir convention (agents / skills / plugins / commands discovery) **keeps the upstream
name** — same rationale as kept env: smallest sync surface, ecosystem compatibility (third-party
agents/skills reference `.opencode/`). Data isolation is about *machine-global* state, not project-local
opt-in content.

### D4 · Migration = one-time copy (DEC-025, Approved)

On first run when `~/.local/share/marid/` does not exist, **copy** the existing OpenCode data/state into the
marid dirs — `auth.json`, the `${data}/marid` gateway bearer tokens, the sessions DB, `model.json`, Telegram
pairing — then write a **marker** so it never re-runs, and log what was migrated. This avoids an auth outage:
gateway tokens + Telegram pairing survive the move. Also documented as a manual command in `usage.md`.

### D5 · No DB rename (DEC-027, **Proposed** — plan recommendation, not operator-locked)

The DB file **stays `opencode.db`** *inside* `~/.local/share/marid/`. Dir isolation already isolates it;
renaming would need two upstream branches (`database.ts` + its channel variant) and conflicts with
marid-instance's "don't hardcode" stance for zero operator-visible benefit (the name is internal, invisible
once the dir is isolated). **Recorded Proposed** — the operator confirms drop-vs-rename at the gate.

### D6 · Agent identity — FULL transform at the single choke point (DEC-026, Approved)

A Marid-owned transform wraps the **output** of `provider()` in `session/system.ts` (the single system-prompt
choke point; sole consumer `session/llm/request.ts`; custom-prompt agents bypass — acceptable). Full scope:
(1) **identity** → Marid; (2) **self-doc-fetch** instructions (agent told to WebFetch `opencode.ai/docs`
about itself) → point at Marid docs or neutralize; (3) **support/repo URLs** (`github.com/anomalyco/opencode`)
→ the Marid repo. A **CI guard** asserts no emitted system prompt matches `/\bopencode\b/i` outside an
allowlist (catches sync-added prompts like `prompt/meta.txt`). **P-8 only if the wrap requires editing the
upstream file**; if it composes additively at the choke point, no `P-*`.

### D7 · Update popup off + `$schema` policy

- **Popup:** lead with the repo's own config-over-code ladder — **P-3 distribution config default
  `autoupdate: false`** — plus bootstrap env `OPENCODE_DISABLE_AUTOUPDATE=1` as belt-and-braces. The upstream
  guard reads config OR env, so either suffices; both is defense-in-depth.
- **`$schema`:** decide at implementation whether Marid ships/points a `marid`-branded schema or leaves the
  upstream `opencode.ai/config.json` URL (harmless, remote, editor-only). Recorded here as an open
  implementation sub-point of D2, not a blocking decision.

### D8 · Deep TUI + Web rebrand (extends branding boundary; two-tone wordmark, Approved by operator)

- **TUI (in-binary):** exit goodbye logo + `marid -s` hint (`util/presentation.ts`), sidebar footer
  "● Marid {version}", `attention.ts` notification titles, update toast, **remove the GO upsell**
  (`logo.ts`), startup brand flame `#FBD24A→#F5901E→#DC2A16` + core `#FDEFB0→#F8B73C`, and the **two-tone
  wordmark `#2F6BFF` / `#F0731F`** (`logo.ts` / `logo.tsx` / `cli/ui.ts`) behind a **render gate** (incl. a
  256-color-terminal screenshot; fall back to crisp mono per-surface if illegible). Extends **P-2**.
- **Web (separate PR, not binary-embedded):** favicon set / PWA icons / social-share / `ui/components/logo.tsx`
  `Mark`+`Splash` regenerated from the flame; local notification icon (drop the `opencode.ai` remote);
  release-notes popup repointed/disabled. High sync-churn area — re-enumerate; does not gate the v0.3.0 TUI
  release.

## Issue → Acceptance → Test coverage (matrix row H, provable before code)

| Reported issue | Acceptance | Verified by |
|---|---|---|
| 6 · dirs/auth/sessions/config/DB shared | **AC-025** data isolation (effective read paths; fresh auth; coexistence; plugin-compat) | TEST-ISO |
| (env override caveat of 6) | **AC-026** env-pierce disclosure (WARN + disclosed behavior; kept-env still works) | TEST-ISO |
| 1 · update popup | **AC-027** no update popup (`autoupdate:false` + env) | TEST-ISO / TEST-TUI |
| 4 · agent self-identity | **AC-028** identity Q&A = Marid; no `\bopencode\b` in emitted prompts (CI guard) | TEST-IDENT |
| 3 · TUI OpenCode surfaces | **AC-029** startup/exit/footer/notif = Marid; no GO upsell; render gate | TEST-TUI |
| 5 · web UI OpenCode | **AC-030** favicon/PWA/social/Mark/Splash/notif = Marid; no `opencode.ai` fetch | TEST-WEB |
| 2 · model/token surprise (+ upgrade path) | **AC-031** one-time migration from populated v0.2.0; gateway tokens + Telegram pairing survive | TEST-ISO |

MS-009 exits when AC-025…031 are Met **and** all six reported issues map to a passing check, then v0.3.0 is
released.

## Pre-registered patch surface (finalized per phase; pre-sync/illustrative)

| # | Planned edit | Class | Sync risk |
|---|---|---|---|
| **P-6** (planned) | Data-dir isolation via app-name: `global` `const app = process.env.__MARID_APP ?? "opencode"` (dot-notation) + `"process.env.__MARID_APP": '"marid"'` define in `script/marid-build.ts` + dev set in `src/marid.ts` | Upstream edit (~1–2 lines) + additive build define | Low — Marid wins on reconcile |
| **P-7** (planned) | Config filename discovery + writers: `marid.json` primary, project-level `opencode.json` fallback, no global `opencode` fallback; touches config discovery, `cli/cmd/mcp.ts` writer, `config/managed.ts`, `$schema` policy (D7) | Upstream edit (several small sites) | Medium — Marid wins on reconcile |
| **P-8** (planned, conditional) | Agent-identity transform wrapping `provider()` output in `session/system.ts` — **only if additive wrap needs an upstream-file edit**; else no `P-*` | Upstream edit (choke point) or additive | Low |
| **P-2** (expansion) | TUI branding surfaces: `util/presentation.ts` exit logo, sidebar footer, `attention.ts`, update toast, GO-upsell removal + two-tone wordmark (`logo.ts`/`logo.tsx`/`cli/ui.ts`); web assets (`packages/ui`/`packages/app`) | Upstream branding edits | Low–medium — Marid wins on reconcile |

Everything else is additive (Marid-owned) — migration, pierce-disclosure WARN, config-fallback logic, and the
identity CI guard live in Marid packages. The delta report enumerates the P-* set at each sync.

## Consequences

- **Positive:** a plain `marid` binary no longer reads or writes any OpenCode machine-global path; the update
  popup and OpenCode identity are gone across TUI/agent/web; a co-installed OpenCode is untouched; the
  reported model/token bleed disappears (no shared `auth.json`/`model.json`); third-party `OPENCODE_*`-reading
  plugins keep working; a populated v0.2.0 install migrates once with no auth outage.
- **Cost / risk:** four small upstream patches (P-6/P-7/P-8/P-2) enter the sync surface — mitigated by
  "Marid wins on reconcile" + re-enumeration each phase. Inherited `OPENCODE_*` data-layer overrides *pierce*
  isolation — mitigated by detect-and-disclose (not silently defeated). Two-tone wordmark can muddy on
  256-color terminals — mitigated by a render gate.
- **Neutral:** `.opencode/` project dirs and `OPENCODE_*` env are unchanged by design; the DB keeps its
  internal name inside the isolated dir.

## Alternatives considered

- **Rename `OPENCODE_*` env for isolation.** Rejected: breaks third-party OpenCode plugins/extensions
  (DEC-009 reuse) and Marid's own instance/test infra; the app-name change isolates data without touching env.
- **Global `~/.config/opencode/` config fallback.** Rejected (D2): re-imports the reported model/provider
  bleed — the opposite of isolation.
- **Rename `.opencode/` project dirs.** Rejected (D3): breaks ecosystem agents/skills for no isolation gain
  (project-local opt-in, not machine-global state).
- **Rename the DB file.** Proposed-drop (D5): two upstream branches, conflicts with marid-instance, zero
  operator-visible benefit once the dir is isolated.
- **Fresh start + re-issue (no migration).** Rejected (D4): orphans gateway bearer tokens and Telegram
  pairing → an auth/pairing outage on upgrade.

## Links

- Plan (twice-reviewed): `~/.claude/plans/i-downloaded-the-latest-splendid-volcano.md`.
- Decisions: **DEC-022** (isolation + kept-env + pierce), **DEC-023** (config filename/fallback), **DEC-024**
  (`.opencode` kept), **DEC-025** (migration one-time copy), **DEC-026** (full identity transform), **DEC-027**
  (no DB rename, Proposed) — see [open-decision-register](../decisions/open-decision-register.md).
- Acceptance: **AC-025…031** — see [acceptance-criteria](../validation/acceptance-criteria.md).
- Phase / milestone: **PH-8** / **MS-009** — see [roadmap](../planning/roadmap.md),
  [milestones](../planning/milestones.md), [work-breakdown](../planning/work-breakdown.md).
- Amends: [branding.md](../branding/branding.md) "Rebrand boundary"; patch-surface register in
  [architecture.md](../architecture/architecture.md) (P-6/P-7/P-8, P-2 expansion).
- Invariants: **INV-002** (no secrets in logs/diffs — migration/auth work), **INV-003** (operator-approved
  push/merge), **INV-005** (this ADR is Proposed until the operator gate), **DEC-009** (reuse-first — kept env).
