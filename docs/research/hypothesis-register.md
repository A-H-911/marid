---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
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
| HYP-005 | Fixing the five Telegram UX defects in place (one md library + wiring the existing seams) resolves them with fewer changes than a grinev fork, while INV-001 stays server-enforced — no gateway rewrite needed | EXP-005 | DEC-014 / ADR-0009 confirmation; supersede of ADR-0008 |
| HYP-006 | An unofficial WhatsApp client isolated behind a pinned HTTP wrapper (WAHA-WS) or hardened Baileys-direct gives an outbound-only, INV-001-preserving adapter with acceptable media/streaming, no public ingress | EXP-006 | DEC-015 / ADR-0010 client choice |
| HYP-007 | A GramJS userbot on the Telegram test DC drives the bot end-to-end (text/files/slash/inline-keyboard) deterministically enough for automated local + on-demand CI runs | EXP-007 | ADR-0013 tier 2 / AC-020 |
| HYP-008 | Full bidirectional mirroring is achievable **additively** (session↔surface binding registry + binding-aware `isVisible` filter + channel-client) with **no upstream edit**, INV-001 held (view-via-binding, act-via-ownership) across permission-surfacing + concurrency | EXP-008 | ADR-0011/0012; RISK-019; AC-019 |
| HYP-009 | Telegram Web + Playwright headlessly validates rendered Markdown/media on the test DC, stable enough for local + on-demand use | EXP-009 | ADR-0013 tier 3 / AC-021 |
| HYP-010 | mobilewright/mobile-mcp drives the native Telegram Android app repeatably enough for an occasional manual real-device check | EXP-010 | ADR-0013 tier 4 |
| HYP-011 | A fake at the WAHA WebSocket boundary gives a deterministic, hermetic PR-gating integration test for the WhatsApp adapter (round-trip, media, streaming-sim, attach/mirror, token-permission) with no accounts/ban risk | EXP-011 | ADR-0014 tier 2 / AC-023 |
| HYP-012 | A second-account burner probe can smoke-test the real WhatsApp protocol off-CI without an unacceptable per-run ban rate for an inbound-only responder bot | EXP-012 | ADR-0014 tier 3 |
| HYP-013 | mobilewright drives the native WhatsApp Android app repeatably enough for an occasional manual render check (incl. whether an optional list message actually displays) | EXP-013 | ADR-0014 tier 4 |

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

