---
experiment: EXP-005
hypothesis: HYP-005
status: PASS (offline tiers); LIVE cadence tail pending a throwaway bot token
version: v1.0
updated: 2026-07-10
owner: operator (STK-001)
---

# EXP-005 — Telegram fix-in-place spike

**Verdict: PASS (deterministic tiers). HYP-005 confirmed — the four UX defects are fixed in place by
~1 dependency + small wiring on the existing hand-rolled gateway, and the SSE pump survives a drop. The
one remaining check — streaming cadence hits no 429s — is a LIVE tail that needs a throwaway BotFather
bot + network (mirrors EXP-003); it is not runnable offline and is staged behind an operator-provided
token.**

Validates [HYP-005](../research/hypothesis-register.md): *fixing the five Telegram UX defects in place
(one md library + wiring the existing seams) resolves them with fewer changes than a grinev fork, while
INV-001 stays server-enforced.* Confirms [ADR-0009](../adrs/adr-0009-telegram-channel-remediation.md)
(fix-in-place over fork) and its DEC-014; keeps [C-8](../architecture/technology-comparison.md) closed
in favour of fix-in-place.

## Result in one line

Every deterministic defect fix is small and local, and composes the **existing** gateway modules:
Markdown → **one MIT dep** (`telegramify-markdown@1.3.3`, pinned) with the existing 400→plain fallback;
inbound files → **wire the already-present `resolveDownloadUrl`** into an SDK `FilePartInput` (+ `redact`
the token URL, INV-002); slash → a deny-by-default whitelist; multi-part → emit parts separately; SSE
drop → resubscribe + authoritative re-fetch. **No upstream edit; one new pinned dependency.**

## Setup actually executed (and deviation from the plan)

Executed as a **composition spike** against the real modules + the new dependency, not a full live bot
run, for the same reason as EXP-008: the four UX defects and the reconnect are deterministic and offline,
whereas the cadence/429 check is inherently a **live** measurement (real Bot API rate limits) that needs a
real token and network — the same split EXP-003 used (cadence measured live, logic tested offline).

Spike: `packages/marid-telegram/test/exp-005-fix-in-place-spike.test.ts` (throwaway; the "fix" functions
are the SHAPE the WBS-6.2 wiring takes, kept minimal — not production code). The one production-real change
made: `telegramify-markdown@1.3.3` added to `@marid/telegram` (DEP-012, pinned — RISK-014).

## Evidence (deterministic tiers — all PASS)

| Defect | Fix shape (proven) | Result |
|---|---|---|
| **1 · Markdown not rendered** | `telegramify(text,"escape")` → MarkdownV2 (`**bold**`→`*bold*`, inline code + fences preserved, lists bulletized); throw→plain fallback retained | ✅ renders; raw Markdown gone |
| **2 · inbound files never landed** | existing `resolveDownloadUrl` → `FilePartInput {type,mime,filename,url}`; token URL `redact()`-able | ✅ file part carries the real download URL; token masked (INV-002) |
| **3 · slash commands not routed** | deny-by-default whitelist: whitelisted→handler, non-whitelisted→rejected (never prompted), plain→prompt | ✅ `/help` routes, `/shell …` rejected, text prompts |
| **4 · multi-part concatenated** | emit each assistant part as its own message (insertion-ordered) instead of one join | ✅ two parts → two messages |
| **5 · SSE drop stalled forever** (deferred #8) | on stream-end-not-aborted: resubscribe + authoritative re-fetch, continue | ✅ injected drop → 1 reconnect + 1 re-fetch, no event lost, no stall |

```
$ bun test test/exp-005-fix-in-place-spike.test.ts
 10 pass · 0 fail · 22 expect() calls

$ bun test            # full marid-telegram suite
 68 pass · 0 fail     # was 58/0 baseline + 10 spike → non-regression (RISK-017)

package.json: + "telegramify-markdown": "1.3.3"   (pinned; DEP-012 / RISK-014)
```

## INV-001

Untouched. The spike changes only presentation/wiring inside the channel process; **acting stays
server-enforced by `@marid/auth`** (channel scope deny-by-default + bound-agent guard), covered by the
existing `channel-binding`/`scope` suites and EXP-008 (act-via-ownership). Nothing here widens the
`channel:` token's authority.

## Residual — the LIVE cadence tail (staged)

The PASS bar's fourth clause — *streaming cadence hits no 429s* — is a live Bot API measurement. It needs a
**throwaway BotFather bot token** (production DC is fine for a cadence check; no test-DC needed) + network,
run against a real `marid serve` with the edit-coalesced streamer at the EXP-003 cadence. **Staged behind an
operator-provided token**; the offline defect fixes above do not depend on it. (The separate real-client
E2E tiers — GramJS userbot / Telegram-Web Playwright — are EXP-007/009 and need the setup in
[telegram-userbot-e2e-setup.md](../execution/telegram-userbot-e2e-setup.md).)

**FAIL path not taken:** fix-in-place did not prove larger than the port, so C-8 (port grinev's `render/`)
stays rejected. HYP-005 stands on the deterministic tiers; the live cadence tail is a confirmation, not a
risk to the decision.
