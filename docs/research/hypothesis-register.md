---
artifact: hypothesis-register
status: Draft
version: v0.1
updated: 2026-07-03
---

# Hypothesis Register (HYP-) & Experiment Plans (EXP-)

Stage 12–13. Each decision-blocking unknown has a falsifiable hypothesis and a timeboxed experiment with
PASS/FAIL criteria. Experiments run in **execution phase 0** (before dependent build work), not during
planning — this package only defines them.

| ID | Hypothesis | Refuted/confirmed by | Blocks |
|---|---|---|---|
| HYP-001 | The upstream v2 single-writer/queue/steering path already gives safe behavior for two simultaneous clients of one session (no corruption; deterministic queue/steer semantics) | EXP-001 | DEC-005 final wording; C-5 fallback choice |
| HYP-002 | Env-var composition (XDG overrides + `OPENCODE_DB` + port) yields complete instance isolation for every item in the R-05 conflict inventory | EXP-002 | marid-instance design freeze |
| HYP-003 | Telegram edit-coalesced streaming at 1 edit/2–3 s gives acceptable UX without hitting 429s in normal use | EXP-003 | marid-telegram UX contract |
| HYP-004 | The `marid` distribution profile builds and passes upstream tests with all excluded packages absent, without editing upstream files (and reveals whether the P-1 server seam is even needed) | EXP-004 | Gate-6 verdict durability; patch-surface register |

## Experiment plans

### EXP-001 — Two-client concurrency probe · timebox 1 day
Setup: one `opencode serve` instance; two SDK clients prompt the same session simultaneously (and one
mid-run "steer"). Observe queue admission, event ordering, message integrity in DB.
**PASS:** no interleaved/corrupt messages; second prompt is queued or steers per documented v2 semantics; SSE events arrive ordered per aggregate. **FAIL:** corruption or undefined behavior → adopt C-5 option C (busy-lock + queue in marid layer) and record a DEC.

### EXP-002 — Two-instance isolation probe · timebox 1 day
Setup: launch two instances via a prototype launcher script composing env per instance; exercise both
(sessions, provider auth, LSP download if enabled, logs). Diff the two instance trees and the real HOME.
**PASS:** zero writes outside each instance's tree; both servers healthy on distinct ports. **FAIL:** any
stray write → enumerate the leaking path; add explicit env/flag or (last resort) a P-* patch item.

### EXP-003 — Telegram cadence probe · timebox 0.5 day
Setup: throwaway bot token; script simulating a streamed reply via sendMessage + editMessageText at
2–3 s coalescing, one 3-minute run, plus a permission inline-keyboard round trip.
**PASS:** no 429s in normal cadence; approve/deny round trip < 5 s. **FAIL:** adjust cadence/chunking;
re-verify against R-09 limits.

### EXP-004 — Distribution-profile build probe · timebox 1 day
Setup: build with a turbo/workspace filter matching the keep-list; run upstream test suites for kept
packages; produce one Bun-compiled binary; check whether marid-auth can attach without editing server
files (plugin/hook seam search).
**PASS:** green build+tests, working binary, seam question answered. **FAIL:** enumerate the breakage;
adjust keep-list or add a justified P-* item.
