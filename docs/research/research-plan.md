---
status: Approved-by-scope (gate 2 scope drives it)
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# Research Plan

Sized per Keystone research-depth rules: effort proportional to uncertainty × blast radius. The
**primary source for most questions is the repository itself** (brief §16 priority 1); web research is
reserved for external platforms and practices. Every finding must cite `path:line` or a URL, or carry
`unverified`.

## Tracks

| Track | Question it answers | Method | Depth | Timebox | Feeds |
|---|---|---|---|---|---|
| R-01 Package inventory & dependency map | Which packages exist, what depends on what, what does the target product require vs. candidates for exclusion (§3, §5) | Repo analysis (workspace graphs, package.json, imports) | Standard | 1 agent-run | Gate 4, DEC-001, DEC-004 |
| R-02 Server, HTTP API, SSE, SDK | What remote-interface capability already exists, stable vs experimental, fit vs FR-022..036 (§3 "Important", INV-007) | Repo analysis (server routes, OpenAPI, sdk/, sdk-next/, protocol/, httpapi-codegen/) | Deep | 1 agent-run | Gate 4/7, DEC-002, DEC-004 |
| R-03 Sessions, storage, sync | Authoritative store, schema/migrations, event bus, TUI↔server sync today; gap vs FR-038..044 | Repo analysis | Deep | 1 agent-run | Gate 4/7, DEC-005 |
| R-04 Agent loop, tools, permissions, plugins, MCP, LSP | What the runtime core actually is; permission model; extension seams | Repo analysis | Standard | 1 agent-run | Gate 4/6/8 |
| R-05 Config, secrets, caching, observability, process lifecycle, packaging | Config precedence today; data dirs/ports/locks (multi-instance baseline); OTel presence; build/release scripts | Repo analysis | Standard | 1 agent-run | Gate 4/6/10, FR-053/054/060 |
| R-06 Channels & web surfaces | What `packages/slack` proves about channel adapters; what app/web/console/session-ui/storybook are; keep-list evidence (OQ-005, OQ-009) | Repo analysis | Standard | 1 agent-run | Gate 4/6, FR-045 |
| R-07 Shaheen reference analysis | §15 pattern extraction (customization, reduction, remote access, channels, sync strategy, …) with adopt/adapt/reject/defer verdicts | Clone (read-only) + analysis; access verified 2026-07-03 (private, accessible) | Standard | 1 agent-run | Gate 4/5/9 |
| R-08 Diagram validation | Are the 19 `docs/diagrams` accurate against HEAD? Corrections/flags per §3 | Cross-check specs vs code + R-01..R-06 outputs | Light | 1 agent-run, after R-01..06 | Gate 4 |
| R-09 Telegram platform research | Bot API: webhook vs polling, formatting/rate limits, streaming simulation (message editing), media, threading, secret handling | Web research (Firecrawl/official docs) | Standard | 1 agent-run | FR-046..052, gate 5 |
| R-10 Fork maintenance, agent security, OTel GenAI | Practices for downstream forks (merge/rebase/patch-stack); OWASP LLM Top-10 / prompt-injection mitigations; OTel GenAI semantic conventions | Web research (primary/spec sources) | Standard | 1 agent-run | DEC-003, gate 8, FR-056 |
| R-11 Telegram remediation options | Fix-in-place vs fork grinev vs adopt-other for the deferred-#9 UX defects; md→Telegram libraries; per-defect minimal fix | Web + GitHub research + repo source read | Standard | 1 agent-run (PH-6 prep) | C-8, DEC-014, ADR-0009, FR-046/048/049 |
| R-12 WhatsApp unofficial-client options | Baileys vs whatsapp-web.js vs wppconnect vs WAHA/Evolution; license/maintenance/ban/supply-chain/stack-fit/private-network fit | Web + GitHub research | Standard | 1 agent-run (PH-7 prep) | C-9, DEC-015/016, ADR-0010, FR-047, RISK-013/014 |

## Explicitly not researched (YAGNI per NFR-002)

- ~~WhatsApp API details — deferred with FR-047~~ — now researched in **R-12** (post-MVP PH-7 prep, 2026-07-09).
- Multi-node coordination, horizontal scaling — out of scope (charter non-goal).
- Alternative runtimes/stacks — CON-003 fixes the stack.
- Exhaustive secret-backend survey — §10 only requires the minimum guarantees for MVP.

## Standards

Primary sources first; claims cited or `unverified`; findings in simple English; each track writes its
findings file under `research/findings/` or `architecture/current-state/` and its verdicts feed the
registers — findings never silently become decisions (Keystone safeguard 2).
