---
status: Draft
version: 1.0.0
updated: 2026-07-09
owner: operator (STK-001)
---

# WhatsApp Adapter Options — Unofficial Clients (R-12)

Research track **R-12** for PH-7 (WhatsApp channel adapter, FR-047). Scope is **unofficial clients only**
(operator decision): the official Cloud API is webhook-push = needs public ingress, contradicting OQ-004, and
carries business-account/approval overhead. Because FR-047's text says "official Business/Cloud APIs", choosing
unofficial is recorded as a **Proposed, operator-gated amendment** (DEC-016) — kept separate from this
evaluation. Feeds comparison **C-9**, decision **DEC-015**, and risks **RISK-013/014**.

**Hard filter:** separate process, public HTTP+SSE API only (ADR-0005); `channel:<name>` bearer bound to one
agent; own allowlist + inbound dedup; media send/receive; streaming simulation within platform limits;
**outbound-only, no public inbound webhook** (OQ-004); additive package, MIT-compatible / license-clean.
INV-001 stays server-enforced by `@marid/auth`.

## A. Library / wrapper matrix (metadata pulled 2026-07-09)

| Option | Repo | License | Stars | Activity | Protocol | Dep weight in Marid | Bun/TS fit |
|---|---|---|---|---|---|---|---|
| **Baileys** | WhiskeySockets/Baileys | **MIT** | ~10.0k | v7.0.0-rc (2026-05); pushed 2026-07-08 | **WebSocket multi-device** (no browser) | direct dep (light, pure WS) | native TS, Bun-friendly |
| whatsapp-web.js | pedroslopez/whatsapp-web.js | Apache-2.0 | ~22.1k | v1.34.7 (2026-04); active | **Headless Chromium** (Puppeteer) | heavy (~300MB Chromium) | poor server/Bun fit |
| wppconnect | wppconnect-team/wppconnect | LGPL-3.0 | ~3.4k | v2.2.1 (2026-05); active | Headless Chromium | heavy | poor fit |
| venom-bot | vynect/venom | Apache-2.0 | ~6.6k | v5.3.0 (2024-11, stale release) | Headless Chromium | heavy | poor fit |
| **WAHA** (HTTP wrapper) | devlikeapro/waha | Apache-2.0 (Core; free since 2026.6.1) | ~7.0k | 2026.6.2 (2026-06) | wraps NOWEB(Baileys-family WS)/GOWS/WEBJS | **zero** (separate container; Marid speaks HTTP/WS) | n/a (sidecar) |
| Evolution API (HTTP wrapper) | EvolutionAPI/evolution-api | Apache-2.0 + brand addendum | ~8.9k | v2.3.7 (2025-12) | wraps Baileys | **zero** (sidecar; webhook-first) | n/a (sidecar) |

Canonical npm: **`baileys`** (v7 rc, MIT, homepage `github.com/WhiskeySockets/Baileys`); older scoped
`@whiskeysockets/baileys` publishes the same. Both are legitimate WhiskeySockets releases. Puppeteer-based
libraries (whatsapp-web.js/wppconnect/venom) drive a headless Chromium — large binary, high RAM/CPU per
session, fragile in containers, awkward under Bun → **poor fit** for a lean Bun/TS adapter. Baileys (pure WS) is
the natural stack fit; WAHA/Evolution externalize the whole client into a separate service.

## B. Feature fit (front-runners: Baileys, WAHA-NOWEB)

- **Media send + receive:** Baileys supports images/video/docs/audio/PTT/stickers via `sendMessage` and inbound
  download; WAHA exposes the same over HTTP. Per-type byte caps are WhatsApp-server-side (`unverified`).
