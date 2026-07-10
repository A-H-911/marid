---
status: Draft
version: 1.0.0
updated: 2026-07-09
owner: operator (STK-001)
---

# Telegram Remediation Options (R-11)

Research track **R-11** for PH-6 (Telegram channel remediation). Answers: how to fix the five deferred-#9
UX defects with the fewest changes and smallest sync surface — **fix-in-place vs port grinev's UX modules
vs adopt another bridge**. This deliberately re-evaluates [ADR-0008](../../adrs/adr-0008-telegram-gateway-fork.md)
(which chose "fork grinev") on new evidence. Feeds comparison **C-8** and decision **DEC-014**.

**Hard filter (a candidate that fails is rejected pre-scoring):** separate process, public HTTP+SSE API only
(ADR-0005); `channel:<name>` bearer bound to one agent; prompts as `session.create`+`promptAsync {agent,parts}`;
permission replies via `POST /session/:id/permissions/:pid`; consume the live-only SSE firehose + re-fetch on
reconnect; own allowlist + `update_id` dedup; ≥2 s edit-coalesced streaming + 4096 split; additive package,
MIT-compatible. INV-001 stays server-enforced by `@marid/auth` regardless of gateway.

## Load-bearing local fact (verified at source)

`packages/marid-telegram` has **zero runtime dependencies** — the gateway is a **hand-rolled raw Bot API
client** (`bot-api.ts`, `telegram.ts`), **not** grammy or telegraf. It already contains coalesced-edit
streaming, unchanged-skip, 429 `retry_after` handling, and a **400 → plain-text fallback** (`stream.ts:65-72,
79-86`). The only genuinely missing capability is **Markdown → Telegram conversion**. This reframes the whole
decision: "fixing in place" is not "re-implementing grammy/remark" — grammy's role is already filled by the
zero-dep client, and remark is one library call.

## A. Markdown → Telegram rendering libraries

Agents emit a Markdown **string**, so a **parser** (string → Telegram-safe output) is needed, not a **builder**
(compose-by-API). Only one surveyed library is a parser.

| npm | License | Stars / last push | DL/wk | Approach | Parser? | Fences/nesting/tables | Deps |
|---|---|---|---|---|---|---|---|
| **telegramify-markdown** | MIT | 98★ · 2026-04-08 | ~15,118 | MD string → **MarkdownV2** | **Yes (remark)** | Yes (remark-gfm; escapes V2 chars; unsupported-tag strategy) | unified+remark (~7) |
| @vlad-yakovlev/telegram-md | MIT | 32★ · 2026-07-05 | ~66 | Builder → MarkdownV2 | No | n/a | 0 |
| telegram-format | MIT | 54★ · 2025-01-29 | ~2,676 | Builder → HTML/MDV2 | No | n/a | 0 |
| @grammyjs/parse-mode | MIT | 21★ · 2026-05-21 | ~9,153 | Builder (grammy-only) | No | n/a | 0 |
| node-telegram-util | — | dead (`0.0.1-security` placeholder) | — | — | — | — |

**Pick: `telegramify-markdown`** — the only string→Telegram converter, purpose-built for MarkdownV2, typed,
by far the most used. Builders can't convert an arbitrary Markdown string, so they don't solve defect #1.
General md→HTML libs (`marked`, `markdown-it`) fit poorly — Telegram HTML supports only ~9 tags, needing heavy
post-filtering; telegramify targets Telegram's grammar directly. Caveat: it emits **MarkdownV2**, so the
gateway switches `parse_mode` from `HTML` → `MarkdownV2`; partial-stream frames that are invalid MarkdownV2 are
already covered by the existing 400→plain-text fallback, so intermediate frames degrade to plain and the final
well-formed frame renders formatted.
Sources: https://github.com/skoropadas/telegramify-markdown · https://github.com/vlad-iakovlev/telegram-md ·
https://github.com/EdJoPaTo/telegram-format · https://github.com/grammyjs/parse-mode

## B. grinev module portability (reference, not adopt)

