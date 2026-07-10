---
id: ADR-0010
status: Approved
version: 1.0.0
updated: 2026-07-09
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0010 — WhatsApp adapter: unofficial client, isolated behind an HTTP wrapper

**Status:** **Approved (2026-07-10 operator PH-7 gate; DEC-016 FR-047 amendment approved; EXP-006/011 validate at build)** · relates to
FR-045, FR-047, FR-048, FR-049, FR-050, FR-051, FR-052, INV-001, INV-002, CON-006, OQ-003, OQ-004, NFR-001,
NFR-005, DEC-015, DEC-016, RISK-013, RISK-014, ADR-0005, [C-9](../architecture/technology-comparison.md),
[R-12 findings](../research/findings/whatsapp-options.md).

**Context.** FR-047 requires a WhatsApp adapter and its text says "official Business/Cloud APIs." But the
official Cloud API is **webhook-push** — it requires a **public inbound endpoint**, contradicting OQ-004
(private-network only, outbound/relay) — and carries business-account/approval overhead disproportionate to a
single operator (OQ-003). The operator therefore chose an **unofficial client**; the requirement-text change is
carried as a Proposed, gated amendment (DEC-016), with the official option preserved as rejected-with-reason
(INV-006). R-12 / C-9 evaluated the unofficial landscape: **Baileys** (WhiskeySockets, MIT, WebSocket
multi-device, active) is the best stack fit and only pure-outbound option; Puppeteer-based libraries
(whatsapp-web.js/wppconnect/venom) are heavy and a poor Bun/server fit. Two material risks dominate: **ban/ToS**
(any unofficial account can be banned anytime; no sandbox — RISK-013) and **supply-chain** (the Dec-2025
malicious Baileys fork `lotusbail`, 56k+ downloads, stole WhatsApp auth tokens — RISK-014).

**Amended 2026-07-10 (OpenClaw reference-only).** OpenClaw was evaluated as a WhatsApp base: its `LICENSE` is
genuine **MIT** and `extensions/whatsapp` (a production Baileys adapter) exists, but its ~382k-star metric is
implausible, so — per operator directive + the RISK-014 supply-chain lesson — OpenClaw is a **design/pattern
reference only, NO code port**. The verified decision below (WAHA-isolation primary / hardened-Baileys-direct alt)
is unchanged; any future OpenClaw code port is a **separate, gated** follow-up requiring manual code review first.
PH-7 also reuses the ADR-0011 gateway + `@marid/channel-client` + ADR-0012 mirroring.

**Amended 2026-07-10 (PH-7 deep-design — mechanics).** (1) **Narrow WAHA interface:** the WhatsApp client sits
behind a small interface so the deterministic **fake-WA test** (ADR-0014 tier 2) is cheap; **WAHA-primary sidesteps
any Baileys/OpenClaw code-port entirely** (Marid speaks HTTP/WS to WAHA, no Baileys in Marid's tree — the port
question only arises for the Baileys-direct alternative). (2) **Streaming-sim:** presence(`composing`) + throttled
edit-coalescing within WhatsApp's ~15-min edit window + rate limits (Baileys/WAHA can edit sent messages). (3)
**Auth-state persistence:** WAHA session store (or Baileys multi-file auth state) at 0600, out of logs/VCS
(INV-002), with a reconnect watchdog; QR pairing at setup. (4) **Media:** send/receive within WhatsApp limits. (5)
**Permission UX:** per **ADR-0015** — token-bound **text reply** (WhatsApp interactive buttons are dead), not an
inline keyboard. (6) **Attach/mirror:** WhatsApp is "just another channel" on the ADR-0012 registry — the operator
`/attach`es a session; view-via-binding/act-via-ownership applies unchanged. (7) **Testing:** per **ADR-0014**
(no deterministic real-protocol tier; fake-WA is the gate). (8) **Deferred to a PH-7 build:** the final WAHA-vs-
Baileys-direct pick is confirmed by **EXP-006/011**.

**Decision.** Build `@marid/whatsapp` as an **additive, separate-process adapter** (ADR-0005) speaking only
Marid's public HTTP+SSE API with a `channel:<name>` bearer token; INV-001 stays server-enforced by `@marid/auth`
(the adapter carries the token, never re-implements policy). **Primary approach: Baileys isolated behind a
pinned HTTP-wrapper container (WAHA, NOWEB engine), consumed over WebSocket** so that `@marid/whatsapp` pulls **no
WhatsApp-specific dependency** into Marid's tree (a lotusbail-class compromise stays in the WAHA container, not
Marid's `node_modules`), WAHA Core is free Apache-2.0, and the connection is outbound-only (WAHA WebSocket event
mode, no inbound webhook — OQ-004). **Documented alternative: Baileys-direct** (pinned `baileys`, MIT) — smallest
architecture and best OQ-004/streaming fit, at the cost of Baileys in Marid's dep tree with mandatory hardening
(exact-pin, frozen lockfile + integrity, provenance check, script-block). Streaming simulation uses
presence("composing") + throttled edit-coalescing (Baileys supports message edits; not per-token). Per-chat JID →
session mapping, operator allowlist (FR-050), inbound dedup (FR-051), auth-state persistence out of logs/VCS
(INV-002). The final client choice (WAHA vs direct) is **confirmed by EXP-006**: a reproducible fake-WhatsApp
integration probe (EXP-006, run at PH-7 start) proves INV-001 wiring + outbound-only + media/streaming shape; the **real-number
live round-trip is deferred to PH-7 start** (no sandbox exists; a live probe risks banning a real number).

**Consequences.** Marid gains a WhatsApp channel that fits the private-network posture with no public ingress and
no policy in the adapter. Ban risk (RISK-013) is an **accepted, disclosed operational reality** — use a dedicated
linked-device number, allowlist-only, human-paced messaging; treat account loss as expected. The primary
(WAHA) approach adds one sidecar container + one trust anchor (pinned image digest) but keeps Marid's package
WhatsApp-dependency-free; the alternative (direct) trades that for Baileys in-tree under strict supply-chain
hardening. FR-047 is amended (DEC-016) from "official" to "an unofficial client under private-network
containment." Realized in PH-7 (WBS-7.1..7.5) after the gate.

**Rejected.** (1) **Official WhatsApp Cloud API** — webhook-push needs public ingress (OQ-004) + business
approval/pricing overhead; kept as rejected-with-reason. (2) **Puppeteer libraries** (whatsapp-web.js,
wppconnect, venom) — Chromium footprint wrong for a lean Bun server; buggy edits / stale releases /
weak-copyleft. (3) **Baileys vendored directly with no hardening** — unacceptable given lotusbail (RISK-014).
(4) **Deferring WhatsApp indefinitely** — FR-047 is a recorded (Full-scope) requirement the operator has chosen
to pursue now.
