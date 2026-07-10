---
status: Approved
version: 1.0.0
updated: 2026-07-09
owner: operator (STK-001)
generation: derived
---

# Traceability Matrix (Req → Decision → Work → Test → Risk → Acceptance)

**Derived — regenerated from the registers, not hand-maintained.** Each MVP requirement links to ≥1
decision, ≥1 work item, and ≥1 test (gate G-TRACE); behaviour-bearing ones also link an `AC-`. `Scope`
`Full` rows are post-MVP and intentionally deferred (coverage `gap`). Requirement text lives in
[functional](../requirements/functional.md) / [non-functional](../requirements/non-functional.md); work
items in [work-breakdown](../planning/work-breakdown.md); tests (TEST- families) in
[test-strategy](test-strategy.md); acceptance in [acceptance-criteria](acceptance-criteria.md).

## Requirements

| Req | Scope | Decisions | Work items | Tests | Risks | Acceptance | Coverage |
|---|---|---|---|---|---|---|---|
| FR-001 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-002 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-003 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-004 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-005 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-006 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-007 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-008 | MVP | Gate-8 trust policy | WBS-1.5 defaults | TEST-UP, TEST-SEC | RISK-004 | — | full |
| FR-009 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-010 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-011 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-012 | MVP | ADR-0006 (namespacing) | WBS-2.1 | TEST-INST | RISK-002 | — | full |
| FR-013 | MVP | Gate-4 reuse; gate-8 pinning | WBS-1.5 defaults | TEST-UP | RISK-004 | — | full |
| FR-014 | MVP | Keep-matrix `lsp:false` default | WBS-1.5 | TEST-BUILD | — | AC-013 | full |
| FR-015 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-016 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-017 | MVP | Gate-4 reuse-as-is; DEC-009 | upstream (reuse-as-is) | TEST-UP | RISK-001 | — | full |
| FR-018 | MVP | Keep-matrix extend | WBS-1.5, WBS-2.1 | TEST-AUTH, TEST-SEC | RISK-007 | AC-016 | full |
| FR-019 | MVP | ADR-0003 | WBS-1.4 | TEST-CONTRACT | RISK-001 | — | full |
| FR-020 | MVP | Keep-matrix extend | WBS-1.3 | TEST-AUTH | — | — | full |
| FR-021 | MVP | Gate-8 B4 | WBS-4.4 (upstream base) | TEST-SEC | RISK-003 | AC-012 | full |
| FR-022 | MVP | ADR-0003 | WBS-1.4 | TEST-CONTRACT | RISK-001 | AC-006 | full |
| FR-023 | MVP | ADR-0003 | WBS-1.4 | TEST-CONTRACT | RISK-001 | AC-006 | full |
| FR-024 | MVP | ADR-0003, DEC-002 | WBS-1.4 | TEST-CONTRACT, TEST-SYNC | RISK-006 | AC-006 | full |
| FR-025 | MVP | DEC-002, ADR-0003 | WBS-1.4 | TEST-CONTRACT | — | — | full |
| FR-026 | MVP | ADR-0003 | WBS-1.4 | TEST-CONTRACT | — | AC-008 | full |
| FR-027 | MVP | ADR-0003 | WBS-1.4 | TEST-CONTRACT | — | AC-008 | full |
| FR-028 | MVP | ADR-0003 | WBS-1.4, WBS-4.3 | TEST-CONTRACT, TEST-TG | RISK-003 | AC-012 | full |
| FR-029 | MVP | ADR-0003 (subagent events confirmed via EXP-001) | WBS-0.4, WBS-1.4 | TEST-CONTRACT | — | — | partial |
| FR-030 | MVP | Gate-7 envelope | WBS-1.3 | TEST-AUTH | — | — | full |
| FR-031 | MVP | Gate-7 envelope | WBS-1.2 | TEST-AUTH | — | AC-003, AC-004 | full |
| FR-032 | MVP | Gate-7 envelope | WBS-1.3 | TEST-AUTH | — | AC-005 | full |
| FR-033 | MVP | Gate-7 envelope | WBS-1.3 | TEST-AUTH | — | AC-003 | full |
| FR-034 | MVP | Gate-7 (extend if absent) | WBS-1.2 | TEST-CONTRACT | — | AC-001 | full |
| FR-035 | MVP | Gate-7 policy | WBS-1.4 | TEST-CONTRACT | RISK-001 | AC-015 | full |
| FR-036 | MVP | Gate-7 event contract | WBS-3.2 | TEST-SYNC | RISK-006 | AC-007 | full |
| FR-037 | Full | Deferred (Full) | — | — | — | — | gap |
| FR-038 | MVP | ADR-0004 | WBS-3.1 | TEST-SYNC | — | AC-006 | full |
| FR-039 | MVP | ADR-0004; OQ-003 answer | WBS-3.1 | TEST-SYNC | — | AC-006 | full |
| FR-040 | MVP | ADR-0004 + EXP-001 | WBS-0.4, WBS-3.3 | TEST-SYNC | RISK-010 | AC-009 | full |
| FR-041 | MVP | ADR-0004 + EXP-001 | WBS-3.3 | TEST-SYNC | RISK-010 | AC-009 | full |
| FR-042 | MVP | ADR-0004 | WBS-3.1 | TEST-SYNC | — | AC-006 | full |
| FR-043 | MVP | ADR-0004; R-03 gap | WBS-3.2 | TEST-SYNC | — | AC-008 | full |
| FR-044 | Full | Deferred (Full) | — | — | — | — | gap |
| FR-045 | MVP | ADR-0005 | WBS-4.1, WBS-4.5 | TEST-TG | — | — | full |
| FR-046 | MVP | ADR-0005; ADR-0009; DEC-014; R-09/R-11 | WBS-4.1, WBS-4.2, WBS-6.1..6.6 | TEST-TG | RISK-006 | AC-011, AC-017 | full |
| FR-047 | Full | ADR-0005; ADR-0010; DEC-015/016; R-12 | WBS-7.1..7.5 | TEST-WA | RISK-013, RISK-014 | AC-018 | partial (designed; PH-7) |
| FR-066 | Full | ADR-0011; ADR-0012; DEC-017/018 | WBS-6.1, WBS-6.3, WBS-6.4 | TEST-SYNC | RISK-015, RISK-019 | AC-019 | partial (designed; PH-6) |
| FR-048 | MVP | R-09 cadence; EXP-003 | WBS-4.2 | TEST-TG | — | AC-011 | full |
| FR-049 | MVP | R-09 caps | WBS-4.5 | TEST-TG | — | — | full |
| FR-050 | MVP | Gate-8 B1 | WBS-4.1 | TEST-TG | RISK-003 | AC-010 | full |
| FR-051 | MVP | R-09 long-polling + update_id dedup | WBS-4.1 | TEST-TG | — | AC-010 | full |
| FR-052 | MVP | Gate-8 B2; INV-001 | WBS-4.4 | TEST-TG, TEST-SEC | RISK-003 | AC-012 | full |
| FR-053 | MVP | ADR-0006 + EXP-002 | WBS-2.1, WBS-2.2, WBS-2.3 | TEST-INST | RISK-002 | AC-001, AC-002 | full |
| FR-054 | MVP | Keep-matrix extend | WBS-2.1 | TEST-INST | — | AC-001 | full |
| FR-055 | MVP | Gate-8 B7 | WBS-1.3 | TEST-SEC | RISK-007 | AC-016 | full |
| FR-056 | MVP | Keep-matrix; R-10 pin | WBS-1.3 | TEST-AUTH | — | — | full |
| FR-057 | MVP | Gate-7 request-ID | WBS-1.3 | TEST-AUTH | — | — | full |
| FR-058 | Full | Deferred (Full) | — | — | — | — | gap |
| FR-059 | MVP | Gate-7, Gate-8 | WBS-1.3 | TEST-AUTH | — | AC-016 | full |
| FR-060 | MVP | C-6; gate-10 | WBS-1.1, WBS-5.1, WBS-5.2 | TEST-BUILD | RISK-009 | AC-013, AC-014 | partial |
| FR-061 | MVP | ADR-0001; gate-9 | WBS-5.3 | TEST-SYNCUP | RISK-005 | AC-015 | partial |
| FR-062 | MVP | Gate-9 | WBS-0.3 | TEST-BUILD (CI-enforced) | — | — | full |
| FR-063 | MVP | Gate-13 package | WBS-0.3 (test strategy) | TEST-BUILD | — | — | full |
| FR-064 | MVP | Gate-9, Gate-10 | WBS-0.3, WBS-5.1 | TEST-BUILD | RISK-004 | AC-014 | partial |
| FR-065 | MVP | DEC-008; gate-3 | WBS-1.5, WBS-5.4 | TEST-BUILD (hygiene) | — | AC-013 | full |
| NFR-001 | MVP | ADR-0001, ADR-0002; P-* register | WBS-5.3 (delta report) | TEST-SYNCUP, KPI-004 | RISK-005 | — | full |
| NFR-002 | MVP | DEC-009 | architecture principles | Gate-5 review + phase reviews | — | — | full |
| NFR-003 | MVP | Gates 7–10 artifacts | WBS-5.5 | KPI-006, readiness report | — | — | partial |
| NFR-004 | MVP | CON-011 | WBS-0.3 (3-OS CI matrix) | TEST-BUILD | RISK-004 | AC-014 | full |
| NFR-005 | MVP | Gate-8 threat model | WBS-1.3 | TEST-SEC | RISK-003 | — | full |
| NFR-006 | MVP | ADR-0003, ADR-0004 | WBS-3.1, WBS-3.3 | TEST-SYNC | — | — | partial |
| NFR-007 | MVP | ADR-0004 | WBS-3.1, WBS-3.2 | TEST-SYNC | RISK-006 | AC-006, AC-007 | full |
| NFR-008 | MVP | ADR-0006 | WBS-2.3 | TEST-INST, KPI-003 | RISK-002 | AC-002 | full |
| NFR-009 | MVP | Keep-matrix; R-10 pin | WBS-1.3 | TEST-AUTH | — | — | partial |
| NFR-010 | MVP | Branding/README plan | WBS-5.4 | TEST-BUILD (docs CI) | — | — | partial |
| NFR-011 | MVP | Gate-13 test strategy | WBS-0.3 | TEST-BUILD (coverage) | — | — | partial |
| NFR-012 | MVP | DEC-009; governance | all artifacts | Gate reviews (ongoing) | — | — | full |

**Gaps:** none for MVP-priority requirements (KPI-005 precondition). The three `Scope: Full` rows
(FR-037, FR-044, FR-058) are intentionally deferred post-MVP and live in
[functional](../requirements/functional.md) with triggers. **FR-047 (WhatsApp) is now scheduled as PH-7**
(ADR-0010, DEC-015/016, R-12) — designed and traced, build pending the operator gate.
