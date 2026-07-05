---
artifact: traceability-matrix
status: Derived (regenerated, never hand-edited)
version: v0.1
updated: 2026-07-03
---

# Traceability Matrix (requirement → decision → work → test → risk)

Derived from the approved registers; regenerate on any change. AC column only where user-visible
behavior is asserted. Test families are defined in `validation/test-strategy.md`.

## Functional requirements

| FR | Decision(s) | Work | Test | AC | Risk |
|---|---|---|---|---|---|
| FR-001..007, 009..011, 015..017 (runtime core preserved) | Gate-4 reuse-as-is; DEC-009 | (upstream; no work) | TEST-UP | — | RISK-001 |
| FR-008 plugins | Gate-8 trust policy | WBS-1.5 defaults | TEST-UP, TEST-SEC | — | RISK-004 |
| FR-012 caching | ADR-0006 (namespacing) | WBS-2.1 | TEST-INST | — | RISK-002 |
| FR-013 MCP | Gate-4 reuse; gate-8 pinning | WBS-1.5 defaults | TEST-UP | — | RISK-004 |
| FR-014 LSP optional | Keep-matrix: `lsp:false` default | WBS-1.5 | TEST-BUILD | AC-013 | — |
| FR-018 config/secrets | Keep-matrix: extend | WBS-1.5, WBS-2.1 | TEST-AUTH, TEST-SEC | AC-016 | RISK-007 |
| FR-019 SDK | ADR-0003 | WBS-1.4 | TEST-CONTRACT | — | RISK-001 |
| FR-020 observability hooks | Keep-matrix: extend | WBS-1.3 | TEST-AUTH | — | — |
| FR-021 controlled access | Gate-8 B4 | (upstream) + WBS-4.4 | TEST-SEC | AC-012 | RISK-003 |
| FR-022 session create/discover | ADR-0003 | WBS-1.4 | TEST-CONTRACT | AC-006 | RISK-001 |
| FR-023 sync+async prompt | ADR-0003 | WBS-1.4 | TEST-CONTRACT | AC-006 | RISK-001 |
| FR-024 event streaming | ADR-0003, DEC-002 | WBS-1.4 | TEST-CONTRACT, TEST-SYNC | AC-006 | RISK-006 |
| FR-025 SSE primary | DEC-002/ADR-0003 | WBS-1.4 | TEST-CONTRACT | — | — |
| FR-026 history | ADR-0003 | WBS-1.4 | TEST-CONTRACT | AC-008 | — |
| FR-027 cancel/resume | ADR-0003 | WBS-1.4 | TEST-CONTRACT | AC-008 | — |
| FR-028 permissions over API | ADR-0003 | WBS-1.4, WBS-4.3 | TEST-CONTRACT, TEST-TG | AC-012 | RISK-003 |
| FR-029 tool/subagent events | ADR-0003 (subagent events: confirm in EXP-001) | WBS-0.4, WBS-1.4 | TEST-CONTRACT | — | — |
| FR-030 errors/correlation/idempotency | Gate-7 envelope | WBS-1.3 | TEST-AUTH | — | — |
| FR-031 authn/z | Gate-7 envelope | WBS-1.2 | TEST-AUTH | AC-003/004 | — |
| FR-032 rate limiting | Gate-7 envelope | WBS-1.3 | TEST-AUTH | AC-005 | — |
| FR-033 audit log | Gate-7 envelope | WBS-1.3 | TEST-AUTH | AC-003 | — |
| FR-034 health/version | Gate-7 (extend if absent) | WBS-1.2 | TEST-CONTRACT | AC-001 | — |
| FR-035 versioning | Gate-7 policy | WBS-1.4 | TEST-CONTRACT | AC-015 | RISK-001 |
| FR-036 reconnect/ordering/dedup | Gate-7 event contract | WBS-3.2 | TEST-SYNC | AC-007 | RISK-006 |
| FR-037 durable global replay | Deferred (Full) | — | — | — | — |
| FR-038 cross-interface consistency | ADR-0004 | WBS-3.1 | TEST-SYNC | AC-006 | — |
| FR-039 authoritative store/identity | ADR-0004; OQ-003 answer | WBS-3.1 | TEST-SYNC | AC-006 | — |
| FR-040 concurrency/queueing | ADR-0004 + EXP-001 | WBS-0.4, WBS-3.3 | TEST-SYNC | AC-009 | RISK-010 |
| FR-041 ownership/locking/conflict | ADR-0004 + EXP-001 | WBS-3.3 | TEST-SYNC | AC-009 | RISK-010 |
| FR-042 TUI live updates | ADR-0004 | WBS-3.1 | TEST-SYNC | AC-006 | — |
| FR-043 restart recovery | ADR-0004; R-03 gap | WBS-3.2 | TEST-SYNC | AC-008 | — |
| FR-044 retention/export | Deferred (Full) | — | — | — | — |
| FR-045 channel contract | ADR-0005 | WBS-4.1..4.5 | TEST-TG | — | — |
| FR-046 Telegram adapter | ADR-0005; R-09 | WBS-4.1/4.2 | TEST-TG | AC-011 | — |
| FR-047 WhatsApp | Deferred (Full; contract-compatible) | — | — | — | — |
| FR-048 streaming simulation | R-09 cadence; EXP-003 | WBS-4.2 | TEST-TG | AC-011 | — |
| FR-049 media/replies/commands | R-09 caps | WBS-4.5 | TEST-TG | — | — |
| FR-050 identity linking/allowlist | Gate-8 B1 | WBS-4.1 | TEST-TG | AC-010 | RISK-003 |
| FR-051 webhook/replay protection | R-09: long polling + update_id dedup | WBS-4.1 | TEST-TG | AC-010 | — |
| FR-052 capability policy | Gate-8 B2; INV-001 | WBS-4.4 | TEST-TG, TEST-SEC | AC-012 | RISK-003 |
| FR-053 multi-instance | ADR-0006 + EXP-002 | WBS-2.1..2.3 | TEST-INST | AC-001/002 | RISK-002 |
| FR-054 config layering | Keep-matrix extend | WBS-2.1 (env composition) | TEST-INST | AC-001 | — |
| FR-055 secret handling/redaction | Gate-8 B7 | WBS-1.3 | TEST-SEC | AC-016 | RISK-007 |
| FR-056 OTLP signals | Keep-matrix; R-10 pin | WBS-1.3 (attrs) | TEST-AUTH | — | — |
| FR-057 correlation chain | Gate-7 request-ID | WBS-1.3 | TEST-AUTH | — | — |
| FR-058 metrics catalog | Deferred (Full) | — | — | — | — |
| FR-059 audit vs ops separation | Gate-7/8 | WBS-1.3 | TEST-AUTH | AC-016 | — |
| FR-060 distribution | C-6/gate-10 | WBS-1.1, WBS-5.1/5.2 | TEST-BUILD | AC-013/014 | RISK-009 |
| FR-061 upstream sync | ADR-0001/gate-9 | WBS-5.3 | TEST-SYNCUP | AC-015 | RISK-005 |
| FR-062 Git Flow | Gate-9 | WBS-0.3 | (process; CI enforced) | — | — |
| FR-063 test strategy | Gate-13 package | validation/test-strategy.md | all families | — | — |
| FR-064 CI/CD | Gate-9/10 | WBS-0.3, WBS-5.1 | TEST-BUILD | AC-014 | RISK-004 |
| FR-065 naming/branding | DEC-008/gate-3 | WBS-1.5, WBS-5.4 | TEST-BUILD (hygiene) | AC-013 | — |

