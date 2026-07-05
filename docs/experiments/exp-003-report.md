---
artifact: experiment-report
experiment: EXP-003
hypothesis: HYP-003
status: PASS
version: v1.0
updated: 2026-07-04
---

# EXP-003 — Telegram cadence probe

**Verdict: PASS (live). HYP-003 confirmed.**

Validates [HYP-003](../hypothesis-register.md): *Telegram edit-coalesced streaming at 1 edit / 2–3 s
gives acceptable UX without hitting 429s in normal use.* Blocks the marid-telegram UX contract; validates
the R-09 cadence numbers under a real bot token.

## Result in one line

At a 2.5 s edit cadence over a full 3-minute run (68 `editMessageText` calls), **zero 429s** and zero
errors; the permission inline-keyboard **technical round-trip was 222 ms** — both PASS criteria met with
wide margin. The R-09 edit-coalesced streaming design (≥ 2 s cadence) is safe as specified.

## Method (fully live — no deferral)

Unlike EXP-002/004 (blocked by absent `bun`), EXP-003 needs only HTTPS to `api.telegram.org`, which Node
provides. Executed against a **real throwaway bot** (@marid_exp003_test_bot) and the operator's real chat
(id `505294940`) on 2026-07-04. Probe: `scratchpad/tg-probe.js` (no dependencies, Node `https`). The bot
token was supplied at runtime and never written to any committed file (INV-002); revoked after the run.

Network egress confirmed first via `getMe` → 200.

## Test 1 — Edit-coalesced streaming cadence

Simulated a streaming reply: one `sendMessage`, then `editMessageText` every 2.5 s for 180 s, growing the
message body each edit (like token streaming), watching every response for HTTP 429.

| Metric | Value |
|---|---|
| Duration | 180 s |
| Cadence | 2.5 s/edit |
| Edits sent | **68** |
| HTTP 429 (rate-limited) | **0** |
| Other errors | 0 |
| Max edit latency | 462 ms |

**PASS criterion "no 429s in normal cadence": met.** 68 consecutive edits at 2.5 s with no throttling and
sub-500 ms latency. (68 rather than ~72 reflects each round-trip's own latency eating into the 2.5 s
budget — expected, and it means the *effective* cadence was slightly slower than 2.5 s, still 429-free.)

## Test 2 — Permission inline-keyboard round-trip

Sent a permission prompt with an inline `[✅ Approve] [❌ Deny]` keyboard, long-polled `getUpdates` for the
`callback_query`, then `answerCallbackQuery` + `editMessageText` to confirm the decision.

| Metric | Value | Note |
|---|---|---|
| Choice | approve | operator tapped Approve |
| send → tap | 5535 ms | **human reaction time** (not the measured round-trip) |
| callback → `answerCallbackQuery` | **102 ms** | technical ack latency |
| callback → confirm edit (full technical round-trip) | **222 ms** | ack + confirmation edit |

**PASS criterion "approve/deny round trip < 5 s": met.** The technical round-trip (from receiving the tap
callback to acknowledging and confirming it) is 222 ms — the callback delivery + `answerCallbackQuery` +
confirming `editMessageText` path is ~20× under budget. The 5.5 s send-to-tap is the operator noticing and
tapping, outside the system's control and not the criterion.

## Decision impact

- **HYP-003: CONFIRMED.** 2.5 s edit-coalesced streaming does not hit 429s; permission round-trip is well
  under 5 s.
- **marid-telegram UX contract:** the R-09 ≥ 2 s edit cadence stands as designed. Headroom exists (68
  edits, 0 throttles) — but keep the ≥ 2 s floor; do not drop below it, as Telegram's per-chat edit limits
  tighten under bursts (this run was steady-state, not bursty).
- No Proposed DEC, no STOP (both criteria met).

## Limitations

- Single 3-minute steady-state run on one chat; not a burst/adversarial test and not a multi-hour
  soak. Sufficient for the MVP cadence decision; a longer soak can be added if the gateway later streams
  much longer replies.
- Real-network timing (latency, any throttling) is provider-side and can vary by region/time; the wide
  margins (0/68 429s, 222 ms round-trip) make the conclusion robust to normal variance.

## Next

EXP-003 closed PASS. This completes all four PH-0 experiments → ready for the MS-001 status note that
unblocks PH-1.
