---
status: Approved (gate 9, 2026-07-03)
version: v1.1
updated: 2026-07-13
owner: operator (STK-001)
---

# Upstream Synchronization Strategy + Git Workflow (Gate 9)

Basis: ADR-0001 (tracking fork, periodic merge, additive delta). Fulfills §13 + §14.

## Remotes, baseline, cadence

- `origin` = private Marid repo · `upstream` = https://github.com/anomalyco/opencode.git (fetch-only;
  push disabled by URL `no-push` convention).
- **Baseline recorded at fork time**: tag `upstream-baseline/<date>-<sha>` (candidate: eb3476660,
  re-confirmed at the forking gate per ASM-001).
- **Cadence:** scheduled **weekly conflict check** (automation, no merge) + **monthly merge** by default;
  **security fast-path**: upstream security releases merged out-of-band within days.

## Marid-owned paths (upstream never touches these)

`docs/`, `CLAUDE.md`, and `.claude/` are **Marid-only additions** — verified absent from `upstream/dev`
and the baseline tag via `git ls-tree` (2026-07-04). No upstream merge can conflict on them today. If
upstream ever adds its own `CLAUDE.md` or docs tree, **resolve in favor of Marid** (`git checkout --ours`
on these paths): they are Marid operating docs, not tracked upstream code. Same rule as workflow
ownership (P-CI-1) — Marid-owned files win on sync. (Note: `CLAUDE.md` was imported with the planning
package (commit `29038f6bc`, WBS-0.2) and describes the OpenCode codebase, but is absent from upstream's
tree at the baseline — how it was originally authored is not otherwise verified.)

**Marid-ized root docs (P-5, PH-5): `CONTRIBUTING.md`, `SECURITY.md`, `CONTEXT.md`, `STATS.md`.** These are
upstream-tracked but rewritten for Marid — **Marid wins on reconcile** (`git checkout --ours`). **`AGENTS.md`
is the exception:** take the upstream body on conflict and **re-apply the small Marid-precedence header +
`develop`/branch-naming note** (kept minimal precisely so this re-apply is cheap). `README.md` follows the
existing P-2 rule (Marid wins).

## The sync loop (automated where boring)

1. Scheduled workflow fetches upstream, creates `sync/upstream-<date>` from `develop`, merges
   `upstream/dev`, pushes, opens a draft PR.
2. CI on the sync PR: full matrix (FR-064) + **contract tests** pinning the committed v1 routes/events
   (ADR-0003) + migration review job (flag new DB migrations for manual review) + dependency diff report.
3. **Delta report** artifact on every sync PR: `git diff upstream/dev...HEAD --stat`, the P-* patch-surface
   list with per-item status, and the v2/sdk-next stability check (RISK-001 standing item).
4. Conflict ownership: conflicts inside upstream files = re-evaluate the P-* item that caused them;
   conflicts in `marid-*` packages = ours, fix forward.
5. Operator reviews (release notes + migration + security notes), merges to `develop`; rollback = revert
   the merge commit (single commit by policy).

### Additive-file reconcile checklist (P-ENTRY drift — no conflict marker fires)

These Marid files DUPLICATE upstream structure additively, so a git merge shows **no conflict** even when they
have gone stale — they must be reconciled by hand on each sync (added PH-1, DEC-012):

- **`packages/opencode/src/marid.ts`** mirrors `src/index.ts`'s top-level command list. On sync, diff
  `src/index.ts`'s `.command(...)` calls against `src/marid.ts`; add any new upstream command (marid keeps its
  authenticated `serve` swap + `token` + `instance` additions).
- **`packages/opencode/script/marid-build.ts`** mirrors `script/build.ts`'s `Bun.build` config (defines, worker
  paths, compile target). On sync, diff the two build scripts' `define`/`entrypoints`/`compile` blocks and port any
  change (marid keeps its `src/marid.ts` entrypoint + `marid` binary name).

## Git Flow (adapted for a solo private downstream fork — CON-007, ASM-004)

| Branch | Role | Protection |
|---|---|---|
| `main` | Released versions only; tags `vX.Y.Z` | Protected: PR-only, required checks green, no force push |
| `develop` | Integration | Protected: PR-only, required checks |
| `feature/<topic>` · `fix/<topic>` | Work branches → develop | — |
| `sync/upstream-<date>` | Upstream merges → develop | CI must pass |
| `release/vX.Y.Z` | Stabilize → main + back-merge | CI + smoke |
| `hotfix/<topic>` | From main → main + develop | CI |

