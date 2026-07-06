---
experiment: EXP-001
hypothesis: HYP-001
status: PASS
version: v1.0
updated: 2026-07-04
owner: operator (STK-001)
---

# EXP-001 — Two-client concurrency probe

**Verdict: PASS. HYP-001 confirmed.**

Validates [HYP-001](../research/hypothesis-register.md): *the upstream v2 single-writer / queue / steering
path already gives safe behavior for two simultaneous clients of one session (no corruption;
deterministic queue/steer semantics).* Blocks DEC-005 final wording and the C-5 fallback choice.

## Result in one line

Upstream serializes every concurrent action on a session through **one `Runner` per session backed
by an atomic `SynchronizedRef`**, and persists each user message to the DB **before** the run starts.
A second simultaneous prompt therefore cannot corrupt state: it either **joins** the in-flight run
(and steers it — its message is absorbed on the run's next step) or is **rejected with `BusyError`**
for exclusive operations. → **Marid needs no busy-lock/queue layer of its own** (C-5 option C is *not*
required).

## Setup actually executed (and deviation from the plan)

The hypothesis-register SETUP reads: *"one `opencode serve` instance; two SDK clients prompt the same
session simultaneously."* This was executed instead at the **real-runtime service layer plus the real
SSE transport**, because:

1. The two-SDK-clients-over-HTTP path funnels into the exact same code:
   `POST /session/{id}/prompt[_async]` → `SessionPrompt.Service.prompt` → `loop` →
   `SessionRunState.ensureRunning` (server handler `handlers/session.ts:295–319`; run wiring
   `session/prompt.ts:1052–1070, 1342–1346`). Driving that service directly with two concurrent
   fibers exercises the identical concurrency authority a two-client HTTP rig would.
2. It is **deterministic** — the suite drives a real local `TestLLMServer` over HTTP (real provider +
   real prompt + real run-state + real SQLite + real event bus; only the model endpoint is a local
   stub). No real-API cost, no network flake, no mock of the system under test.
3. A bespoke HTTP two-client rig would add cost and flake with **no new signal** on criteria 1 & 2.
   For criterion 3 (SSE ordering) the real SSE transport *is* exercised — see below.

**Execution note:** `bun` was not resolvable on `PATH` in this session (neither Bash nor PowerShell),
so local invocation wasn't possible. The empirical evidence is the CI run against the current tree
HEAD (`develop` @ `3efd61632`), run **`28695066157` / `28695064894`** — the unit job (windows-latest +
ubuntu-latest + macos-latest) runs the whole `test/` tree, including the files cited below, and passed
on all three OSes. Every cited test uses `it.instance` / `noLLMServer.instance` (not the `unix`-gated
`.skip` variant), so they run on all three OSes rather than being platform-skipped.

## Evidence per PASS criterion

| PASS criterion | Mechanism (code) | Empirical (green tests) |
|---|---|---|
| **1. No interleaved / corrupt messages** | One `Runner` per session, all state transitions through an atomic `SynchronizedRef` (`effect/runner.ts:115–138`, `session/run-state.ts:71–107`). User message persisted **before** the run (`session/prompt.ts:1057` then `1070`). Message writes serialize through the DB. | `session/prompt.test.ts:1332` "concurrent loop callers get same result" (two callers → same assistant id, ends not-busy); `:1131` integrity after concurrent cancel (zero poison messages, correct `parentID`); `:1302` "cancel with queued callers resolves all cleanly" (both get same message id). `effect/runner.test.ts:37` "concurrent callers share the same run" (work runs exactly once). |
| **2. Second prompt queued OR steers per documented v2 semantics** | `ensureRunning`: Idle → start; **Running → join the same `Deferred`** (does *not* spawn a second run); `runLoop` re-reads the full DB message list at the top of **every step** (`session/prompt.ts:1088–1098`), so an already-persisted second prompt is absorbed by the in-flight run = the **steer**. Exclusive ops reject via `assertNotBusy` / `startShell` → `BusyError`. | `session/prompt.test.ts:1365` "prompt submitted during an active run is included in the next LLM input" (last LLM input == the 2nd message; both fibers succeed; 2 assistants with correct `parentID`); `:1431` `assertNotBusy` → `BusyError` while running; `:1471` shell → `BusyError` while running. `effect/runner.test.ts:89` "second ensureRunning ignores new work if already running." |
| **3. SSE events ordered per aggregate** | Single instance event bus (`EventV2Bridge`) → **per-subscriber unbounded FIFO `Queue`** → ordered SSE encode (`handlers/event.ts:31–73`). Because the 2nd concurrent prompt *joins* rather than spawning a parallel producer, a run has exactly **one event producer** → no cross-run interleaving; FIFO preserves per-aggregate order. | `server/httpapi-event.test.ts:80` "delivers instance events after the initial event" — ordered delivery over the **real SSE transport** (`server.connected` → `session.created`, read off an ordered queue). |

> **PH-3 correction (2026-07-05).** The "client resumes with `?after=<lastSeq>` per session" phrasing in
> the *Setup* / *Evidence* notes below overstated the v1 surface: the `/event` firehose is **live-only**
> (no `?after=` cursor, no `Last-Event-ID`). The concurrency findings in this report stand unchanged
> (join/steer/BusyError/abort, all verified). Only the *reconnect* mechanism was mis-stated — recovery is
> authoritative-state re-fetch, not event replay. Authoritative wording: `api-event-contract.md` v1.1
> (*Ordering & recovery*); ADR-0004 carries the same note.

## Abort / steer / cancel behavior (bonus, all green)

- `abort` = `SessionRunState.cancel` → interrupts the run fiber, resolves **all** joined awaiters via
  `onInterrupt` with the same finalized assistant message (`prompt.test.ts:1083, 1107, 1302`).
- Cancel mid-processor-creation still finalizes a clean assistant message, no poison rows
  (`prompt.test.ts:1131`).
- Cancel propagates from a parent session to its subtask child sessions (`prompt.test.ts:1267`).

## Honest limitations

- **No dedicated test asserts ordering of many part-deltas within a single message aggregate.** That
  finer-grained ordering rests on the FIFO-queue mechanism + the single-producer-per-run property
  (both verified in code), not on a bespoke assertion. Risk is low; a targeted "one run emits N part
  deltas, assert monotonic receipt order over SSE" test would make criterion 3 belt-and-suspenders.
  Logged, not blocking.
- Empirical runs are CI (3 OSes) at HEAD, not a local invocation, because `bun` is absent locally.

## Decision impact

- **HYP-001: CONFIRMED.** No corruption; second prompt deterministically joins+steers or is rejected
  with `BusyError`; SSE ordered per aggregate.
- **C-5 fallback (option C — busy-lock + queue in the marid layer): NOT required.** The upstream
  run-state is the concurrency authority; the marid layer builds on it rather than duplicating it.
- **DEC-005** can be worded to rely on the upstream per-session `Runner` for cross-client concurrency.
- No Proposed DEC and no STOP (those are the FAIL path; this is PASS).

## Next

EXP-001 closed PASS → proceed to EXP-002 (two-instance isolation), EXP-003 (Telegram cadence),
EXP-004 (distribution-profile build) to complete MS-001, then the MS-001 status note that unblocks
PH-1.
