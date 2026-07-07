# Marid — planning & execution package

This directory is the **authoritative planning package** for **Marid**, a private agent platform built as a
tracking fork of [OpenCode](https://github.com/anomalyco/opencode) (MIT). It is a
[Keystone](https://github.com/A-H-911/keystone) **v1.0.0** package: docs are the source of truth; code
follows the docs. Marid is mid-execution — **PH-0..PH-3 done (MS-004); PH-4 (Telegram) is next**.

## How an agent should consume this

Read in this order:

1. [`00-charter.md`](00-charter.md) — problem, objectives, scope, success metrics (KPI-), stakeholders (STK-).
2. [`01-executive-summary.md`](01-executive-summary.md) — one-page orientation + recommendation.
3. [`AGENTS.md`](AGENTS.md) — **standing operating context** (invariants, hard constraints, tracking
   protocol). The repo-root `CLAUDE.md` imports this; Claude Code auto-loads it every session.
4. [`architecture/architecture.md`](architecture/architecture.md) — target architecture + patch-surface register.
5. [`planning/roadmap.md`](planning/roadmap.md) → [`work-breakdown.md`](planning/work-breakdown.md) →
   [`milestones.md`](planning/milestones.md) — the phased plan.
6. [`progress/status-report.md`](progress/status-report.md) — where execution actually is right now.

## Layout

| Directory | Contents |
|---|---|
| `requirements/` | FR / NFR / constraint / invariant / dependency registers |
| `decisions/` | open-question, open-decision (DEC-001..013), assumption registers |
| `research/`, `experiments/` | research plan, R&D backlog, hypotheses, EXP-001..004 reports, findings |
| `architecture/` | architecture, API/event contract, threat model, sync strategy, keep-list, current-state, `diagrams/` |
| `adrs/` | ADR-0001..0006 (immutable after approval) |
| `risks/` | risk register (RISK-) |
| `planning/` | roadmap (PH-), work-breakdown (WBS-), milestones (MS-) |
| `execution/` | definition-of-ready / -done, checkpoints, deferred-work register |
| `validation/` | acceptance-criteria (AC-), acceptance-audit, test-strategy, traceability-matrix |
| `progress/` | progress-log, status-report |
| `handoff/` | initial / follow-up / review prompts, handoff manifest, execution-readiness report |
| `governance/` | governance, naming-conventions, contributing |
| `keystone-state.json` | machine-owned normalized state (resume/update) |
| `manifest.json` | package manifest (artifacts, versions, omissions) |

## Validating this package

```
python <keystone-skill>/scripts/validate_package.py docs/    # must print RESULT: OK
```

Runs the mechanical gates (G-IDS, G-DEC-STATUS, G-REQ-SRC, G-COMPLETE, G-TRACE, G-SET, G-PROGRESS). Keep the
tracking surface current per the protocol in [`AGENTS.md`](AGENTS.md) and
[`governance/governance.md`](governance/governance.md).

## Attribution

Marid is a private downstream distribution of OpenCode (MIT), not affiliated with or endorsed by it.
Migrated to the Keystone v1.0.0 package structure on 2026-07-06 (package v2.0.0).
