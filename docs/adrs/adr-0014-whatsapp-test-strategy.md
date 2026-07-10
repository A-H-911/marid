---
id: ADR-0014
status: Approved
version: 1.0.0
updated: 2026-07-10
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0014 — WhatsApp real-client test strategy (no deterministic real-protocol tier)

**Status:** **Approved (2026-07-10 operator PH-7 gate; EXP-011/012/013 validate at build)** · relates to FR-047/048/049, FR-063, NFR-011, AC-018,
AC-023, DEC-020, RISK-013/018/022, ADR-0010, ADR-0013 (Telegram analog), [C-13](../architecture/technology-comparison.md),
[R-12](../research/findings/whatsapp-options.md).

**Context.** Telegram got a four-tier strategy anchored on a **test DC + GramJS userbot** — a *deterministic
automated real-protocol* tier (ADR-0013). **WhatsApp has no equivalent** (researched 2026-07-10): there is **no
public test DC / sandbox** for the unofficial protocol; Baileys' own mock server ("bartender") is **private to the
Baileys team** (`whiskeysockets-devtools` has 0 public repos, image behind a secret token) — **not reusable**;
driving a bot from a **second WhatsApp account** works but is on **real numbers = ToS-violating, ban-exposed
(2–8-week ban timelines reported), and flaky** — unusable as a gate; interactive buttons are broken (see ADR-0015).
The official **Cloud API sandbox** (Meta test number / Twilio) is deterministic-ish but exercises the **wrong
protocol** (official, not the chosen unofficial stack) and still needs a real app on the inbound side.

**Decision.** Four tiers, honestly matched to what WhatsApp allows — with the deterministic gate being a **fake we
build**, not a vendor sandbox:

1. **Unit** — approval-parser (ADR-0015), scope enforcement, message formatting. Blocking PR gate.
2. **Fake-WA integration — the deterministic blocking PR gate.** A **small in-repo fake at the WAHA WebSocket
   boundary**: inject synthetic inbound WhatsApp message events, capture Marid's outbound `sendText`/`sendMessage`
   calls, assert on them. Hermetic, in-process (Bun), **no accounts, no ban risk**. To keep this fake small, the
   WAHA client MUST sit behind a **narrow interface** (ADR-0010). This is where the bulk of behavioral coverage
   (round-trip, media, streaming-sim shape, attach/mirror, text-permission) lives. De-risked by **EXP-011**.
3. **Real-protocol smoke probe — manual/nightly, NEVER a gate.** A second Baileys/WAHA session on a **burner
   number** pings the bot and asserts a reply. Real protocol, but **flaky + ban-exposed** (accept losing the
   number). De-risked by **EXP-012**.
4. **Native-app render check — manual/occasional.** mobilewright/mobile-mcp drives the real WhatsApp Android app in
   an emulator to confirm rendering (esp. that any optional list message actually displays). De-risked by **EXP-013**.

**Honest headline.** Unlike Telegram, **WhatsApp has no deterministic automated real-protocol tier available to an
unofficial stack.** Tier 2 (a fake Marid builds at the WAHA boundary) is the gate; real-protocol coverage is
inherently non-gating, ban-exposed, and manual/nightly. The WhatsApp adapter is designed around this: a narrow
WAHA interface so the fake is cheap, and behavioral correctness proven against the fake + a manual real probe.

**Consequences.** Deterministic CI without touching a real WhatsApp account; real-protocol confidence comes from a
disclosed, ban-exposed manual probe on burner numbers (RISK-013/022). Costs: build the WAHA-boundary fake; keep a
burner number + emulator for the manual tiers. Realized in PH-7 (WBS-7.5). The official Cloud API sandbox is
**considered-and-rejected for parity** (wrong protocol) but noted as an optional manual real-protocol probe if a
provider-agnostic assertion is ever wanted.

**Rejected.** (1) **Second-account driver as the PR gate** — ban-exposed + flaky. (2) **Reuse Baileys "bartender"**
— private, undocumented, versioned to Baileys internals; unavailable. (3) **Official Cloud API sandbox as the
tier** — tests the wrong protocol. (4) **No real-client testing** — repeats the ADR-0008 mistake (a fake-only suite
missed the real defects on Telegram).
