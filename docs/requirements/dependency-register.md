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
| DEP-006 | Telegram Bot API | Channel adapter (FR-046) | Not yet researched | platform limits (formatting, rate) | Draft |
| DEP-007 | WhatsApp Business/Cloud API | Channel adapter (FR-047) | Not yet researched | approval process, pricing, policy limits | Draft |
| DEP-008 | GitHub (private repo, Actions, releases) | Hosting + CI/CD + distribution | Account verified working (`gh` authenticated) | Actions minutes/cost for private repos | Draft |
| DEP-009 | docs/diagrams (19 diagrams + JSON specs) | Current-state analysis input; must be validated against source | Present in working tree (untracked) | may be outdated vs HEAD — validation required (§3) | Draft |
| DEP-010 | Firecrawl MCP / deep-research tooling | External research (§16) | Firecrawl MCP connected in this session | availability during later sessions | Draft |
| DEP-011 | github.com/A-H-911/claudectl | Reference for instance-manager design (user-supplied) | Verified public, MIT, v0.2.0 | low (patterns only, no runtime dependency) | Draft |
