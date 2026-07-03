---
artifact: gate-11-forking-checklist
status: Proposed (gate 11) — awaiting operator approval
version: v1.0
updated: 2026-07-03
---

# Forking-Gate Checklist (Gate 11)

Prepared by the execution agent for operator (STK-001, Eng. Anas Hammo) approval. **This document
proposes; it executes nothing.** Per INV-003 the working tree is untouched, no repository is created, no
commit is made, no ref is pushed. Per INV-005 the decisions flagged below are the operator's alone.

**This checklist is also the execution contract.** The PH-0 follow-up prompt directs a future session to
run "WBS-0.1..0.3 exactly as approved in `docs/handoff/gate-11-forking-checklist.md` (INV-003: only the
approved actions)." The commands in §3 are therefore exact, ordered, and copy-pasteable — not
illustrative. Nothing here runs until the operator approves this gate.

---

## Operator decisions required at this gate

| # | Decision | Recommendation | Where |
|---|---|---|---|
| D-1 | Baseline SHA to tag the fork against | **`eb3476660`** (current local `dev` HEAD) | §1 |
| D-2 | Approve the repo-creation + baseline-tag command sequence (run post-approval, WBS-0.1) | Approve as written | §3 |

Everything else (working-tree classification, secrets, import routing) is proposed with a default and
needs only a yes/adjust.

---

## 1 · Upstream baseline SHA + tag name

Basis: `docs/architecture/upstream-sync-strategy.md` (Approved, gate 9) — tag scheme
`upstream-baseline/<date>-<sha>`; candidate `eb3476660` "re-confirmed at the forking gate per ASM-001".

**Re-confirmation result (as of `git fetch origin`, 2026-07-03):**

| Ref | SHA | Note |
|---|---|---|
| Local `dev` HEAD (working-tree checkout) | `eb3476660` | The plan's candidate baseline; `keystone-state.json` FACT-001 records the **entire planning package was analyzed against this SHA** |
| `origin/dev` (anomalyco/opencode tip) | `a4fed69a8` | **11 commits ahead** of local HEAD; local is 0 ahead / 11 behind, **fast-forwardable** (no divergence) |

The upstream branch has advanced 11 commits since the package was authored. This is exactly the
re-confirmation ASM-001 anticipated — not a plan contradiction, but an operator choice (INV-005).

**Recommendation → baseline at `eb3476660` (D-1).** Rationale: it is the literal current `dev` HEAD, the
plan's stated candidate, and — decisively — every current-state analysis (`docs/architecture/current-state/*.md`
file:line citations, the 19 diagrams, the keep/remove matrix) was produced against `eb3476660`.
Baselining there keeps the fork's recorded baseline consistent with the analysis the whole package rests
on. The 11 upstream commits are not lost: they become the input to the **first real upstream sync cycle**
(WBS-5.3 / KPI-004), which the plan already requires exercising once — so they land through the audited
sync path, with a delta report, rather than silently at fork time.

Alternative (operator may choose): fast-forward `dev` to `a4fed69a8` first, then baseline there. Cost:
the current-state citations become 11 commits stale relative to the baseline; benefit: the first sync
cycle starts from a smaller delta. Not recommended.

**Proposed tag (for the recommended SHA):**

```
upstream-baseline/2026-07-03-eb3476660
```

If the operator selects `a4fed69a8` instead, the tag becomes `upstream-baseline/2026-07-03-a4fed69a8`
and §3 step (c) uses that SHA. The `a4fed69a8` delta above is current as of today's fetch; §3 re-confirms
it at execution time before tagging.

---

## 2 · Local working-tree inventory + classification (INV-003: propose only)

Full untracked/ignored state captured with `git status --porcelain --untracked-files=all` and
`git status --ignored`. Nothing modified — there are **zero tracked-file modifications**; the working tree
is upstream `eb3476660` plus additive untracked artifacts only.

| Path | Files | Classification | Import verdict | Route |
|---|---|---|---|---|
| `docs/**` | 109 (`.md`, `.json` specs/manifests, 19×`.png`+19×`.svg` diagrams) | **Planning artifact** — the Keystone package | **Import** | `feature/planning-package` → gate 12 (WBS-0.2) |
| `CLAUDE.md` | 1 | **Config / project guidance** for coding agents; explicitly listed for import by the sync strategy | **Import** | same PR |
| `.claude/evals/` | 3 (`README.md`, `opencode-core.md`, `baseline.json`) | **Pre-existing eval harness** (dated 2026-05-06, predates this package; opencode-branded) | **Import** per sync-strategy §"Forking gate inputs" (lists `.claude/`), **flagged stale** — see note | same PR, separate commit |
| `.claude/settings.local.json` | 1 | **Transient / machine-local** — Claude Code permission config | **Exclude** (already git-ignored) | — |

