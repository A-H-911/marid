---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# Dependency Register (DEP-)

External systems, repos, and services the plan or product depends on. Access states are verified facts
(see `../keystone-state.json` → `verified_facts`).

| ID | Dependency | Role | Access state (2026-07-03) | Risk link | Status |
|---|---|---|---|---|---|
| DEP-001 | github.com/anomalyco/opencode (upstream) | Fork base; ongoing sync source | Verified public; local clone current (HEAD eb3476660, branch dev) | fork-drift risk (Stage 15) | Draft |
| DEP-002 | github.com/ahmadabusa3/shaheen | Reference analysis (§15) | Verified **private but accessible** to the authenticated gh account | if access is revoked, §15 comparison becomes blocked | Draft |
| DEP-003 | github.com/A-H-911/keystone | Methodology source (this skill) | Verified public | low | Draft |
| DEP-004 | Bun runtime + Turbo monorepo toolchain | Build/run substrate inherited from upstream | Present in repo | upstream toolchain churn | Draft |
| DEP-005 | LLM provider APIs (15+ via Vercel AI SDK per upstream) | Model execution | Inherited | provider API changes; cost | Draft |
| DEP-006 | Telegram Bot API | Channel adapter (FR-046) | **Researched R-11 (2026-07-09)**: raw Bot API sufficient; hand-rolled zero-dep client already in place; remediation adds one md library (DEP-012) | platform limits (formatting, rate) | Draft |
| DEP-007 | WhatsApp (unofficial client — Baileys / WAHA) | Channel adapter (FR-047) | **Researched R-12 (2026-07-09)**: unofficial-only per DEC-015/016 (official Cloud API needs public ingress, excluded); see DEP-013 | RISK-013 (ban), RISK-014 (supply-chain) | Draft |
| DEP-008 | GitHub (private repo, Actions, releases) | Hosting + CI/CD + distribution | Account verified working (`gh` authenticated) | Actions minutes/cost for private repos | Draft |
| DEP-009 | docs/diagrams (19 diagrams + JSON specs) | Current-state analysis input; must be validated against source | Present in working tree (untracked) | may be outdated vs HEAD — validation required (§3) | Draft |
| DEP-010 | Firecrawl MCP / deep-research tooling | External research (§16) | Firecrawl MCP connected in this session | availability during later sessions | Draft |
| DEP-011 | github.com/A-H-911/claudectl | Reference for instance-manager design (user-supplied) | Verified public, MIT, v0.2.0 | low (patterns only, no runtime dependency) | Draft |
| DEP-012 | `telegramify-markdown` (npm) | Markdown→Telegram MarkdownV2 for `@marid/telegram` (FR-046/048, ADR-0009) | Verified npm MIT, ~15k DL/wk (2026-07-09) | low (pin + review) | Draft |
| DEP-013 | `Baileys` (WhiskeySockets, MIT) / `WAHA` (devlikeapro, Apache-2.0) | Unofficial WhatsApp client for `@marid/whatsapp` (FR-047, ADR-0010) | Verified 2026-07-09: Baileys MIT ~10k★ active; WAHA Core free Apache-2.0 | RISK-013 (ToS/ban), RISK-014 (supply-chain) | Draft |
| DEP-014 | `telegram` (GramJS, npm) | **Test-only** userbot for Telegram real-protocol E2E (ADR-0013 tier 2) | Verified 2026-07-10: MIT, npm v2.26; GitHub repo ~18mo stale; `PHONE_CODE_INVALID` test-DC issues; Bun-compat unverified | RISK-016, RISK-018 | Draft |
| DEP-015 | OpenClaw (github.com/openclaw/openclaw) | **Design reference only, no code port** — gateway architecture + WhatsApp patterns | Verified 2026-07-10: LICENSE genuine MIT; ~382k★ implausible (reference only) | RISK-014 | Draft |
| DEP-016 | Playwright | Telegram Web real-app rendering E2E (ADR-0013 tier 3) | Standard, MIT | RISK-016 | Draft |
| DEP-017 | mobilewright / mobile-mcp (mobile-next) | Native Telegram-app E2E on Android emulator/device (ADR-0013 tier 4, manual) | Verified 2026-07-10: Apache-2.0; needs emulator or wired device | RISK-020 | Draft |
