---
experiment: EXP-006
hypothesis: HYP-006
status: PASS (WAHA-NOWEB path; Baileys-direct documented-not-built, GATE-0 STOP did not fire)
version: v1.0
updated: 2026-07-17
owner: operator (STK-001)
---

# EXP-006 — WhatsApp client choice: WAHA-NOWEB behind a pinned wrapper, outbound-only

**Verdict: PASS. HYP-006 confirmed.** An unofficial WhatsApp client isolated behind a pinned HTTP+WS
wrapper (WAHA, NOWEB engine, Core tier) gives an **outbound-only, INV-001-preserving** adapter with
working media and streaming-simulation, and **no public ingress**. The two decision-critical unknowns
(U1 capability set · outbound-only mechanism) are answered on the wire, not asserted. The documented
FAIL path (re-score C-9 → hardened Baileys-direct) was **not** triggered, so `@marid/whatsapp` ships
WAHA-only with **zero WhatsApp npm dependency**; Baileys-direct stays documented-not-built (DEC-015).

Validates [HYP-006](../research/hypothesis-register.md): *An unofficial WhatsApp client isolated behind a
pinned HTTP wrapper (WAHA-WS) or hardened Baileys-direct gives an outbound-only, INV-001-preserving
adapter with acceptable media/streaming, no public ingress.*

The experiment is in **two parts**, matching the plan's split of ADR-0010's EXP-006: **Part 1 (GATE-0)**
front-loads the capability pin — answerable with no WhatsApp number, STOP-on-fail; **Part 2** proves the
wiring (INV-001 at real-request level, outbound-only, media/streaming shape) once the client exists.

## Result in one line

WAHA `2026.7.1` / NOWEB / Core exposes every capability WBS-7.2/7.3 needs — WS event mode, `sendText`,
media send + receive, `editMessage`, `presence` — so the narrow `WhatsAppClient` interface is buildable on
the **free** tier; and the real transport (`packages/marid-whatsapp/src/waha.ts`) opens **no listening
socket** — both directions are outbound connections from Marid — proven by a source-guard test and by the
live tier dialling the WAHA WebSocket **out**.

## Part 1 — GATE-0 capability pin (no code; STOP-on-fail)

Target image (operator-run on the private network regardless):

```
devlikeapro/waha:noweb-2026.7.1@sha256:8717e9a689b723d0782aae9340dbf3d1234c9c6cd53c873382f921a5f466c119
```

The image's OpenAPI slice is committed as a fixture —
`packages/opencode/test/marid/fixtures/waha-openapi.json` — and the engine/tier are read from
`/api/version` (`{version:"2026.7.1", engine:"NOWEB", tier:"CORE"}`). Each U1 capability is PASS on
Core + NOWEB:

| Capability | Route / shape (pinned fixture) | Core + NOWEB | Verdict |
|---|---|---|---|
| WS event mode (the sole OQ-004-compatible mode) | `GET /ws?session=&events=message,session.status` | yes | **PASS** |
| Send text | `POST /api/sendText` — `MessageTextRequest {chatId,text,session}` | yes | **PASS** |
| Media send | `POST /api/sendImage` \| `/api/sendFile` — `BinaryFile {mimetype, data (base64)}` | yes | **PASS** |
| Media receive | inbound `message` frame `hasMedia:true` + host-served bytes | yes | **PASS** |
| Edit message | `PUT /api/{session}/chats/{chatId}/messages/{messageId}` — `EditMessageRequest {text}` | yes | **PASS** |
| Presence | `POST /api/{session}/presence` — `WAHASessionPresence {chatId?,presence}` | yes | **PASS** |

**STOP condition (any capability Plus-only or NOWEB-unsupported → do not build the WAHA client):** did
**not** fire. All six are Core + NOWEB. WAHA's Core/Plus split still exists (ADR-0015: message *listing*
is Plus) but none of it gates WBS-7.2/7.3.

## Part 2 — wiring (INV-001 real-request · outbound-only · media/streaming shape)

Proven live by the deterministic fake-WA gate (see [EXP-011](exp-011-report.md), TEST-WA), which drives a
real `marid serve` + fake LLM + a local fake WAHA (`Bun.serve` HTTP-out / WS-in) whose outbound bodies are
validated against the GATE-0 fixture:

| Property | Evidence | Verdict |
|---|---|---|
| **INV-001 at real-request level** | a real inbound `message` frame from a non-allowlisted JID (`999999@c.us`) produces **zero** outbound `sendText` — asserted on the wire, not function-level (RISK-025) | **PASS** |
| **Outbound-only** | (a) config rejects WAHA webhook mode — WS event mode only (R-12 §D); (b) source-guard test: `src/**` contains no `Bun.serve`/`createServer`/`.listen(`; (c) the live tier observes Marid **dialling the WAHA WS out** (`socketCount > 0`), no inbound port | **PASS** |
| **Media (shape)** | inbound `image/png` frame is downloaded through the real `waha.ts` transport and lands as a session file part | **PASS** |
| **Streaming-sim (shape)** | `presence("typing")` is signalled during generation; progressive `editText` coalescing observed | **PASS** |
| **Deps** | Bun ships `fetch` + `WebSocket` → **no WhatsApp npm dependency**; the only supply-chain surface is the WAHA container, pinned by **digest** (repo's first — [DEP-013](../requirements/dependency-register.md), RISK-014) | **PASS** |

## Decision impact

- ADR-0010 primary (WAHA-NOWEB-WS) is confirmed buildable on the **free** Core tier → `@marid/whatsapp`
  ships WAHA-only. Baileys-direct is the **documented, unbuilt** fallback (DEC-015); GATE-0 not firing
  means it is never needed. No new `P-*` (additive separate-process client).
- [DEP-013](../requirements/dependency-register.md) verdict: WAHA image digest-pinned; **no npm WhatsApp
  dependency**; Baileys carried as reference-only.

## Residual

- WhatsApp's real ~15-min edit window and live rate behaviour are **not** covered here — they are the
  burner-only [EXP-012](exp-012-runbook.md) (manual, never a gate; ADR-0014 tier 3).
- The pinned fixture is a **slice** of the WAHA OpenAPI (the routes the client uses). A WAHA image bump is
  a deliberate re-pin (new digest + fixture refresh), not an automatic follow.

## Next

WBS-7.6 docs land the digest as the DEP-013 trust anchor and the WAHA sidecar as a deployment unit in
`architecture.md`. Contract drift is caught by the gate (the fake validates against the fixture), so a
silent WAHA behaviour change fails TEST-WA rather than reaching a live account.