## Non-functional requirements

| NFR | Realized by | Verified by |
|---|---|---|
| NFR-001 patch surface | ADR-0001/0002; P-* register | Delta report on every sync PR; KPI-004 |
| NFR-002 simplicity | DEC-009; architecture principles | Gate-5 review (done); phase reviews |
| NFR-003 independent product ops | Gates 7–10 artifacts | KPI-006; readiness report |
| NFR-004 cross-platform | CON-011 | 3-OS CI matrix (TEST-BUILD) |
| NFR-005 security | Gate-8 threat model | TEST-SEC; scanning jobs |
| NFR-006 streaming latency (⊕) | ADR-0003/0004 | TEST-SYNC timing assertions (tune at PH-3) |
| NFR-007 sync convergence (⊕) | ADR-0004 | TEST-SYNC (AC-006/007) |
| NFR-008 isolation | ADR-0006 | TEST-INST (AC-002, KPI-003) |
| NFR-009 OTel standards | R-10 pinning | TEST-AUTH attr checks |
| NFR-010 docs quality | Branding/README plan | Docs-validation CI job |
| NFR-011 test rigor | Test strategy | Coverage report vs measured baseline |
| NFR-012 plain English | All artifacts | Gate reviews (ongoing) |

**Gaps:** none for MVP-priority FRs (KPI-005 precondition). Deferred items (FR-037/044/047/058) are
intentionally unlinked and live in the registers with triggers.
