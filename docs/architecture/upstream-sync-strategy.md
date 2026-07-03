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