**`.claude/evals/` staleness flag (added value, not a blocker):** `baseline.json` snapshots
`project: opencode`, `version: 1.14.39`, `sha: 38b0cdc14` — an older, upstream-branded baseline. The
approved sync strategy already directs importing `.claude/`, so it comes in with the package; recommend a
`chore:` follow-up in **PH-0** to re-baseline it for Marid (name, current SHA, capability set) so the EDD
harness (`docs/validation/test-strategy.md`) reflects the fork, not upstream.

**`.claude/settings.local.json` exclusion basis:** ignored by the operator's global
`~/.config/git/ignore` (`**/.claude/settings.local.json`). It is local permission state, not a planning
artifact, and never enters version control. No action.

**Secret hygiene (INV-002):** scanned all import candidates (`docs/**`, `CLAUDE.md`, `.claude/evals/`) for
OpenAI/GitHub/AWS keys, PEM private keys, Slack/xox tokens, and Telegram bot-token patterns —
**zero matches, clean.** `.gitignore` review: existing rules already exclude `.env` / `.env.local`,
`node_modules`, `dist`/`ts-dist`, `tmp`, `logs/`, build outputs, and `.claude/settings.local.json`
(global). No secret, cache, or binary artifact is among the import candidates.

---

## 3 · Proposed private-repo creation commands (execute only after gate-11 approval — WBS-0.1)

**Guardrails:** repo name `marid`, **private**, **no push of anything yet** (no branches, no tags). The
`gh repo create` form below deliberately omits `--source`/`--push` so the remote starts **empty**. Remote
rename precedes adding the new `origin` so ordering is unambiguous. Run in repo root.

```bash
# Pre-flight: re-confirm the baseline SHA is still current dev HEAD (INV-003 re-confirmation).
git fetch origin
git rev-parse --short HEAD          # expect: eb3476660  (the approved D-1 SHA)

# (a) Create the EMPTY private repo — no push (repo starts with no branches/tags).
gh repo create marid --private \
  --description "Marid — private downstream distribution of OpenCode"
#   NOTE: no --source / --push. Created under the authenticated gh account; add `<org>/marid` to place it in an org.

# (b) Rewire remotes per upstream-sync-strategy.md:
#     current origin (anomalyco/opencode) becomes fetch-only `upstream`; the new marid repo becomes `origin`.
git remote rename origin upstream
git remote set-url --push upstream no-push                 # push disabled per the `no-push` convention
git remote add origin https://github.com/<gh-account>/marid.git

# (c) Tag the baseline at the operator-approved SHA (D-1 default eb3476660) — LOCAL tag, not pushed here.
git tag upstream-baseline/2026-07-03-eb3476660 eb3476660

# PUSH BOUNDARY — nothing above pushes anything.
# The push of dev/main + the baseline tag, branch protection, and CI skeleton are the remainder of
# WBS-0.1/0.3; the planning-package import (§2) is a SEPARATE PR under gate 12 / WBS-0.2. Neither happens
# until this gate is approved, and the gate-12 import is its own approval.
```

Branch-model note (out of gate-11 scope, flagged for WBS-0.3): the sync strategy's Git Flow uses
`main` + `develop`, while the upstream clone's default branch is `dev`. Establishing `main`/`develop` and
their protection rules is WBS-0.3, not this gate. Gate 11 only creates the repo, wires remotes, and stages
the baseline tag.

---

## PASS criteria (self-check)

- [x] Checklist exists at `docs/handoff/gate-11-forking-checklist.md` and is complete (all 3 required parts).
- [x] Baseline SHA re-confirmed against a fresh fetch; tag name proposed per the approved scheme.
- [x] Every untracked/ignored path listed, classified, and given an import/exclude verdict with a route.
- [x] Repo-creation commands proposed with explicit push-deferral boundary.
- [x] **Zero irreversible actions taken.** No repo created, no commit, no push, no working-tree change,
      no ref written. `docs/keystone-state.json` intentionally **not** updated — this phase is awaiting
      approval, not complete.

**STOP — awaiting operator gate-11 approval.** On approval, the PH-0 follow-up prompt
(`docs/handoff/follow-up-prompts.md`) drives WBS-0.1..0.3 executing **only** the actions approved here.
