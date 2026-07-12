---
status: Final (reflects gates 1–10 approvals)
version: v1.0
updated: 2026-07-03
owner: operator (STK-001)
---

# Executive Summary — Marid

**Marid** is a private agent platform built as a **tracking fork of OpenCode**: one runtime serving a
TUI, a token-secured HTTP+SSE API, the web UI, and a Telegram bot — runnable as multiple fully isolated
instances on one machine, on a private network, for a single operator.

**The key discovery of the planning phase:** most of the target already exists upstream. The remote API
(7/16 requirements as-is), event-sourced session storage with per-session replay, optional LSP, OTLP
observability, and 12-target release machinery are all present. The plan therefore builds only four
things: **marid-gateway** (the Marid Gateway — bearer tokens, rate limits, audit, and the `/marid/*` routes;
**marid-auth** is its auth module, ADR-0011), **marid-instance** (claudectl-style isolated
runtimes), **marid-telegram** (a *channel* gateway process — a client of marid-gateway — outside the core),
and a **distribution profile** that ships the keep-list without deleting anything — keeping the upstream
merge surface near zero (≤ 3 enumerated patch items).

**Approved decisions (gates 1–10):** instance = isolated runtime · MVP = API+SSE, cross-interface sync,
Telegram, multi-instance (WhatsApp deferred) · single operator, private network · name **Marid** ·
reuse-first principle · tracking fork with monthly merges + weekly conflict checks + security fast-path ·
build on v1 API behind a facade while watching upstream's experimental v2 · six-phase roadmap gated by
six measurable KPIs.

**Top risks:** upstream's in-flight v1→v2 API/SDK migration (mitigated by contract tests + facade),
the partially-wired v2 concurrency queue (validated by experiment EXP-001 before reliance), and prompt
injection through channels (contained by deny-by-default capability policy — INV-001).

**Status:** planning package complete; execution starts at PH-0 (fork creation — gate 11 approval —
plus four validation experiments) using the handoff prompts in `handoff/`.
