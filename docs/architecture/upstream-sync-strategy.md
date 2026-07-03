---
artifact: upstream-sync-strategy
status: Approved (gate 9, 2026-07-03)
version: v1.0
updated: 2026-07-03
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
`ci.yml` is kept. The strip is idempotent: `script/strip-upstream-workflows.ts` (allowlist = `ci.yml`).
The sync loop MUST run it right after merging `upstream/dev` (a step in the sync workflow, WBS-5.3), so
re-introduced upstream workflows are removed automatically. Must be applied to **both `main` and
`develop`**. Add any new Marid-owned workflow to the script's `KEEP` allowlist.

**P-CI-2 · Environmental fixes (no upstream files touched — syncs can't reintroduce these).** Fixed in
`ci.yml`, not in upstream sources, so they are immune to upstream churn:
- ripgrep: GitHub Windows runners lack `rg`; `ci.yml` runs `choco install ripgrep` so opencode's
  `which("rg.exe")` short-circuits the download/extract fallback that fails in CI.
- Windows temp path: GitHub's workspace is `D:\a\...`, and `FSUtil.windowsPath` misreads a leading `/a/`
  (produced when a test strips the drive from a `D:\a\...` path) as drive **`A:`** — breaking the
  `external_directory`/read/workdir path-permission tests. `ci.yml` sets `TMP`/`TEMP` = `D:\opencode-tmp`
  (a path on the workspace drive with **no single-letter first component**) and pre-creates it, so
  `os.tmpdir()` avoids both the cross-drive mismatch and the `/a/`→`A:` misread — tests pass unmodified.
  (Do NOT use `runner.temp` here: it is `D:\a\_temp`, under `\a\`, which re-triggers the bug.)

**P-CI-3 · Upstream test edits (unavoidable — enumerated for conflict review).** Each carries a `marid:`
comment so a sync conflict is self-explanatory. Two kinds:

*Timing* — GitHub `windows-latest` is ~2-core vs upstream's ~4-core `blacksmith`; several thresholds were
just-too-tight and were widened:
- `packages/opencode/test/cli/run/run-process.test.ts` — #27371 budget 15s → 30s (also failed on ubuntu).
- `packages/opencode/test/effect/runner.test.ts` — "shell rejects when run is active" 250ms → 5s.
- `packages/opencode/test/session/prompt.test.ts` — "loop waits while shell runs" 10s → 30s.
- `packages/opencode/test/control-plane/workspace.test.ts` — "sync history …" test timeout → 60s (git
  init + sync polling is slow on cold Windows CI).

*Drive-hardcode* — a test hardcoded drive `C:`, which only resolves on a C:-based runner:
- `packages/opencode/test/tool/shell.test.ts` — "drive-relative PowerShell paths" now uses the temp
  dir's actual drive instead of `C:` (drive-agnostic; correct on any drive).

On sync, if upstream touches these lines, re-apply the edit (or adopt upstream's value if it's larger /
already drive-agnostic). If the timing class keeps growing, prefer a **larger CI runner class** (≈4-core)
over accumulating per-test edits — it attacks the root cause (runner speed) and lets them pass unmodified.
