---
artifact: open-question-register
status: Draft
version: v0.2
updated: 2026-07-03
---

# Open-Question Register (OQ-)

Blocking questions were answered in clarification batch 1 (gate 1, 2026-07-03). Answers are recorded
verbatim-in-substance; they now bind the scope (Stage 8).

| ID | Question | Answer / state | Blocking? | Status |
|---|---|---|---|---|
| OQ-001 | What does an "instance" mean (§9)? | **Isolated runtime**: one self-contained runtime with its own config, storage/DB, cache, ports, secrets, and logs; may serve one or more projects/workspaces internally | Was blocking | **Answered** (batch 1) |
| OQ-002 | Which capability blocks are MVP? | **All four in MVP**: remote API + SSE, cross-interface sync, Telegram adapter, multi-instance operation. **WhatsApp deferred to post-MVP.** Web UI keep remains CON-005 | Was blocking | **Answered** (batch 1) |
| OQ-003 | Single-operator or multi-user MVP? | **Single operator**: one human; apps/channels authenticate with operator-issued API keys/tokens; channel identities map to the operator | Was blocking | **Answered** (batch 1) |
| OQ-004 | MVP network exposure of the API? | **Private network only**: localhost/LAN/private overlay (VPN/Tailscale); channels reach the agent via outbound connections or a webhook relay | Was blocking | **Answered** (batch 1) |
| OQ-005 | Exact keep-list of upstream web surfaces (`app`, `web`, `console`, `session-ui`, `storybook`)? | Open — resolve from component inventory at gate 4/6 | No | Open |
| OQ-006 | Time/budget constraints and MVP target date? | Open — proceeding under ASM-005 (no hard deadline; risk-sized effort) | No | Open |
| OQ-007 | Naming preferences (language roots, tone, must-avoid words)? | Open — collected at the naming stage (gate 3) | No | Open |
| OQ-008 | Upstream license/attribution obligations at fork baseline? | Open — verify from repo during current-state analysis | No | Open |
| OQ-009 | Does upstream `packages/slack` set the channel-adapter pattern, and is it in use? | Open — answered by gate-4 analysis | No | Open |