- Reviews (solo adaptation): self-review + green required checks replace second-human review; the
  execution agent's PRs are reviewed by the operator.
- Commits: Conventional Commits (`feat:`/`fix:`/`chore:`/`sync:` for upstream merges); changelog
  generated from them at release.
- Versioning: Marid semver independent of upstream; each release notes the upstream baseline SHA it
  contains.

## Forking gate inputs (gate 11, when you approve repo creation)

Name approved (Marid ✓) · baseline recorded (candidate ✓, re-confirm) · strategy approved (this doc,
gate 9) · local working tree inspected: **untracked planning artifacts** (docs/brief.md, docs/diagrams/,
docs/<this package>, CLAUDE.md, .claude/) imported via a dedicated `feature/planning-package` branch with
provenance notes; secrets/caches/binaries excluded by .gitignore review; nothing committed silently (INV-003).

## CI & test adaptations for GitHub-hosted runners (durability — so syncs don't re-break)

Upstream CI targets its own infra: self-hosted `blacksmith-*` runners, the `dev` branch,
`.github/TEAM_MEMBERS` governance, and org publish/deploy/release/stats/beta pipelines. On the Marid
fork those fail, queue forever, or fire scheduled publish/deploy jobs (a security concern on a public
repo). The downstream delta is deliberately small and enforced so an upstream merge never re-opens the
same CI breakage. Three tiers, most-durable first:

**Enforcement backstop.** `ci.yml` runs on every PR — including every `sync/upstream-<date>` PR — so any
reintroduced failure is caught before merge and never silently shipped. This is the load-bearing guarantee.

