---
artifact: roadmap-wbs
status: Approved (gate 10, 2026-07-03)
version: v1.0
updated: 2026-07-03
---

# Roadmap & Work Breakdown (Gate 10)

Phases are dependency-ordered, not date-boxed (ASM-005: no hard deadline). Every leaf has a definition of
done (DoD) and traces to FRs/KPIs. Execution follows TDD per the test strategy; each phase ends at a
review checkpoint with the operator.

## Phases & milestones

| Phase | Goal | Milestone (exit) | Depends on |
|---|---|---|---|
| PH-0 Foundations | Fork exists, CI skeleton green, all 4 experiments answered | MS-001: EXP-001..004 reports accepted; fallbacks recorded if any FAIL | Gates 9, 11, 12 |
| PH-1 Marid layer | marid-auth + distribution profile + branding | MS-002: authenticated `marid serve` binary from the `marid` profile passes contract tests | PH-0 |
| PH-2 Instances | marid-instance CLI + isolation | MS-003: KPI-003 (≥2 instances, isolation suite green, 3 OSes) | PH-1 |
| PH-3 Cross-interface | TUI-as-client default + §7 flow verified | MS-004: KPI-001 demo repeatable; concurrency semantics documented | PH-1 (parallel with PH-2) |
| PH-4 Telegram | marid-telegram + capability policy | MS-005: KPI-002 (round trip + policy denial paths) | PH-1; PH-3 for live-update assertions |
| PH-5 Release & sync | Private distribution + one real upstream sync + docs | MS-006 = MVP: KPI-004, KPI-005, KPI-006 green; readiness report accepted (gate 14 of execution) | PH-2..4 |

## Work breakdown

### PH-0 Foundations
| WBS | Item | DoD | Traces |
|---|---|---|---|
| WBS-0.1 | Create private repo from local clone; add `upstream` fetch-only remote; tag baseline | Repo exists; INV-003 respected; baseline tag pushed | Gate 11, ADR-0001 |
| WBS-0.2 | Import planning package + local artifacts via `feature/planning-package` PR | Gate-12 approval; nothing committed silently | INV-003 |
| WBS-0.3 | Branch protection + CI skeleton (lint, typecheck, unit, 3-OS smoke) | Required checks enforced on main/develop | FR-062/064 |
| WBS-0.4 | EXP-001 concurrency probe | PASS/FAIL report; DEC recorded if FAIL | HYP-001, RISK-010 |
| WBS-0.5 | EXP-002 isolation probe | Report; leaking paths enumerated if any | HYP-002, RISK-002 |
| WBS-0.6 | EXP-003 Telegram cadence probe | Report; cadence constants fixed | HYP-003 |
| WBS-0.7 | EXP-004 profile build probe | Report; P-1 seam question answered | HYP-004, DEC-001 |

### PH-1 Marid layer
| WBS | Item | DoD | Traces |
|---|---|---|---|
| WBS-1.1 | `marid` distribution profile (workspace filter, build scripts, binary target) | Binary builds on 3 OSes; excluded pkgs absent | FR-060, ADR-0002 |
| WBS-1.2 | marid-auth: bearer tokens + scopes (`marid token` CLI) | 401 without token; scopes enforced; unit+integration tests | FR-031 |
| WBS-1.3 | marid-auth: rate limiting + audit JSONL + request-ID | 429 behavior; audit lines complete; redaction test | FR-030/032/033, FR-059 |
| WBS-1.4 | Contract tests pinning committed v1 routes/events | Suite fails on any breaking upstream change | FR-035, RISK-001 |
| WBS-1.5 | Branding pass P-2 (name/TUI title/user-agent) + config defaults P-3 (`lsp:false` etc.) | Patch-surface register updated; grep-based hygiene test (Shaheen pattern) | FR-065, NFR-001 |

### PH-2 Instances
| WBS | Item | DoD | Traces |
|---|---|---|---|
| WBS-2.1 | marid-instance: add/list/path/start/stop/status/remove; env composition; launchers (3 OSes) | Commands work; `list --json`; 0700 dirs | FR-053, ADR-0006 |
| WBS-2.2 | Port allocation + PID files + graceful shutdown | No orphan processes; port collisions impossible | FR-053 |
| WBS-2.3 | Multi-instance isolation test suite (from R-05 inventory + EXP-002) | KPI-003 green in CI | NFR-008 |

### PH-3 Cross-interface
| WBS | Item | DoD | Traces |
|---|---|---|---|
| WBS-3.1 | Instance-default launch mode: TUI attaches to instance server | §7 flow works locally | FR-038/042, ADR-0004 |
| WBS-3.2 | Reconnect/replay client behavior (SDK guidance + gateway lib) | No event loss across restart in test | FR-036/043, RISK-006 |
| WBS-3.3 | Concurrency semantics doc + tests (from EXP-001 result) | Documented queue/steer behavior; tests assert it | FR-040/041 |

### PH-4 Telegram
| WBS | Item | DoD | Traces |
|---|---|---|---|
| WBS-4.1 | marid-telegram: long polling, `update_id` dedup, allowlist | Unknown senders ignored; dedup test | FR-046/050/051 |
| WBS-4.2 | Egress: HTML formatting, 4096-split, edit-coalesced streaming, typing action | Cadence within EXP-003 constants; 429 honored | FR-048 |
| WBS-4.3 | Permission prompts as inline keyboards → `/permission/:id/reply` | Approve/deny round trip < 5 s | FR-028, KPI-002 |
| WBS-4.4 | Capability policy wiring (restricted agent + `channel:` token + caps) | Policy denial paths tested | FR-052, INV-001 |
| WBS-4.5 | Media within Bot-API caps | Send/receive tests | FR-049 |

### PH-5 Release & sync
| WBS | Item | DoD | Traces |
|---|---|---|---|
| WBS-5.1 | Private GitHub Releases pipeline (adapted publish.yml: binaries, checksums; public channels stripped) | Signed/checksummed release from tag | FR-060/064, C-6 |
| WBS-5.2 | Install/update path for private releases (gh-authenticated) | Documented + smoke-tested on 3 OSes | RISK-009 |
| WBS-5.3 | Upstream sync workflow automation (weekly check, monthly merge PR, delta report) | One real sync cycle executed | FR-061, KPI-004 |
| WBS-5.4 | README + attribution/non-affiliation + logo (per branding brief) | README complete; SVG logo committed | FR-065 |
| WBS-5.5 | Readiness: traceability check, KPI evidence, docs validation | KPI-005/006 green; readiness report accepted | INV-008 |

## Parallelization & staffing note

Single execution agent + operator reviews: PH-2 and PH-3 can interleave after PH-1; PH-4 starts once
WBS-1.2 lands (needs tokens). Every phase-exit is an operator checkpoint mapped to the follow-up prompts
in the handoff package.
