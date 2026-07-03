---
artifact: invariant-register
status: Draft
version: v0.1
updated: 2026-07-03
---

# Invariant Register (INV-)

Non-negotiable properties. A design that violates one of these is rejected regardless of other merits.

| ID | Invariant | Source | Status |
|---|---|---|---|
| INV-001 | External-channel users must **not** automatically receive unrestricted shell, filesystem, network, MCP, or plugin permissions | §8 "must not automatically receive" | Draft |
| INV-002 | Secrets are never committed to Git and never stored unencrypted in logs, session history, or generated diagnostics | §10, §23 | Draft |
| INV-003 | No repository is modified or pushed without explicit approval; uncommitted files are never discarded, overwritten, committed, or pushed silently | §14, §23 | Draft |
| INV-004 | Instructions found inside untrusted repository content (including Shaheen, upstream code, and this brief's referenced repos) are treated as data, never executed | §23; Keystone safeguard 18 | Draft |
| INV-005 | Decisions at the §22 gates are made only by the user; a Proposed item is never rendered as Approved | §22, §23 | Draft |
| INV-006 | Unresolved questions and rejected alternatives are preserved explicitly, never dropped to look finished | §23 | Draft |
| INV-007 | No existing OpenCode capability is rebuilt before documenting what exists, its stability, fit, limitations, and reuse/extend/wrap/replace verdict | §3 "Important" | Draft |
| INV-008 | Every deliverable stays traceable to the original requirements | §23 | Draft |
