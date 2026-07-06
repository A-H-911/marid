---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# R&D Backlog

Riskiest unknowns first. Items become hypotheses (`HYP-`) / experiments (`EXP-`) at Stages 12–13 if the
research tracks (R-01..R-10) cannot settle them from evidence alone.

| # | Unknown | Why risky | Settled by |
|---|---|---|---|
| U-1 | Does the existing server+SDK already satisfy the FR-022..036 remote-API surface, and is it stable enough to treat as a public contract? | Wrong answer → rebuild something that exists (INV-007) or ship an unstable API (§6 warning about internal types) | R-02; possibly EXP at Stage 13 |
| U-2 | How does cross-client sync actually work today (event bus scope, TUI subscription, multi-writer behavior)? What breaks with two simultaneous writers? | Core of FR-038..043; concurrency bugs are expensive late | R-03; likely EXP (two-client concurrency probe) |
| U-3 | Which packages can be excluded without breaking runtime/TUI/server/SDK builds? | Removal with hidden deps breaks the build; deletion raises merge-conflict cost (T-3) | R-01; verified by build-exclusion EXP |
| U-4 | What downstream patch surface does each capability change require (fork friction)? | Drives DEC-003 (sync model) and NFR-001 threshold | R-01..R-06 synthesis |
| U-5 | Can Telegram deliver an acceptable "streaming" UX via message editing within its rate limits? | UX of the flagship channel; rate limits may force a different pattern | R-09; small POC in execution phase 1 of channels |
| U-6 | What per-instance state (ports, dirs, locks, caches, child processes) exists today that an isolated-runtime model must namespace? | FR-053 correctness; hidden shared state = cross-instance corruption | R-05; isolation test suite later |
| U-7 | Is `packages/slack` a reusable channel-adapter pattern or a one-off? | Could save or cost the FR-045 contract design | R-06, OQ-009 |
| U-8 | Upstream license/attribution obligations (OQ-008) | Legal constraint on private distribution | R-01 (read LICENSE at baseline) |
