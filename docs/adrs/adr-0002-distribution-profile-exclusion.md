---
artifact: adr
status: Approved (gate 6)
version: v1.0
updated: 2026-07-03
---

# ADR-0002 — Exclude by distribution profile, delete nothing

**Status:** Approved (2026-07-03) · promotes DEC-001 · derives from C-2

**Context.** §5 requires dropping desktop/IDE/cloud surfaces; §2 warns stripping ≠ deleting; deletion
creates recurring merge conflicts against an active upstream (RISK-005).

**Decision.** The `marid` distribution profile builds, tests, and ships only the keep-list (see
`../architecture/keep-remove-matrix.md`). Excluded packages remain in the repo untouched — not built, not
published, not in the binary. Feature-level trimming uses config defaults (e.g. `lsp: false`), not code
edits. Physical deletion requires a future justified DEC.

**Consequences.** Zero merge-conflict surface from exclusions; rollback = add the package back to the
build filter; repo size stays larger than strictly needed (accepted).

**Rejected.** Physical deletion (B); pervasive runtime feature flags (C).
