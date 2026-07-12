---
id: ADR-0017
status: Approved
version: 1.0.0
updated: 2026-07-11
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0017 — Firehose owns∪bound filter resolves a token's own mid-stream sessions lazily

## Status

**Approved** (2026-07-11, operator STK-001) — a companion to
[ADR-0016](adr-0016-sse-isolation-route-not-header.md), uncovered while implementing it; the approach was
evaluated with the reviewer before implementing (Option B "lazy re-read on first-sight"). Implemented and
proven deterministically (below).

## Context

ADR-0016 made the owns∪bound SSE filter actually run on the real (header-less) SDK firehose path — closing
the INV-001 leak. Turning the filter **on** exposed a latent defect the leak had masked: the gateway timed
out on a normal text turn (its own reply never rendered).

**Root cause (proven deterministically — `packages/opencode/scripts/own-session-visibility-repro.ts`,
Check 1):** the filter snapshots a token's `owns∪bound` set **at subscribe time**. The channel-client
subscribes at gateway startup owning **zero** sessions, then the gateway creates a session **mid-stream**
(one per inbound turn). That session is absent from the frozen snapshot, so its own reply frames were
correctly-but-fatally filtered out. Pre-ADR-0016 the firehose was unfiltered, so the gateway saw its own
sessions anyway — the leak was **load-bearing**, and WBS-6.1 slice b's owns∪bound filter was never actually active
on the real channel path.

**Blast radius:** `marid token create` defaults to the non-admin **`client`** scope, so web/TUI/API clients
share the same SDK (missing header) and the same filter — a client that subscribes then creates a session
mid-stream would hit the same defect. A **server-side** fix is therefore required; a channel-client-only fix
would leave the other non-admin clients broken (and had a multi-session re-subscribe-teardown defect besides).

## Decision (proposed)

The firehose filter resolves a token's visibility **lazily, on first sight** of a session id, instead of
from a frozen subscribe-time snapshot:

- Keep the subscribe-time `owns∪bound` set as the initial cache.
- On a frame whose session id is not cached, re-read ownership once (`ownership.owns(token, id)`); if owned,
  **cache the positive** (an owned id stays owned) and admit.
- Do **not** negative-cache: a session's `created` frame can arrive *before* its create request finishes
  recording ownership (a create-vs-record race), so a not-yet-owned id must be re-checked on its next frame
  — the assistant reply, which lands after ownership is recorded, is then admitted. Cost is one small
  ownership read per non-owned frame; a token only ever owns sessions it created, so this never widens
  visibility incorrectly. Binding changes stay on the existing WBS-6.5 self-bindings re-subscribe.

`filterSseStream`/`keepFrame` take an async visibility predicate; the list-route filter keeps its sync one.
Marid-owned (`marid-auth`), additive, no upstream edit, no new `P-*`.

## Alternatives considered

- **A — channel-client re-subscribes on first `beginTurn` per session.** Rejected: only fixes
  `@marid/channel-client`, not web/TUI/API clients on the same scope+SDK (insufficient by construction); and
  a re-subscribe for session Y tears down session X's in-flight stream (the intentional-re-subscribe path
  skips recovery re-fetch → X's frames drop) — a multi-session correctness hole PH-7 would inherit.
- **B-timer — server re-reads owns∪bound on a fixed short TTL.** Rejected: a fast (fake-LLM) reply inside the
  TTL window is dropped with no recovery; adds a per-stream timer. The first-sight lazy form has neither
  problem.
- **Negative-caching the lazy read.** Rejected: the create-vs-record race makes a negative result unstable
  for a token's own just-created session (confirmed — the own session stayed invisible until the negative
  cache was removed).

## Consequences

- **Positive:** the gateway (and any non-admin client) sees its own mid-stream-created sessions without a
  re-subscribe, while INV-001 isolation holds. Restores the normal turn flow ADR-0016 broke.
- **Cost:** one `ownership.owns` file read per firehose frame whose session id is not yet cached-visible
  (i.e. non-owned frames). Bounded and small (single-operator deployment); if it ever measures hot, an
  in-process ownership-generation counter can gate re-reads to actual ownership changes (future work).
- **Verification (deterministic):** lazy-visibility unit test (owned-but-absent-from-snapshot is delivered);
  isolation preserved (`global-event-filter.test.ts` PART 2b + `global-event-isolation-repro.ts`, all paths
  isolated); real gateway flow green (`telegram.test.ts`, 2 pass — reply delivered); marid-auth 123 green.

## Links

- Parent: [ADR-0016](adr-0016-sse-isolation-route-not-header.md); invariant **INV-001**; [EXP-015](../experiments/exp-015-report.md); [RISK-025](../risks/risk-register.md).
- Prior: WBS-6.1 slice b (owns∪bound filter), WBS-6.5 (self-bindings re-subscribe), ADR-0011 (marid-auth gateway).
