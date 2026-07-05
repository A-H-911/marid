---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# Constraint Register (CON-)

Hard boundaries imposed by the brief or by verified facts about the existing system.

| ID | Constraint | Type | Source | Status |
|---|---|---|---|---|
| CON-001 | Base the product on a **private fork of OpenCode** (github.com/anomalyco/opencode); reuse its agent runtime and terminal experience | Technical | §1 | Draft |
| CON-002 | This mission is research/architecture/planning/handoff — **no product implementation before the analysis, decisions, and approval gates are complete** | Organizational | §1, §22 | Draft |
| CON-003 | Inherited stack: TypeScript + Bun monorepo (Turbo workspaces), SQLite + Drizzle, SolidJS TUI/web, Hono server — changing stack fundamentals would break CON-001/NFR-001 | Technical (existing-system fact) | FACT-001/004; repo CLAUDE.md | Draft |
| CON-004 | Do **not** maintain: desktop apps, IDE-specific integrations, editor-specific interfaces, unrelated cloud/enterprise components, duplicate clients | Scope | §5 | Draft |
| CON-005 | **Keep and maintain the Web user interfaces** as part of the target product | Scope | §5 | Draft |
| CON-006 | Channel mechanism lives **outside the agent core**, behind stable contracts | Architectural | §8 | Draft |
| CON-007 | Use **Git Flow**, adapted for a private downstream fork | Process | §14 | Draft |
| CON-008 | Forking gate: no private repo creation/modification until name approved, upstream baseline recorded, strategy approved, and local working tree inspected | Process | §14 | Draft |
| CON-009 | CI/CD on **GitHub Actions** is mandatory | Technical | §18 | Draft |
| CON-010 | Research via Firecrawl MCP or /deep-research; if unavailable, best available mechanism with the limitation stated | Process | §16 | Draft |
| CON-011 | Support Linux, macOS, Windows; x64 baseline, ARM64 only where justified | Technical | §12 | Draft |
| CON-012 | Mandatory pause at the 14 decision gates (§22); never approve on the user's behalf | Process | §22 | Draft |
| CON-013 | Every important technical claim needs a citation or an explicit `unverified` marker | Process | §16, §23 | Draft |
| CON-014 | Upstream code that would make future synchronization difficult must not be modified; compare deletion vs build-exclusion vs flags vs package boundaries vs distribution profiles before any removal decision | Technical | §2 | Draft |
