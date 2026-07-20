---
artifact: channel-live-test-scenarios
status: Draft
version: 0.1.0
updated: 2026-07-20
owner: operator (STK-001)
---

# Channel Live-Test Scenarios — Telegram · WhatsApp

Hands-on live/E2E scenario matrix for the channel gateways ([marid-telegram](../architecture/architecture.md),
[marid-whatsapp](../architecture/architecture.md)), complementing the deterministic CI gates (Telegram fake
bot-API / WhatsApp `fakeWaha`, see [test-strategy](test-strategy.md)). **Live-only** behaviours — real
`@lid` identifiers, real reasoning-model multi-part output, real-client rendering — that the fakes cannot
reproduce are captured here. Local `#` ids, **no governed prefix**. Status: `Done` / `Todo` / `Gap`
(capability not implemented) / `N/A`.

Motivation: the WhatsApp burner live run ([EXP-012](../experiments/exp-012-runbook.md), 2026-07-20) surfaced
three defects the deterministic tier can't ( §B). This doc turns that into a durable, **channel-symmetric**
backlog so the same enriched scenarios run on Telegram too.

## A. Capability cross-reference (what each adapter implements)

| Capability | Telegram | WhatsApp | Note |
|---|---|---|---|
| Send text | ✅ | ✅ | |
| Streaming reply | ✅ `editMessageText` (in-place edits) | ⚠️ `editText` exists but multi-part model → duplicate sends (§B #2) | |
| Outbound image | ✅ `sendPhoto` | ✅ `sendMedia`→`/api/sendImage` | WA path never exercised live |
| Outbound file/document | ✅ `sendDocument` | ✅ `sendMedia`→`/api/sendFile` | WA path never exercised live |
| **Delete a sent message** | ✅ `deleteMessage` | ❌ **not implemented** | WA `WhatsAppClient` has no delete; WAHA offers it (12/136 paths used) |
| Inline approval | ✅ Approve/Deny **keyboard** | ✅ `APPROVE <token>` **text** (ADR-0015) | intentionally different UX |
| Markdown → channel format | ✅ `telegramify-markdown` | ❌ **passthrough** (§B #3) | |
| Long-message split | ✅ `TELEGRAM_TEXT_LIMIT` | ❌ none (single message; WAHA errors >~65k) | ponytail ceiling (stream.ts) |
| Inbound media → file part | ✅ | ✅ `downloadMedia` (§B #3 media-in proven live) | |
| Presence/typing | ✅ | ✅ `typing`/`paused` | |
| Allow-list identity | numeric user-id | phone-JID `@c.us` — **misses `@lid`** (§B #1) | |

## B. WhatsApp live session — [EXP-012](../experiments/exp-012-runbook.md), real burner, 2026-07-20

Driven end-to-end via WhatsApp Web (real operator number) + Playwright + gateway/WAHA logs.

| # | Scenario | Verdict | Evidence |
|---|---|---|---|
| B1 | Text round-trip (typing → streamed reply) | ⚠️ works, **duplicated** | reply delivered; agent identity = Marid (P-8); but 3× identical (finding #2) |
| B2 | Slash `/help`, `/new` | ✅ Done | single clean replies (command list / "Started a new session.") |
| B3 | Inbound image → file part | ✅ Done (transport) | gateway `attached 1 inbound file part`; model non-vision so can't read it |
| B4 | Tool-gated approval (`APPROVE <token>`) | ✅ Done | `APPROVE 32ba3ad9` → `Approved.` → bash output returned ([AC-022](acceptance-criteria.md) live) |
| B5 | INV-001 non-allow-listed → zero reply | ✅ Done | real `@lid` sender rejected: `ignored message from non-allowlisted …@lid` |
| B6 | Markdown render (bold/italic/code) | ⚠️ partial | inline code OK; **bold/italic garbled** (finding #3) |

**Findings (live-only):**
- **F1 — LID allow-list gap.** Modern WhatsApp delivers inbound with a `@lid` sender id, not the `@c.us`
  phone-JID. The allow-list matches `@c.us` and does not resolve LID↔number, so the operator's own messages
  are denied until the `@lid` is allow-listed. (Deterministic AC-023 fake uses `@c.us` → invisible to it.)
- **F2 — Duplicate streamed replies.** The shared per-part streamer sends **one WhatsApp message per
  assistant part**; a multi-part / reasoning model (GLM-5.2) triples the reply. Coalesce parts, or suppress
  reasoning parts on the channel.
- **F3 — No Markdown→WhatsApp conversion.** Agent text is passed through, so `**bold**`/`_italic_` render
  wrong (WhatsApp wants `*bold*`/`_italic_`). Needs a converter, the WhatsApp analogue of `telegramify-markdown`.

### B.1 Extended live run (2026-07-20, same burner, `gpt-4o-mini`) — enriched-scenario results

Driven via WhatsApp Web + Playwright + gateway/WAHA logs. Model switched GLM-5.2 → **gpt-4o-mini** (fast,
non-reasoning, multimodal) — which **eliminated F2** (replies now single messages), confirming F2 is the
reasoning-model multi-part interaction, not a per-message bug.

| Ref | Scenario | Verdict | Evidence |
|---|---|---|---|
| C5 | Long reply | ✅ Done | 10-item list = one message, no split |
| C3 | Edit-in-place stream | ⚠️ not exercised | fast model finished inside the 2.5 s cadence → 1 `sendText`, 0 edits (correct, but `editText` path unproven; needs a slow stream) |
| C6 | Presence lifecycle | ✅ Done | `typing`/`paused` present in WAHA logs each reply |
| C8 | Inbound **document** (.txt) | ✅ Done | gateway `attached 1 inbound file part` |
| C12 | Rapid concurrency | ✅ Done | ALPHA/BRAVO/CHARLIE → one ordered reply each, no cross-talk |
| C13 | DENY | ✅ Done | `DENY` → "Denied.", tool not run |
| C14 | Reused token | ✅ Done | reused `APPROVE` → no reply (single-use) |
| C15 | Expired TTL | ✅ Done | 15 s TTL, approve after expiry → no reply, tool not run |
| C16 | Wrong token / "yes" | ✅ Done | both ignored, tool not run |
| C21 | Reconnect recovery | ✅ Done | WAHA container restart → `websocket down, reconnecting` → `connected`; session survived (`WORKING`) |
| C23 | **Arabic round-trip** (RTL) | ✅ Done | Arabic in → fluent single-message Arabic reply, correct RTL |
| C1/C2 | Outbound image/file | ⚠️ Gap-in-practice | `sendMedia` exists but **no agent-facing trigger**; agent: "I can't send images…" |
| C4 | Delete a message | ❌ Gap | not implemented; agent: "…or delete messages" |
| C7 | Markdown fidelity | ⚠️ Partial | = F3 (bold/italic wrong, inline code OK) |
| C10 | Inbound reaction | 🚫 Not received | transport subscribes `["message","session.status"]` only; reactions dropped (code-confirmed) — **directly relevant to the approval-UX redesign** |
| C11 | Inbound reply/quote context | 🚫 Dropped | `InboundMessage` has no quoted field; a quoted reply reaches the agent **without** the quote — this is the exact adapter work the reply-quote approval design needs |
| C9 | Inbound audio/voice | ⛔ Attempted → blocked | WhatsApp-Web *Audio* preview won't submit via Playwright + real PTT needs a mic; arbitrary-file transport already proven (C8), audio/PTT-specific path unverified |
| C17 | Wrong-JID approver | ⛔ Attempted → blocked | only one number available live; cross-JID rejection is deterministically covered by the fake approval matrix ([AC-022](acceptance-criteria.md)) |
| C18 | LID-aware allow-list | — | not a test — it's the **F1 fix** |
| C19/C20 | Attach / mirroring | ✅ Done (via API) | pre-attach client sees **0** sessions (isolation); admin `/marid/attach` → `{attached:true}` + binding recorded (view-via-binding); non-admin self-attach → **403** (act-via-ownership, INV-001) |
| C22 | Real-client render assertion | ✅ Done (ad-hoc) | Playwright DOM asserted throughout (`<strong>`/`<em>`/`<code>`); formalize as a tier |

**New finding F4 (design):** the `APPROVE <token>` UX is secure but unfriendly. Recommended successor —
**reply-quote "yes"/"no" to the prompt** (binding via the quoted message-id; keep single-use/TTL/JID-bound
server-side; token retained as fallback); reactions/polls rejected/deferred (transport doesn't deliver those
events live); **authorization stays server-side — the LLM must never decide approval (INV-004)**. This
amends ADR-0015 → **recorded as [ADR-0021](../adrs/adr-0021-whatsapp-reply-quote-approval.md) (Approved
2026-07-20, operator-confirmed)**; implementation deferred to a TDD/PR cycle, not a hot-patch. (C10/C11 above
quantify the adapter work: reply-quote needs `contextInfo`/`reply_to` surfaced on `InboundMessage`.) The parked
"non-approval message during a pending approval" question is tracked as
[deferred-work #13](../execution/deferred-work-register.md).

## C. Enriched scenarios — TO DO on **both** channels

Run each against a real client (WhatsApp burner + WhatsApp Web/Playwright; Telegram bot + a real
account/userbot), asserting the rendered client DOM and the gateway/WAHA/bot-API logs.

### C.1 Outbound-rich (agent → user)
| # | Scenario | Telegram | WhatsApp | Blocked-by / note |
|---|---|---|---|---|
| C1 | Agent **sends an image** (tool/skill emits an image file part) → arrives as a photo | Todo | Todo | both implemented; never live-tested |
| C2 | Agent **sends a document/file** (non-image part, with filename) → arrives as a document | Todo | Todo | both implemented; never live-tested |
| C3 | Agent **edits a message in place** while streaming (one message, growing) | Todo | Todo (also fixes F2) | verify `editText`/`editMessageText`, one edit per cadence window |
| C4 | Agent **deletes / revokes** a sent message | Todo | **Gap** | WhatsApp adapter has no delete — add `deleteMessage` first, else N/A |
| C5 | **Long reply** beyond one message | Todo (split) | Todo | TG asserts split; WA asserts single msg / graceful WAHA error (no split by design) |
| C6 | Streaming **presence lifecycle** (typing during gen → paused at end) + edit cadence | Todo | Todo | assert no per-token hammering (ban surface, RISK-013) |
| C7 | Markdown fidelity: bold/italic/code/lists/links/quote render correctly | Todo | Todo (blocked by F3) | WA needs a markdown→`*_~` converter |

### C.2 Inbound-rich (user → agent)
| # | Scenario | Telegram | WhatsApp | Note |
|---|---|---|---|---|
| C8 | Inbound **document/file** (non-image) → lands as file part with filename | Todo | Todo | |
| C9 | Inbound **audio / voice note** → handled (transcribe or explicit drop) | Todo | Todo | define expected behaviour first |
| C10 | Inbound **reaction** to a message → ignored or routed (deny-by-default) | Todo | Todo | confirm not treated as a prompt (INV-004) |
| C11 | Inbound **reply/quote** to a prior message → context carried | Todo | Todo | |
| C12 | **Rapid multiple** inbound messages → serialized on one session, no dupes/races | Todo | Todo | Runner/`SynchronizedRef` (EXP-001) at the channel level |

### C.3 Approval / security (strict parser, ADR-0015)
| # | Scenario | Telegram | WhatsApp | Note |
|---|---|---|---|---|
| C13 | `DENY <token>` → tool does **not** run | Todo | Todo | |
| C14 | **Reused/spent** token → rejected (single-use) | Todo | Todo | |
| C15 | **Expired** token (TTL) → rejected | Todo | Todo | `MARID_WA_APPROVAL_TTL_MS` / TG timeout |
| C16 | Wrong token / bare "yes"/"1" → rejected (injection defense, INV-004) | Todo | Todo | |
| C17 | Approval from a **different allow-listed** JID/user (not the asker) → rejected (JID/user-bound) | Todo | Todo | act-via-ownership |

### C.4 Identity, allow-list, mirroring
| # | Scenario | Telegram | WhatsApp | Note |
|---|---|---|---|---|
| C18 | **LID-aware** allow-list / LID↔number resolution (fixes F1) | N/A | Todo | WhatsApp-specific |
| C19 | **Attach** channel session to web/TUI → view-via-binding; act-via-ownership deny | Todo | Todo | live [AC-019](acceptance-criteria.md) parity for WA |
| C20 | Web/TUI turn on a **bound** session mirrors to the channel | Todo | Todo | |
| C21 | SSE/WS **drop → reconnect + re-fetch** recovery mid-turn | Todo | Todo | `@marid/channel-client` reconnect, live |
| C22 | Real-client **render assertion** (Playwright DOM: `<strong>`/`<em>`/`<code>`/`<img>`) | ✅ TG [AC-021](acceptance-criteria.md) | Todo | formalize the WhatsApp-Web Playwright tier used ad-hoc in EXP-012 |

## D. How to run (both channels)
- **Telegram:** real bot + a second real account or GramJS userbot (see the userbot/web tiers behind
  [AC-020](acceptance-criteria.md)/[AC-021](acceptance-criteria.md)); non-gating, off-CI.
- **WhatsApp:** WAHA-NOWEB burner ([EXP-012](../experiments/exp-012-runbook.md)) + WhatsApp Web driven by
  Playwright; **pair via phone-number code, not QR** (NOWEB QR pair-budget is ~60–90s and flaky — the code
  flow is timing-forgiving). Ban-exposed, never a gate ([ADR-0014](../adrs/adr-0014-whatsapp-test-strategy.md) tier 3/4).
- Assert on **both** the rendered client DOM and the gateway/WAHA/bot-API logs; treat every inbound as
  untrusted (INV-004).
