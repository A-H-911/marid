---
id: ADR-0008
status: Superseded
version: v1.1
updated: 2026-07-10
supersedes: none
superseded_by: ADR-0009
owner: operator (STK-001)
---

# ADR-0008 — Post-MVP: replace the hand-rolled marid-telegram gateway with a fork of grinev/opencode-telegram-bot

**Status:** **SUPERSEDED by [ADR-0009](adr-0009-telegram-channel-remediation.md) (2026-07-10, operator gate).** The
fork direction is withdrawn in favor of **fix-in-place** (the hand-rolled gateway is zero-dep and already has the
streaming machinery; the only gap is one MIT md library — grinev is Basic-auth + channel-scope-denied features).
Original (now-superseded) decision below. · the Telegram channel gateway's **UX layer** is re-based onto a
mature MIT bot rather than the hand-rolled implementation · **does not supersede
[ADR-0005](adr-0005-channel-gateway-separate-process.md)** (separate-process gateway holding no provider keys
still holds — the fork is still that process) · relates to FR-036/043, FR-065, INV-001, DEC-009 (reuse-first),
[deferred-work #9](../execution/deferred-work-register.md) · raised by the PH-5 live Telegram E2E (2026-07-09).

**Context.** PH-4 shipped a **hand-rolled** gateway (`packages/marid-telegram` — a custom Bot API client over
`fetch` in `bot-api.ts`, custom streaming/coalescing in `stream.ts`, custom chunking in `format.ts`), built and
unit-tested against the **mock test provider** (EXP-003; model `big-pickle`/provider `opencode`). A PH-5 live
run against a real bot surfaced a cluster of **outbound UX defects** that the mock never exercised:

- **Markdown un-rendered** — `stream.ts` HTML-escapes the text and sends `parse_mode:HTML`, but the agent emits
  **Markdown**, which is never converted to Telegram HTML → `**bold**`, backticks, headings render literally.
- **Inbound media not landed** into the agent's workspace — a photo yields the agent replying "image not found."
- **Slash commands** not routed.
- **Multi-part replies concatenated** into a single message (`currentText = parts.join("")`).
- **web→Telegram not mirrored** — the gateway is a request/response bridge (a streamer is built only on a
  Telegram-inbound turn), so a web-originated turn does not surface in Telegram. This is **by design**, not a bug.

What **does** hold: the round-trip is verified working (operator "hello" → `build` agent reply, session synced to
the web UI), and the **security model is correct** — the channel `channel:` token + `marid-auth` enforce
deny-by-default + bound-agent server-side (WBS-4.4, INV-001), independent of the bot's UX quality.

The defects all live in **outbound formatting / media / command handling** — exactly what a mature Telegram
framework and a real Markdown parser provide off the shelf. Per Marid's reuse-first principle (DEC-009), that is
a fork candidate, not a re-implementation.

**Decision.** **Post-MVP**, replace the hand-rolled UX layer with a fork/port of
[`grinev/opencode-telegram-bot`](https://github.com/grinev/opencode-telegram-bot) (MIT, ~897★, actively
maintained): **grammy** + `@grammyjs/menu` (battle-tested Bot API framework), **remark-parse/remark-gfm/unified**
(real Markdown → Telegram HTML), and the **official `@opencode-ai/sdk`** (the same v1 SDK the current gateway
uses). Marid's **INV-001 security is preserved by configuration, not rewrite**:

1. The forked bot authenticates to a running **Marid instance** with a **`channel:` bearer token** (it already
   supports "OpenCode Server Authentication"), so `marid-auth` applies the deny-by-default scope + bound-agent
   backstop on every request — the bot need not *understand* Marid's security, the server enforces it.
2. The fork's own **allowlist** (`TELEGRAM_ALLOWED_USER_ID`) is kept as client-side defense-in-depth (mirrors
   `MARID_TG_ALLOW`).
3. It stays a **separate process holding no provider keys** — ADR-0005 unchanged.

**Consequences.** **v0.1.0 ships Telegram as beta** on the current hand-rolled gateway with the five issues
above documented as known issues (deferred-work #9); the round-trip works, the security holds, only the UX is
rough. The fork is a **scheduled post-MVP phase** (a real research/design/port cycle: license attribution, the
`channel:`-token wiring, media→workspace landing, slash-command mapping, and INV-001 parity tests against a real
provider). License is **MIT-compatible** with Marid's downstream MIT distribution (attribution added on adoption).
The hand-rolled `packages/marid-telegram` remains until the fork lands and is verified, then is retired.

**Rejected.** (1) **Fix the hand-rolled gateway in place** — re-implements markdown/media/command handling that
grammy + remark already solve; more custom sync surface to maintain, against the reuse-first principle. (2) **Do
nothing / leave undocumented** — a known-defect set with no recorded direction is a tracker defect. (3) **Adopt a
broad multi-channel bot** (e.g. golembot: Slack/Discord/Telegram/…) — more surface than a single operator +
Telegram needs; revisit only if multi-channel becomes a requirement.