`grinev/opencode-telegram-bot` (MIT, 899★, pushed 2026-07-06) is **grammy + remark**, and is a **feature-rich
admin client** (server start/stop, custom commands, `init`/`review`, skills, model switching, voice) that talks
a **local `opencode serve` via OpenCode Basic auth**. Most of its features hit routes Marid's `channel:` scope
**denies (403)**. Its rendering lives in a self-contained `src/bot/render/` (block/inline renderers, an
entity-aware 4096 chunker, validator, and a simpler `convertToTelegramMarkdownV2()` string path). Porting the
**entity path** drags grammy's `MessageEntity` type model + unified/remark into a grammy-free, zero-dep
gateway; the **string path** still pulls in remark + normalizer + block-parser — i.e. `telegramify-markdown`
gives the same MarkdownV2 result off npm with one dependency and no grammy coupling. Its media/streaming
modules are entangled with the admin features (model-capability gating, i18n). **Verdict: grinev is a useful
reference implementation (its chunker + markdown-fallback confirm Marid's own designs), not a source to fork.**
MIT allows a file-level port with notice retained if ever wanted.

## C. Adopt-other survey — none fit the contract

GitHub search of coding-agent Telegram bridges (top by stars): `nanocoai/nanoclaw` (30k★, embeds agent in
containers), `chenhg5/cc-connect` (13k★, spawns local CLIs), `RichardAtCT/claude-code-telegram` (2.7k★, wraps
CLI locally, no license), `op7418/Claude-to-IM-skill` (2.8k★, embeds SDK), `PleasePrompto/ductor` (spawns),
`six-ddc/ccbot` (tmux bridge), `different-ai/owpenbot` (thin opencode bridge but **Basic auth**),
`littlebearapps/untether` (Python, spawns). **Finding: every mature bridge either embeds/spawns the agent or,
if it talks the OpenCode server, uses OpenCode Basic auth — none implements the deny-by-default, separate-
process, `channel:`-token-scoped model `@marid/auth` enforces.** Adopting any imports the admin/embedding
architecture ADR-0005 deliberately rejected. No thin bearer-token gateway exists to adopt.

## D. Per-defect minimal fix (honest effort)

| # | Defect | Minimal fix | Where | Effort |
|---|---|---|---|---|
| 1 | Markdown un-rendered | `telegramifyMarkdown(fullText,"escape")` instead of `escapeHtml`; `parse_mode` `HTML→MarkdownV2`; existing 400→plain fallback covers partial frames | `stream.ts:58,97` | +1 dep, ~5-15 LOC |
| 2 | Inbound media not landed | on inbound photo/doc: `resolveDownloadUrl` (already in `media.ts`) → download bytes → attach as SDK `FilePartInput` part; redact token'd URL before logging (INV-002) | `gateway.ts:149-171`, `policy.ts` | ~15-30 LOC + one INV-004 deny-by-default design choice |
| 3 | Slash not routed | branch `text.startsWith("/")` at top of `onMessage` → small command table (`/new`,`/help`,`/cancel`) | `gateway.ts:149` | ~10-25 LOC |
| 4 | Multi-part concatenated | root cause one line `currentText = parts.join("")` (`gateway.ts:93`) → `join("\n\n")`; true per-message is larger and not required for the symptom | `gateway.ts:93` | ~1-5 LOC (sep) / ~30-50 (per-message) |
| 5 | No SSE reconnect | wrap subscribe+pump in `while(!aborted)`: on drop, backoff + re-`event()`, **re-fetch authoritative `session.messages`** to backfill the gap, resume (contract v1.1) | `gateway.ts:178-189` | ~20-45 LOC, no new dep |

**Total fix-in-place: 1 dependency (`telegramify-markdown`) + ~55-120 LOC across 3-4 existing Marid-owned
files.** No grammy, no remark hand-roll, no upstream patch surface.

## E. Recommendation (ranked: fewest changes · smallest sync surface · solo maintainer)

1. **Fix-in-place with `telegramify-markdown` — front-runner.** All five defects are small local edits; the two
   hardest concerns (parse-safety fallback, streaming/coalescing/429) are already solved in `stream.ts`. One
   MIT dep replaces the "re-implement remark" strawman. Zero new architecture, zero grammy, zero patch rows,
   smallest sync surface — directly rebuts ADR-0008's rejection rationale.
2. **Port grinev's `render/` modules — distant second.** Only if Marid specifically wants entity-based
   rendering (no `parse_mode`); drags unified+remark+grammy types in for a result telegramify already gives.
3. **Adopt-other — do not.** No surveyed bridge speaks the `channel:`-bearer + separate-process + deny-by-default
   contract; all embed/spawn or use Basic auth.

**Feeds C-8/DEC-014:** the priorities point unambiguously at fix-in-place. ADR-0008's "re-implements
grammy/remark" premise does not survive contact with the source. Confirmation is EXP-005 (PH-6).

## Sources
Repo/npm metadata pulled 2026-07-09 via `gh` + npm registry. telegramify-markdown, telegram-md, telegram-format,
grammy/parse-mode (links in §A); grinev/opencode-telegram-bot https://github.com/grinev/opencode-telegram-bot ;
bridges: nanocoai/nanoclaw, chenhg5/cc-connect, RichardAtCT/claude-code-telegram, op7418/Claude-to-IM-skill,
PleasePrompto/ductor, six-ddc/ccbot, different-ai/owpenbot, littlebearapps/untether (GitHub). Local source:
`packages/marid-telegram/src/{stream,format,gateway,router,media,bot-api}.ts`, `package.json`.
