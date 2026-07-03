---
artifact: technology-comparison
status: Proposed (feeds gates 5–9)
version: v0.1
updated: 2026-07-03
---

# Option Comparisons (Stage 11)

Criteria are stated **before** scoring. Scores: 3 strong · 2 partial · 1 weak · 0 unsuitable · ? unknown.
Weights reflect the approved charter: reuse-first (DEC-009), small patch surface (NFR-001), simplicity
(NFR-002), single operator, private network, solo maintainer (ASM-004). Evidence: current-state docs
(`current-state/0X-*.md`), research findings (`../research/findings/`). Losers are kept — they are
evidence, not clutter.

## C-1 · Upstream synchronization model (→ DEC-003, gate 9)

Weights: sync effort for a solo maintainer ×3 · conflict surface ×3 · security-patch speed ×2 ·
history/provenance clarity ×2 · tooling simplicity ×2.

| Option | Effort | Conflict | Sec-patch | History | Tooling | Weighted | Notes |
|---|---|---|---|---|---|---|---|
| **A. Tracking fork + periodic upstream MERGE + minimal patch surface** | 3 | 3 | 3 | 3 | 3 | **36** | Downstream delta lives in NEW packages (see C-2/C-4), so merges rarely conflict; git-native; delta report = `git diff upstream/dev...HEAD --stat` |
| B. Periodic REBASE onto upstream | 2 | 2 | 3 | 1 | 2 | 24 | Clean linear history but rewrites published branches; painful with Git Flow's long-lived branches |
| C. Patch-stack (quilt/stgit-style curated patches) | 1 | 3 | 2 | 3 | 1 | 24 | Best when you must enumerate every diff; overkill when the delta is additive packages (R-10: VSCodium uses this because it *edits* upstream files — we mostly don't) |
| D. Vendored hard fork (freeze, no sync) — Shaheen's model | 3 | 3 | 0 | 1 | 3 | 26* | *Fails the charter directly (G-7, NFR-001); Rejected on requirements, not score |
| E. Adapter layer fully outside the fork (wrap released binaries) | 2 | 3 | 2 | 2 | 2 | 26 | Viable fallback if the fork ever becomes too costly; blocks TUI/branding changes and distribution-profile builds |

**Front-runner: A**, with C-2's exclusion strategy keeping the patch surface enumerable, weekly-to-monthly
cadence + CI conflict-detector branch + security fast-path (R-10 citations).

## C-2 · Component reduction strategy (→ DEC-001, gate 6)

Weights: merge-conflict avoidance ×3 · build/distribution cleanliness ×2 · reversibility ×2 · effort ×2.

| Option | Merge | Clean | Reversible | Effort | Weighted | Notes |
|---|---|---|---|---|---|---|
| **A. Distribution profile: keep all files; exclude packages from build/release; config-off features (e.g. `lsp:false`)** | 3 | 2 | 3 | 3 | **25** | Exclusion candidates have zero dangling edges (R-01); turbo/workspace scoping + own publish workflow make exclusion natural |
| B. Delete excluded packages from the repo | 0 | 3 | 1 | 2 | 12 | Every upstream change to a deleted path = recurring conflict; contradicts §2's warning |
| C. Feature-flag everything at runtime | 2 | 1 | 3 | 1 | 16 | Invasive in-file edits = patch surface where we least want it |

**Front-runner: A.** Deletion is reserved for justified cases recorded per-package in the keep/remove matrix.

## C-3 · Remote streaming protocol (→ DEC-002, gate 7)

Weights: reuse of existing code ×3 · fit to FR-024/036 ×3 · client simplicity ×2.

| Option | Reuse | Fit | Simplicity | Weighted | Notes |
|---|---|---|---|---|---|
| **A. SSE (existing: global `/event` + v2 per-session `?after=<seq>` replay)** | 3 | 3 | 3 | **24** | Already implemented and consumed by app + slack prototype (R-02, R-06); brief prefers SSE |
| B. WebSocket | 0 | 3 | 2 | 13 | Nothing to reuse; bidirectionality not needed — commands go over plain HTTP POST |
| C. Polling only | 2 | 1 | 3 | 15 | Fallback pattern for constrained clients; not primary |

**Front-runner: A.** WebSocket is added only if a concrete FR-036 gap survives EXP-001 (per §6's own rule).

## C-4 · API generation to build on (→ DEC-004, gate 7)

Weights: stability ×3 · SDK availability ×2 · future-proofing ×2 · patch surface ×2.

| Option | Stable | SDK | Future | Patch | Weighted | Notes |
|---|---|---|---|---|---|---|
| **A. v1 API + published `@opencode-ai/sdk`, behind a thin Marid gateway layer (auth/rate/audit added there)** | 3 | 3 | 2 | 3 | **25** | v1 is what app/slack/SDK use today (R-02); Marid-specific concerns live in a NEW package = zero core diff |
| B. v2 `/api/*` + sdk-next now | 1 | 1 | 3 | 3 | 17 | Every v2 group is annotated Experimental; migration churn lands on us |
| C. Design a brand-new Marid public API | 1 | 0 | 3 | 1 | 11 | Violates DEC-009 (reuse-first) and INV-007 |

**Front-runner: A**, with an explicit re-evaluation trigger: when upstream marks v2/sdk-next stable,
raise a decision to migrate (recorded as a standing item in the sync checklist).

## C-5 · Cross-interface sync & concurrency model (→ DEC-005, gate 7)

Weights: correctness ×3 · reuse ×3 · MVP simplicity ×2.

| Option | Correct | Reuse | Simple | Weighted | Notes |
|---|---|---|---|---|---|
| **A. One server process per instance; ALL clients (TUI, API, web, gateway) attach over HTTP+SSE; reuse the v2 single-writer/queue/steering design (verify via EXP-001)** | 3 | 3 | 3 | **24** | Live events already reach all clients of one server (R-03); removes the two-process shared-DB blind spot by construction |
| B. Multi-process shared SQLite + event propagation layer | 2 | 1 | 1 | 11 | Builds a distributed problem the charter excludes (§7) |
| C. Pessimistic global session lock | 3 | 2 | 2 | 19 | Simpler but kills the §7 simultaneous-prompt/steering requirements; fallback if EXP-001 fails |

**Front-runner: A.** The authoritative store stays upstream's SQLite (one DB per instance).

## C-6 · MVP distribution method (→ DEC-006, gate 10)

Weights: reuse of upstream release machinery ×3 · single-operator install/update ergonomics ×3 ·
private-distribution fit ×2 · 3-OS coverage ×2.

| Option | Reuse | Ergonomics | Private | 3-OS | Weighted | Notes |
|---|---|---|---|---|---|---|
| **A. Bun-compiled standalone binaries → private GitHub Releases (adapted publish.yml; checksums; install via gh-authenticated script)** | 3 | 3 | 3 | 3 | **30** | Upstream already builds 12 binary targets (R-05); strip public npm/AUR/brew publishing |
| B. Docker/Compose first | 2 | 2 | 3 | 1 | 20 | Poor fit for TUI-first use on Windows; strong later addition for server-style deployment |
| C. Private npm registry | 2 | 2 | 2 | 3 | 22 | Adds registry infrastructure the MVP doesn't need |

**Front-runner: A**; expansion path: Docker image (upstream ghcr job exists) in a later phase.

## C-7 · Channel gateway placement (→ FR-045 contract, gate 5)

Weights: core patch surface ×3 · security containment ×3 · reuse of proven pattern ×2.

| Option | Patch | Contain | Proven | Weighted | Notes |
|---|---|---|---|---|---|
| **A. Separate gateway process speaking only the public HTTP+SSE API (long-polling Telegram ingress)** | 3 | 3 | 3 | **24** | Proven twice (slack prototype, Shaheen WhatsApp gateway); crash/compromise of gateway ≠ crash of core; policy enforced at the API boundary |
| B. In-core channel plugin | 1 | 1 | 2 | 10 | In-process plugins have zero isolation (R-04) — wrong place for untrusted ingress |

**Front-runner: A.**
