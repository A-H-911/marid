---
milestone: MS-001
phase: PH-0
status: MET (with two live steps deferred — see Deferred)
version: v1.0
updated: 2026-07-04
owner: operator (STK-001)
---

# MS-001 status — PH-0 experiments complete

**Exit criterion** (roadmap): *EXP-001..004 reports accepted; fallbacks recorded if any FAIL.*
**Outcome: MET.** All four experiments PASS; **no FAILs → no fallbacks, no Proposed DECs, no STOPs.**
PH-1 (Marid layer) is unblocked.

## Verdicts

| Exp | Hypothesis | Verdict | Strength | Report |
|---|---|---|---|---|
| EXP-001 | HYP-001 two-client concurrency | ✅ PASS | full (green tests + code) | [exp-001-report.md](../experiments/exp-001-report.md) |
| EXP-002 | HYP-002 two-instance isolation | ✅ PASS | audit-strength (live tree-diff deferred) | [exp-002-report.md](../experiments/exp-002-report.md) |
| EXP-003 | HYP-003 Telegram cadence | ✅ PASS | full (live, real bot) | [exp-003-report.md](../experiments/exp-003-report.md) |
| EXP-004 | HYP-004 distribution profile | ✅ PASS | analysis-strength (live build deferred) | [exp-004-report.md](../experiments/exp-004-report.md) |

## Design outputs (what these change downstream)

1. **No marid concurrency layer** (EXP-001): the upstream per-session `Runner` (atomic `SynchronizedRef`,
   join+steer, graceful abort) is the concurrency authority. C-5 option C (busy-lock + queue) is **not
   built**. DEC-005 can rely on upstream.
2. **marid-instance env set** (EXP-002): `XDG_DATA/CACHE/CONFIG/STATE_HOME` + `OPENCODE_DB` + allocated
   port + **`TMPDIR/TMP/TEMP`** (the last is the one addition beyond ADR-0006's original list) + optional
   `OPENCODE_TEST_HOME` for home-relative reads. Isolation is by namespacing, no locking.
3. **marid-telegram cadence** (EXP-003): ≥ 2 s edit coalescing confirmed safe (68 edits/180 s, 0×429;
   permission round-trip 222 ms). Keep the ≥ 2 s floor.
4. **P-1 dropped** (EXP-004): marid-auth attaches as an outer wrapper around `Server.Default.app.fetch` —
   no upstream server edit. Patch-surface register updated (P-1 struck through); patch surface for MVP is
   now **P-2 (branding), P-3 (config deltas), P-CI (CI timing)** only.

## Deferred (environment-limited, not verdict-limited)

`bun` is not resolvable on this machine, so two *live* confirmation steps could not run here. Neither
changes a verdict; each is a belt-and-suspenders check to run on a bun-capable machine before the relevant
gate:

- **EXP-002 live tree-diff** — launch two `serve` instances with composed env, diff trees + HOME for
  stray writes. (Audit already shows every instance-state write routes through an overridable `Path.*`.)
  Run before the marid-instance design freeze.
- **EXP-004 live build** — turbo/workspace build filtered to the keep-list, run kept packages' upstream
  suites, `bun compile` a binary, and stand up marid-server wrapping `Server.Default.app.fetch` with a
  stub auth middleware. Run before Gate-6 durability sign-off. (Dependency graph already shows the
  keep-list is closed.)

## Notes

- EXP-003 used a throwaway bot token at runtime only; never committed (INV-002); operator to revoke via
  BotFather.
- All PH-0 experiment reports + this note live on branch `exp/ph0-experiments` (one PH-0 PR, also
  carrying the P-CI patch-surface row and the P-1 downgrade).