**P-CI-1 · Workflows (automated, self-healing).** All upstream workflows are stripped; only Marid-owned
`ci.yml` is kept. The strip is idempotent: `script/strip-upstream-workflows.ts` (allowlist = `ci.yml`,
`marid-pr-title.yml` — a Marid-owned Conventional-Commits PR-title check replacing upstream's `pr-standards`).
The sync loop MUST run it right after merging `upstream/dev` (a step in the sync workflow, WBS-5.3), so
re-introduced upstream workflows are removed automatically. Must be applied to **both `main` and
`develop`**. Add any new Marid-owned workflow to the script's `KEEP` allowlist.

**P-CI-2 · Environmental fixes (no upstream files touched — syncs can't reintroduce these).** Fixed in
`ci.yml`, not in upstream sources, so they are immune to upstream churn:
- ripgrep: GitHub Windows runners lack `rg`; `ci.yml` runs `choco install ripgrep` so opencode's
  `which("rg.exe")` short-circuits the download/extract fallback that fails in CI.
- `bun install` retry: GitHub runners (esp. `windows-latest`) intermittently fail to resolve a valid
  pinned catalog version — e.g. `No version matching "1.0.0-rc.2" found for specifier "drizzle-orm" (but
  package exists)` — even when the identical lockfile installs fine on another matrix runner in the same
  run. All jobs install via the repo-owned composite action `.github/actions/bun-install` (bounded 3×
  retry + backoff) instead of a bare `bun install`, so a transient blip rides out while a genuinely-missing
  package still fails all attempts. The composite action lives under `.github/actions/` (NOT
  `.github/workflows/`), so the strip script never removes it; syncs leave it intact.
- Windows temp path: GitHub's workspace is `D:\a\...`, and `FSUtil.windowsPath` misreads a leading `/a/`
  (produced when a test strips the drive from a `D:\a\...` path) as drive **`A:`** — breaking the
  `external_directory`/read/workdir path-permission tests. `ci.yml` sets `TMP`/`TEMP` = `D:\opencode-tmp`
  (a path on the workspace drive with **no single-letter first component**) and pre-creates it, so
  `os.tmpdir()` avoids both the cross-drive mismatch and the `/a/`→`A:` misread — tests pass unmodified.
  (Do NOT use `runner.temp` here: it is `D:\a\_temp`, under `\a\`, which re-triggers the bug.)
- Windows suite runtime + per-test caps (both tuned in `ci.yml`, no test edits). Measured: the Windows
  unit **step** runs ~18-22min on cold 2-core runners and varies run-to-run (git/process spawn is slow);
  a 20min `timeout-minutes` crossed it intermittently → job-timeout flakes. Set **`timeout-minutes: 35`**
  to absorb the variance (cost-neutral — a cap only bounds; slow runs now finish instead of failing at
  20min and forcing a paid re-run). Separately, several git-heavy tests exceed bun's 5s default per-test
  cap — snapshot worktree/index ops (`packages/core/test/snapshot.test.ts`) AND workspace "sync history"
  (git init + sync polling, measured ~24s) — so a **`--timeout 60000`** global cap clears the whole known
  range (≤~24s observed) with margin even under runner variance. The 20min→35min variance is NOT caused by
  the per-test cap (5s-era runs already took 21-23min), so the cap value is set purely to clear the slow
  tests, not to control runtime; the 35min job cap is the real hang-backstop, so a generous per-test cap
  costs nothing on green runs. This deliberately replaces editing those tests: the cap lives in KEEP-listed
  `ci.yml`, so syncs never revert it. (History: 30s worked but was tightened to 20s once, which killed the
  24s sync test — 60s clears the full measured range.)

**P-CI-3 · Upstream test edits (unavoidable — enumerated for conflict review).** Each carries a `marid:`
comment so a sync conflict is self-explanatory. Two kinds:

*Timing* — GitHub `windows-latest` is ~2-core vs upstream's ~4-core `blacksmith`; several thresholds were
just-too-tight and were widened:
- `packages/opencode/test/cli/run/run-process.test.ts` — #27371 budget 15s → 30s (also failed on ubuntu).
- `packages/opencode/test/effect/runner.test.ts` — "shell rejects when run is active" 250ms → 5s.
- `packages/opencode/test/session/prompt.test.ts` — "loop waits while shell runs" 10s → 30s.
- `packages/opencode/test/control-plane/workspace.test.ts` — "sync history …" test timeout → 60s (git
  init + sync polling is slow on cold Windows CI).
- `packages/opencode/test/tool/shell.test.ts` — "streams metadata updates progressively" `sleep 0.1` → `1`
  (ubuntu race, not a timeout): metadata fires per stdout chunk, so a starved CI reader coalesced both
  echoes into one read → `updates.length === 1`. A 1s gap makes coalescing require ~1s of reader
  starvation. Product streaming code is correct; only the test's timing assumption was too tight.

*Drive-hardcode* — a test hardcoded drive `C:`, which only resolves on a C:-based runner:
- `packages/opencode/test/tool/shell.test.ts` — "drive-relative PowerShell paths" now uses the temp
  dir's actual drive instead of `C:` (drive-agnostic; correct on any drive).

On sync, if upstream touches these lines, re-apply the edit (or adopt upstream's value if it's larger /
already drive-agnostic). If the timing class keeps growing, prefer a **larger CI runner class** (≈4-core)
over accumulating per-test edits — it attacks the root cause (runner speed) and lets them pass unmodified.

**P-CI-4 · Centralized env-scaled timing (magnitude lives in `ci.yml`, read at the wrapper choke
points).** Every timing flake so far shares one root cause: budgets calibrated for fast dev machines /
upstream's warm blacksmith runners, running on slow load-variable GitHub-hosted runners. Each earlier fix
addressed one budget *layer* (job cap 35min; bun global `--timeout 60000`; P-CI-3 per-test widenings) —
but bun applies an explicit per-test timeout **over** the global `--timeout`, and the harness has its own
internal deadlines, so new layers kept surfacing (observed sequence: windows `workspace waitForSync` 25ms
fence; windows `workspace sync state` 1500ms poll ceiling; ubuntu `run-process` killed by the harness's
30s subprocess deadline under the `.concurrent` transpile stampede — every subprocess test spawns
`bun src/index.ts` simultaneously). The total fix: **one knob**, `OPENCODE_TIMING_SCALE`, set per-OS in
KEEP-listed `ci.yml` (Windows `4`, others `2`; local default `1` = unchanged), read at the choke points
every budget flows through:

- `test/lib/effect.ts` — `TIMING_SCALE` + `scaleTestOpts` (the single source); scales all explicit
  per-test budgets via the `testEffect` wrappers (`effect/live/instance` + `.only/.skip`) and the
  `awaitWithTimeout`/`pollWithTimeout` ceilings.
- `test/lib/cli-process.ts` — scales the subprocess kill deadline (`timeoutMs ?? 30_000`), the serve-boot
  readiness deadline (`readyTimeoutMs ?? 15_000`), and the raw `cliIt.concurrent` bun-test budgets.
- `test/control-plane/workspace.test.ts` — `eventuallyEffect` poll ceiling (`1500 × SCALE`) and the
  `waitForSync` fence (`25 × SCALE`); imports the shared constant.
- `test/cli/run/run-process.test.ts` — the two `durationMs` hang-detection bounds scale with the (now
  scaled) kill deadlines they pair with, preserving fail-fast-vs-hang semantics at any scale.
- `test/cli/acp/lifecycle.test.ts` — the stdin-EOF exit-wait (`5s × TIMING_SCALE`): an inline
  `Effect.timeout` bypassed every wrapper above; measured 5.5s on a cold 2-core Windows runner (PR #17).
- `packages/core/test/util/flock.test.ts` — the 16-worker contention test's tolerance budgets
  (`staleMs 1s`, acquire `timeoutMs 15s`, outer cap `20s`, all `× SCALE` via a file-local const): under
  the 2-core spawn stampede the lock HOLDER is CPU-starved past 1s, so a contender legally stale-breaks a
  healthy lock and trips the worker's exclusive-create guard → exit 1 → `toEqual` mismatch (PR #17).
  Production staleness is 60s; only the test's tightened calibration was wrong, not the flock mechanism.

**Knob transport (turbo strict env — found via PR #17):** turbo 2.x runs tasks in **strict env mode**:
only allowlisted vars reach a task's runtime. `opencode#test` passes everything (`passThroughEnv: ["*"]`),
but every other package's test task silently **dropped `OPENCODE_TIMING_SCALE`** — the knob physically
could not protect them (first hit: core's flock test). Fixed by adding `OPENCODE_TIMING_SCALE` to
`globalPassThroughEnv` in `turbo.json` (one line, upstream config file — re-apply on sync conflict;
`passThroughEnv` does not affect task hashes, so caching is unchanged).

**Watch-list (known-thin budgets, deliberately NOT pre-widened):** flock's single-worker boot waits
(`wait(ready, 5_000)`) and crash-recovery `staleMs: 500`; acp helpers' handshake waits. Per the doctrine
below, route each through the scale only when it actually flakes — pre-emptive widening accumulates
upstream-edit surface for hypothetical failures.

All read-sites carry `marid:` comments. On sync, re-apply on conflict; the `ci.yml` env survives
untouched. Any **new** timing flake should be fixed by routing its budget through this scale (or, if it
already flows through a wrapper above, it is covered automatically) — not by another one-off widening.
If the class keeps growing anyway, a larger runner (≈4-core) remains the deeper fix.

**P-CI-5 · Generated SDK v2 type drift vs its own schema (Marid's typecheck catches it; upstream's
doesn't).** Upstream's `ProviderReasoningOption` schema makes the effort `values` nullable
(`packages/opencode/src/provider/provider.ts` — `values: Schema.Array(Schema.NullOr(Schema.String))`), but
the checked-in generated SDK v2 type lags it: `packages/sdk/js/src/v2/gen/types.gen.ts` still declares the
effort `values: Array<string>`. Marid's full-workspace `bun turbo typecheck` (tsgo) compiles the v2/next
files (`provider/provider.ts`, `share/share-next.ts`) and fails — the mismatch cascades (via
`toPublicInfo`) into the `plugin.trigger<"experimental.provider.small_model">` inference too. Upstream's own
typecheck config does **not** compile these v2 files, so the drift ships green from their side and **recurs on
every sync that re-imports `types.gen.ts`**. **Fix (behavior-neutral, type-only):** widen the generated effort
`values: Array<string>` → `Array<string | null>` to match the runtime schema. First applied **WBS-8.1
(2026-07-13)**. CI does not revert it (no job runs the SDK generator or `git diff --exit-code` on generated
files), so the one-line widen holds until a future sync re-imports upstream's stale `types.gen.ts` →
re-apply the widen. **Durable alternative:** run `./script/generate.ts` on a host where `bun dev generate`
can boot the server (regenerates the SDK from the live schema, producing the nullable type directly) — not
used on Windows sync hosts where the native toolchain (`tree-sitter-powershell`) blocks the boot.