### EXP-005 — Telegram fix-in-place spike · timebox 1 day · runs at PH-6 start
Setup: apply the R-11 fix-in-place changes to `packages/marid-telegram` (add `telegramify-markdown`; switch
`parse_mode`→MarkdownV2; wire `resolveDownloadUrl`→`FilePartInput`; slash routing; multipart separation; pump
reconnect + authoritative re-fetch) as a spike; run against the existing fake-Telegram TEST-TG harness plus a
throwaway bot token + a real `marid serve`.
**PASS:** the four UX defects fixed (Markdown rendered, media landed into the workspace, slash routed, multi-part
separated) **and** the pump survives an injected SSE drop (reconnect + re-fetch, no permanent stall) **and**
INV-001 holds (stranger ignored; channel token cannot change agent or widen tools) **and** streaming cadence
hits no 429s. **FAIL:** enumerate the residual defect; if fix-in-place proves larger than the port, re-open C-8
(port grinev's `render/` modules).

### EXP-006 — WhatsApp adapter integration spike · timebox 1–2 days · runs at PH-7 start (fake-WA first, then real-number live)
Setup: stand up the C-9 front-runner (WAHA-NOWEB over WebSocket, or hardened Baileys-direct) as `@marid/whatsapp`
against a **local fake WhatsApp server** (mirrors the TEST-TG fake-server pattern) + a real `marid serve` with a
`channel:` token. Reproducible, zero ban risk. (The real-number live round-trip is a separate PH-7-start probe.)
**PASS:** end-to-end round-trip works; INV-001 held via the channel token (stranger ignored; bound agent; no
tool/permission widening); the connection is **outbound-only** (no inbound webhook/port — OQ-004); media
send/receive + throttled streaming-sim shape are correct; deps pinned + provenance-checked (RISK-014).
**FAIL:** enumerate the gap; if the primary (WAHA) can't satisfy outbound-only or INV-001 wiring, fall back to
the documented Baileys-direct alternative and re-score C-9.

### EXP-007 — GramJS userbot test-DC spike · timebox 1 day · runs at PH-6 start
Setup: register a **test-DC bot** (BotFather on the test DC), point `marid-telegram` at the **`/test` Bot-API
mode**, run a GramJS userbot (`telegram` npm) on the test DC (synthetic `+99966XYYYY` number, fixed login code)
→ `/start` → assert reply → tap an inline button → send + receive a file. Run on Node if GramJS is Bun-incompat.
**PASS:** a deterministic real-protocol round-trip (text + file + slash + inline-keyboard) runnable locally and
on-demand in CI. **FAIL:** if test-DC login (`PHONE_CODE_INVALID`) or the `/test` bot proves intractable, keep the
fake-server E2E as the sole deterministic tier and document the userbot as best-effort; consider GramJS-prod on a
throwaway account (ban-risk noted).

### EXP-008 — Cross-client mirroring + cross-surface permission/concurrency spike · timebox 2 days · runs at PH-6 start
Setup: attach a Telegram chat to a Web/API-started session (docking); drive turns from both surfaces; trigger a
tool permission; run simultaneous prompts. Instrument the `event-filter` binding-aware `isVisible` path.
**PASS:** the attached session mirrors **bidirectionally** (web/TUI turns appear in the chat and vice-versa);
the permission inline-keyboard surfaces across bound surfaces (first-responder-wins, no double-approve);
**view-via-binding / act-via-ownership holds** (a channel cannot approve a permission for a session it does not
own); join/steer concurrency spans channels with no corruption; **INV-001 held; the whole thing is additive (no
upstream edit)**. **FAIL:** enumerate the exact upstream edit required and weigh it as a single `P-*` vs NFR-001;
confirm the mid-stream-binding-needs-reconnect handling. Also **verify blast-radius isolation (RISK-024/AC-024):** a plain (unattached) TUI/Web request path is unchanged, and a fault injected into the mirroring/registry module **degrades to non-mirrored behavior without breaking auth or a plain client**.

### EXP-009 — Telegram Web + Playwright rendering spike · timebox 0.5 day · runs at PH-6 start
Setup: headless Playwright on `web.telegram.org/?test=1`, log in via the test-DC account, send a prompt to the
bot, assert the **rendered** Markdown (bold/code) + a media message display correctly.
**PASS:** automatable + stable enough (bounded retry) for the local-pre-PR + GitHub-on-demand tier. **FAIL:**
selector/session fragility unmanageable → downgrade to manual visual QA; userbot (EXP-007) remains the automated
real-client tier.

### EXP-010 — Native mobile-app automation spike · timebox 1–2 days · manual/occasional (NOT a gate)
Setup: mobilewright/mobile-mcp drives the **Telegram Android app** in an emulator (or wired device), logged into a
test account; send a message, receive a reply, tap an inline button, send/receive a file, read output via the
a11y tree.
**PASS:** repeatable enough for an **occasional manual** real-device check; document the emulator/device setup +
the persisted-login secret. **FAIL/too-brittle:** record as manual visual QA only; the userbot + Web-Playwright
tiers remain the automated real-client coverage (RISK-020).

### EXP-011 — WhatsApp fake-WA-boundary gate spike · timebox 1–2 days · runs at PH-7 start
Setup: build a small **fake at the WAHA WebSocket boundary**; wire `@marid/whatsapp` (behind its narrow interface)
to it; inject synthetic inbound message events; capture outbound `sendText`/media calls; exercise attach/mirror
(ADR-0012) + the token-bound text-permission parse (ADR-0015).
**PASS:** deterministic + hermetic (no accounts, no ban) round-trip + media + streaming-sim shape + attach/mirror +
strict `APPROVE <token>`/`DENY <token>` parse (wrong-token / wrong-JID / expired all rejected). **FAIL:** enumerate
what the WAHA boundary can't faithfully fake; widen the narrow interface or add a Baileys-binary-node fake.

### EXP-012 — WhatsApp burner real-protocol probe · manual/nightly, NOT a gate
Setup: a second Baileys/WAHA session on a **burner number** pings the bot; assert a real reply.
**PASS:** real round-trip works off-CI; document the ban exposure (accept losing the number). **FAIL/ban:** rely on
the fake-WA gate (EXP-011) + native render check; record the limitation.

### EXP-013 — WhatsApp native-app render spike · manual/occasional (NOT a gate)
Setup: mobilewright/mobile-mcp drives the **WhatsApp Android app** in an emulator; send/receive a message + media;
confirm rendering (incl. whether an optional WAHA-Plus list message actually displays as tappable UI).
**PASS:** repeatable enough for occasional manual render QA. **FAIL/too-brittle:** manual visual QA only (RISK-020).
