---
artifact: adr
status: Approved (gate 5/9 basis; comparison C-1)
version: v1.0
updated: 2026-07-03
---

# ADR-0001 — Tracking fork with periodic upstream merge and a minimal additive patch surface

**Status:** Approved (2026-07-03) · promotes DEC-003 · derives from C-1 in `../architecture/technology-comparison.md`

**Context.** Marid must reuse OpenCode's runtime while staying synchronizable (NFR-001). Shaheen's
vendored freeze fails the sync goal; rebase rewrites long-lived branches; a patch-stack is built for
edited upstream files, which we mostly avoid.

**Decision.** Private repo preserving full upstream history; `upstream` remote → anomalyco/opencode;
scheduled (weekly–monthly) merge of upstream `dev` via an automated `sync/upstream-<date>` branch that CI
validates before PR into `develop`; security patches fast-pathed out of cadence. All Marid code is
additive (new packages); direct upstream-file edits live in the enumerated patch-surface register (P-*).
Every sync produces an upstream-delta report (`git diff upstream/dev...HEAD --stat` + P-* list).

**Consequences.** Merge conflicts are rare and owned (conflict ownership = the P-* register); history
stays auditable; the fork can always be diffed against its baseline. Cost: merge commits in history;
discipline required to keep the delta additive.

**Rejected.** Rebase (B), patch-stack (C), vendored freeze (D — Shaheen), external adapter layer
(E — kept as documented fallback, RISK-011).
