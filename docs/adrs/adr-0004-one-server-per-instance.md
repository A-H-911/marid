---
artifact: adr
status: Approved (gate 5; concurrency wording final after EXP-001)
version: v1.0
updated: 2026-07-03
---

# ADR-0004 — One server process per instance; all clients attach over HTTP+SSE

**Status:** Approved (2026-07-03) · promotes DEC-005 · derives from C-5

**Context.** R-03: live events reach every client of one server process; nothing propagates events
across processes; the v2 store is event-sourced with per-aggregate sequences; a queue/steer/single-writer
coordinator exists but is only partially wired.

**Decision.** An instance runs exactly one `marid serve` process owning that instance's SQLite store.
TUI, web UI, SDK apps, and channel gateways are all HTTP+SSE clients of it. Cross-interface sync
(FR-038..043) is therefore the existing bus + per-session replay. Concurrency semantics reuse the v2
queue/steering design, verified by EXP-001; fallback if EXP-001 fails: busy-lock + queue in the Marid
layer (C-5 option C).

**Consequences.** No distributed coordination in the MVP (charter non-goal honored); restart recovery =
server restart + client reconnect **and re-read of authoritative session state** (see the correction
below); the TUI must run in client mode against the instance server (not in-process) — a config/launch
default, not a code fork.

> **PH-3 correction (2026-07-05).** This ADR (and EXP-001) originally described reconnect as
> `?after=<seq>`. The v1 `/event` firehose is live-only — no `?after=` cursor, no SSE `Last-Event-ID`
> resumption — so recovery is by **re-fetching authoritative session state** on reconnect, not event
> replay (the store is event-sourced/durable, so no state is lost). The event-sourced `sync` subsystem is
> the only replay path and is out of the MVP contract. Authoritative wording:
> `architecture/api-event-contract.md` v1.1 (*Ordering & recovery*). The rest of this ADR stands: one
> server per instance, HTTP+SSE clients, concurrency via the upstream per-session Runner (EXP-001).

**Rejected.** Multi-process shared-SQLite event propagation (B); global pessimistic lock (C — kept as fallback).