- **Streaming simulation (critical):** Baileys **can edit a sent message** —
  `sendMessage(jid, { text, edit: sentMsg.key })` — so Telegram-style edit-coalescing is possible, BUT WhatsApp
  caps edits at ~15 min and each edit is a real protocol message → **throttle, not per-token**. Recommended:
  `sendPresenceUpdate('composing')` during generation → coalesced edits at a throttled cadence → final message
  (or chunked sends). whatsapp-web.js `Message.edit()` has open reliability issues (#3514) — less reliable.
- **Reply/quote:** supported (`{ quoted }`); WhatsApp has no true threads. **Commands:** no native slash UI;
  commands are inbound text the adapter parses (library-agnostic).
Sources: https://baileys.wiki/docs/socket/handling-messages/ · Baileys edit docs (mintlify/whiskeysockets) ·
https://github.com/pedroslopez/whatsapp-web.js/issues/3514

## C. Risk + isolation

- **(i) Ban / ToS (single low-volume operator).** All unofficial clients violate WhatsApp ToS; **any account
  can be banned at any time** (heuristic/ML enforcement, no fixed rule). Low volume + one linked device +
  human-paced, allowlist-only messaging is lower-risk but never zero; enforcement rose sharply in 2025. Fits
  Marid's single-operator/allowlist/conversational profile. **No sandbox exists.** → **RISK-013.** Sources:
  https://blog.kraya-ai.com/whatsapp-automation-ban-risk · https://whatsapp.checkleaked.cc/blog/avoid-whatsapp-ban
- **(ii) Breakage.** Unofficial libs impersonate WhatsApp Web; Meta protocol updates can break/flag old
  connections. Baileys mitigates via active maintenance (continuous v7 RCs) — inherent ongoing maintenance debt.
- **(iii) Supply-chain — the lotusbail lesson.** Dec 2025: malicious npm **`lotusbail`** (a Baileys fork, 56k+
  downloads) stole auth tokens/session keys, intercepted messages, harvested contacts, exfiltrated media, and
  backdoored accounts via device pairing (persistence survives removal). → **RISK-014.** Hardening: exact-version
  pinning (no `^`/`~`), frozen lockfile + integrity, install only verified WhiskeySockets `baileys`, block
  install scripts, consider vendoring the pinned tarball. The adapter process holds the WhatsApp session — a
  high-value target. Sources: theregister.com/2025/12/22/whatsapp_npm_package_message_steal ·
  thehackernews.com/2025/12/fake-whatsapp-api-package-on-npm-steals · bleepingcomputer.com (malicious-npm-…-whatsapp).
- **HTTP-wrapper isolation (WAHA/Evolution).** Running the WhatsApp client as a **separate containerized HTTP
  service** means `@marid/whatsapp` **never pulls Baileys/Puppeteer into Marid's dep tree** — it depends only on
  `fetch`/WS to a **pinned WAHA image digest**. A lotusbail-class compromise would live in the WAHA container,
  not Marid's `node_modules`; the trust surface becomes one auditable, network-isolatable image instead of a
  transitive npm tree. WAHA Core is fully-free Apache-2.0 since 2026.6.1; Evolution is Apache-2.0 + brand
  addendum. Neither is AGPL. Source: https://github.com/devlikeapro/waha

## D. Private-network fit (OQ-004 — outbound-only)

- **Baileys-direct:** purely outbound WebSocket to WhatsApp; no inbound port, no webhook. ✅ best OQ-004 fit.
- **Puppeteer libs:** outbound (Chromium → WhatsApp Web), no webhook, but heavy.
- **WAHA:** WhatsApp connection is outbound; WAHA→consumer events via **webhook (needs inbound port)** OR
  **WebSocket (consumer opens outbound WS to WAHA — no inbound port)**. ✅ OQ-004-compatible **only in WebSocket
  event mode**. Source: https://waha.devlike.pro/docs/how-to/events/
- **Evolution API:** webhook-first (needs inbound endpoint); has WS too. Weaker OQ-004 fit than WAHA-WS.
- Only the **official Cloud API** needs a **public** inbound webhook — which is exactly why it was excluded.

## E. Shaheen pattern portability

Shaheen ran Baileys as a **separate process over a public API** — the architecture is the ADOPT target
(matches ADR-0005). **Reusable as design pattern:** `useMultiFileAuthState` session persistence (creds out of
logs/VCS, INV-002); per-chat JID → Marid session mapping; operator allowlist + inbound `messages.upsert` dedup;
outbound-only connection. **Must be rebuilt for Marid's contract:** `channel:<name>` bearer-token auth +
rate-limit + audit via `@marid/auth`; `session.create`+`promptAsync {agent,parts}` + permission replies via
`POST /session/:id/permissions/:pid`; streaming-sim mapping SSE → presence/edit-coalescing; **no client-side
policy** (INV-001 is enforced server-side — the adapter only carries the channel token). "ADOPT architecture,
DEFER Baileys-specifically" holds: the pattern is portable, the library choice is the open question below.

## F. Recommendation (ranked)

1. **Baileys-behind-WAHA (NOWEB engine), consumed over WebSocket — front-runner for supply-chain
   minimization.** `@marid/whatsapp` depends on nothing WhatsApp-specific (just `fetch`/WS to a pinned WAHA
   container), so a lotusbail-class npm compromise can't reach Marid's dep tree; WAHA Core is free Apache-2.0;
   NOWEB = no Chromium; outbound-only via WAHA's WebSocket event mode. Trade-off: one extra container + one more
   trust anchor (image digest) — acceptable on a private single-operator host. Best answer to the explicit
   "minimal-supply-chain-exposure" requirement.
2. **Baileys-direct (pinned `baileys`, MIT) — front-runner for stack-fit & simplicity.** Best OQ-004 fit (pure
   outbound WS, zero relay), native TS/Bun, richest edit/presence for streaming-sim, most active repo. Cost:
   Baileys in Marid's dep tree ⇒ strict supply-chain hardening (RISK-014). Choose if you'd rather own one
   hardened dep than run a sidecar.
3. **Evolution API** — viable HTTP-wrapper alt, but webhook-first event model is a weaker OQ-004 fit than
   WAHA-WS, and it wraps Baileys anyway.
4. **whatsapp-web.js / wppconnect / venom (Puppeteer)** — not recommended: Chromium footprint wrong for a lean
   Bun server; whatsapp-web.js edit support buggy; venom's last tagged release is 2024; wppconnect LGPL-3.0.

**Key trade-off:** *Baileys-direct* = smallest architecture, best OQ-004/streaming fit, but Baileys lives in
Marid's dep tree (supply-chain exposure to actively harden). *Baileys-behind-WAHA* = one extra sidecar, but
Marid's package stays WhatsApp-dependency-free and license-clean — the strongest answer to lotusbail and the
"minimal-supply-chain-exposure" goal. **WAHA-NOWEB-over-WebSocket edges ahead as primary; Baileys-direct
(hardened) is the documented alternative.** Confirmed by EXP-006 (reproducible fake-WA integration at PH-7
start; real-number live probe later in PH-7). **Constant across all options:** ban risk is real and unpredictable — use a dedicated
linked-device number, allowlist-only, throttled/human-paced messaging, and treat account loss as an expected
operational event.

## Unverified / flagged
- Exact per-media-type byte limits are WhatsApp-server-side, not library-documented — `unverified`.
- "2–8 week ban timeline" / "68% hit ≥1 ban" figures come from a vendor blog citing Meta's 2025 enforcement
  report; directionally consistent across sources but the underlying report was not independently retrieved —
  **indicative, not authoritative**.
- Shaheen internals taken from the R-07 analysis (`shaheen-analysis.md`), not re-fetched here.

## Sources
Repo/npm metadata via `gh`/npm registry (2026-07-09). Baileys https://github.com/WhiskeySockets/Baileys ;
whatsapp-web.js https://github.com/pedroslopez/whatsapp-web.js ; wppconnect https://github.com/wppconnect-team/wppconnect ;
venom https://github.com/vynect/venom ; WAHA https://github.com/devlikeapro/waha (+ events docs) ; Evolution
https://github.com/EvolutionAPI/evolution-api . lotusbail: The Register / The Hacker News / BleepingComputer /
koi.ai (Dec 2025). Ban-risk: kraya-ai, whatsapp.checkleaked. Baileys edit/presence: baileys.wiki.
