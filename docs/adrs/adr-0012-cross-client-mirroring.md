---
id: ADR-0012
status: Approved
version: 1.1.0
updated: 2026-07-10
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0012 — Full bidirectional cross-client session mirroring (explicit-attach scope)

**Status:** **Approved (2026-07-10 operator PH-6 gate; EXP-008 validates additive + cross-surface INV-001 at build)** · relates to FR-038/040/041/042/043, FR-066, INV-001,
NFR-007, RISK-015/019, DEC-018, ADR-0004 (amends), ADR-0005, ADR-0008 (reverses its "web→TG not mirrored" note),
ADR-0011, EXP-001/EXP-008, [C-12](../architecture/technology-comparison.md).

**Context.** Today TUI/Web/API already sync (one `marid serve`, shared store, live SSE firehose), but a channel
gateway only surfaces turns it originated (`gateway.ts:104` early-returns for non-owned sessions; a streamer is
built only on a channel-inbound turn) — "web→Telegram not mirrored" was **by design** (ADR-0008). The operator
requires **full bidirectional mirroring across all clients**. Verified at source (`event-filter.ts`): the `/event`
firehose already streams **all** instance events to every client's SSE connection, and `filterSseStream(body,
owns)` tees + **drops** frames the token doesn't own (by `properties.sessionID`). So mirroring is **additive** —
no new broadcast bus.

**Decision.** Mirror every turn of a session live to **every surface bound to that session**, bidirectionally.

- **Scope = explicit-attach (INV-001-safe, operator-chosen).** A channel sees its **own** sessions + sessions the
  operator **explicitly attaches** it to (OpenClaw docking-style: an `/attach <sessionId>` command or a share
  action that writes the binding). A fresh web/TUI session does **not** auto-appear in a channel until attached —
  a deliberately restricted channel never auto-observes a privileged session.
- **Mechanism (additive).** (a) a mutable **session↔surface binding registry** (additive state, like the existing
  `ownership.json`), populated by the attach action; (b) replace the `event-filter` `owns` predicate with a
  binding-aware **`isVisible`** predicate (additive edit to `event-filter.ts`); (c) `@marid/channel-client`
  consumes bound sessions instead of early-returning. Adopt **only** OpenClaw's fan-out + refresh-on-gap
  *pattern*, mapped to SSE: per-connection monotonic `seq` → SSE `id:`; **scope-gated broadcast** by `channel:`
  token (fail-closed on unknown event families); **no replay; refresh on gap** via a `stateVersion` snapshot +
  `Last-Event-ID` reconnect. Do **not** import OpenClaw's `agent:<id>:<channel>:<scope>:<jid>` key scheme — reuse
  Marid's `chatToSession` + ownership.
- **Recovery = re-fetch-authoritative-state on reconnect** (additive default; the store is durable/event-sourced,
  so no final-state loss). Gap-free durable event replay (cursors the upstream firehose lacks) is a **flagged
  escape hatch** that would leave the additive envelope (upstream edit / experimental sync subsystem) — not
  chosen.
- **Cross-surface authorization (first-class INV-001 design): view-via-binding, act-via-ownership.** The
  binding-aware `isVisible` filter lets a surface **see** a bound session's events, but `scope.ts:109` still gates
  **acting** (prompt / permission-approve) on **ownership** — so a low-scope channel can view a mirrored session
  but **cannot approve a permission for a session it does not own**; no privilege escalation via mirroring.
  Permission surfacing across bound surfaces: first-responder-wins, no double-approve, each bounded by its token
  scope. Concurrency: the one-Runner join/steer (ADR-0004/EXP-001) now spans channels.
- **Constraint:** `owns`/`isVisible` is snapshotted at subscribe time (`event-filter.ts:56-58`), so a binding
  created **mid-stream** takes effect only after the channel-client **reconnects** — the attach action triggers a
  reconnect.

**Consequences.** A session the operator attaches to Telegram mirrors bidirectionally (web/TUI turns appear in the
chat and vice-versa) with server-enforced INV-001 intact; unattached sessions stay private to their surfaces.
Additive: binding registry + one filter-predicate change + client change, zero upstream edit (RISK-019
downgraded). Realized in PH-6 (WBS-6.3/6.4), verified by EXP-008. Amends ADR-0004 (channels now subscribe+mirror
within one process); reverses ADR-0008's "by design" non-mirroring note. NFR-007 (no lost/duplicated messages
after reconnect) extended to channels.

**Rejected.** (1) **Broad auto-mirror** (every instance session to every surface) — a restricted channel would
observe privileged sessions; loosens INV-001; rejected in favor of explicit-attach. (2) **Per-chat single session
only** (no cross-session visibility) — too narrow for "full sophisticated sync." (3) **Gap-free durable replay** —
leaves the additive envelope (NFR-001); kept as a documented escape hatch. (4) **OpenClaw's composed session-key
scheme** — redundant with Marid's existing session identity.
