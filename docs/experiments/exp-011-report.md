---
experiment: EXP-011
hypothesis: HYP-011
status: PASS
version: v1.0
updated: 2026-07-17
owner: operator (STK-001)
---

# EXP-011 — fake-WA at the WAHA WebSocket+HTTP boundary is a deterministic PR gate

**Verdict: PASS. HYP-011 confirmed.** A fake at the WAHA WebSocket+HTTP boundary gives a **deterministic,
hermetic, PR-gating** integration test for the WhatsApp adapter — round-trip, media, streaming-sim,
attach/mirror, and token-permission — with **no accounts and no ban risk**. This is the blocking
`marid-whatsapp` gate (TEST-WA, [AC-023](../validation/acceptance-criteria.md)); it closes
[AC-018](../validation/acceptance-criteria.md) and [AC-022](../validation/acceptance-criteria.md) live and
realizes [ADR-0014](../adrs/adr-0014-whatsapp-test-strategy.md) tier 2.

Validates [HYP-011](../research/hypothesis-register.md): *A fake at the WAHA WebSocket boundary gives a
deterministic, hermetic PR-gating integration test for the WhatsApp adapter (round-trip, media,
streaming-sim, attach/mirror, token-permission) with no accounts/ban risk.*

## Result in one line

`packages/opencode/test/marid/whatsapp.test.ts` boots a **real** `marid serve` (fake LLM) + a **local fake
WAHA** (`Bun.serve` — HTTP for outbound, WebSocket for inbound injection) whose outbound bodies are
validated against the **GATE-0 OpenAPI fixture**, and asserts the full WhatsApp round trip deterministically
— 3 live tests green in ~63s across 3 OSes, no WhatsApp account, no live model.

## The boundary (why WS-only would have been wrong)

Per R-12 §D, WAHA is **HTTP-out / WS-in**: events arrive over the WebSocket, sends go over HTTP REST. A
WS-only fake would capture **no** outbound `sendText`/media — the exact thing the gate must observe (the W3
fix from the plan). So `fakeWaha()` implements both:

- **HTTP routes** capture + validate outbound: `sendText`, `sendImage`/`sendFile`, `editMessage` (PUT),
  `presence`, `/api/version`, inbound-media download.
- **WS upgrade** injects inbound `message` frames (`deliverMessage`, `deliverMedia`).

The fake sits **at the transport boundary, not above the narrow interface** — so the real `waha.ts` frame
parsing and HTTP body serialization are exercised, and INV-001 is asserted at **real-request level**
(RISK-025: the PH-6 Telegram firehose leak was invisible to function-level tests).

## Anti-fiction: the fake is pinned to the recorded contract

The W2 risk — "the fake encodes a contract I assumed" — is closed by validating every outbound body against
the recorded WAHA OpenAPI fixture's `required` field set (`assertRequired`). If the real WAHA contract
drifts from the fixture, the gate **fails** rather than passing a fiction. The fake stops being fiction
because it is checked against a recorded real contract (a digest-scoped TEST-CONTRACT, the same pin pattern
the repo uses for upstream).

## Coverage (all GREEN, 3-OS)

| Test | Asserts | AC |
|---|---|---|
| stranger ignored + streamed reply | non-allowlisted JID → **zero** outbound (INV-001); operator question → streamed `sendText`/`editText`; `presence("typing")` during generation | [AC-018](../validation/acceptance-criteria.md) |
| inbound media | an `image/png` frame downloaded through real `waha.ts` → lands as a session file part | [AC-018](../validation/acceptance-criteria.md) |
| token permission | a live `bash` tool call (gated `ask`) surfaces `APPROVE <token>`; redeeming the exact 8-hex token acks + authorizes (act-via-ownership) | [AC-022](../validation/acceptance-criteria.md) |

Attach/mirror is **inherited** from ADR-0012 (`@marid/channel-client`, proven live at MS-007) — reused, not
re-proven (the AC-019 evidence is PH-6's).

## Determinism controls

- Injected `now`/`sleep`/`timers` and `cadenceMs:0` make streaming observable within the window without
  wall-clock coupling.
- Bespoke `waitFor` scales by `OPENCODE_TIMING_SCALE` (P-CI-4) — cold Windows CI gets ×4, so a legitimate
  ~32s cold first-boot isn't a flake, but a real hang still fails well under the 300s outer timeout.
- No secrets, no container: macOS/Windows runners can't host a Linux WAHA container, and by design tier 2
  is fully in-process (the fake IS the WAHA).

## Decision impact

TEST-WA is the **deterministic blocking PR gate** for `@marid/whatsapp` (the 3-OS `marid-whatsapp` CI job,
`MARID_WHATSAPP=1`). The live burner probe ([EXP-012](exp-012-runbook.md)) and native render check
([EXP-013](exp-013-runbook.md)) are **manual, off-CI, never gating** — MS-008 exits on the deterministic
tier alone (ADR-0014).

## Residual

The gate proves the **contract shape and the wiring**, not WhatsApp's real-world edit window / rate limits
/ ban behaviour — those are the manual EXP-012/013 tiers, accepted as never-gating (RISK-013/022).

## Run

```
cd packages/marid-whatsapp && bun test                                   # 139 unit (in-package tier)
cd packages/opencode && MARID_WHATSAPP=1 bun test test/marid/whatsapp.test.ts --timeout 300000   # 3 live (~63s)
```

INV-002: no channel token / WAHA api-key / LLM key is printed by the harness.
