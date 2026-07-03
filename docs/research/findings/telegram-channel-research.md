---
artifact: telegram-research
status: Draft
version: v0.1
updated: 2026-07-03
track: R-09
sources_primary:
  - https://core.telegram.org/bots/api
  - https://core.telegram.org/bots/faq
  - https://core.telegram.org/bots/webhooks
  - https://core.telegram.org/bots/features
---

# Telegram Bot API — Channel Adapter Research (R-09)

Context: first channel adapter for a private, single-operator AI-agent platform on a private network with no public ingress; agent output streams as it generates.

## 1. Ingress: long polling vs webhook

**Long polling (`getUpdates`)**
- Bot makes outbound HTTPS calls to `api.telegram.org`; no inbound connectivity needed. Updates are stored server-side "until the bot receives them either way, but they will not be kept longer than 24 hours." ([bots/api#getting-updates](https://core.telegram.org/bots/api#getting-updates))
- An update is confirmed by calling `getUpdates` with `offset` greater than its `update_id`. ([bots/api#getupdates](https://core.telegram.org/bots/api#getupdates))
- Use `timeout` (e.g. 30–50 s) for true long polling; short polling is for testing only (same anchor).

**Webhook (`setWebhook`)**
- Requires a publicly reachable HTTPS endpoint that "accepts incoming POSTs from subnets `149.154.160.0/20` and `91.108.4.0/22` on port 443, 80, 88, or 8443", TLS 1.2+, valid cert chain (self-signed supported if uploaded via `certificate`), IPv4 only. Ranges "might change in the future." ([bots/webhooks](https://core.telegram.org/bots/webhooks))
- `secret_token` (1–256 chars, `A-Za-z0-9_-`): "the request will contain a header 'X-Telegram-Bot-Api-Secret-Token' with the secret token as content" — validate it on every POST to authenticate Telegram. ([bots/api#setwebhook](https://core.telegram.org/bots/api#setwebhook))
- Webhook and `getUpdates` are mutually exclusive: "You will not be able to receive updates using getUpdates for as long as an outgoing webhook is set up." ([bots/api#getupdates](https://core.telegram.org/bots/api#getupdates))
- `max_connections` 1–100; `ip_address` pins the delivery target; `drop_pending_updates` clears the backlog. ([bots/api#setwebhook](https://core.telegram.org/bots/api#setwebhook))

**Verdict for private-network deployment: long polling.** It is outbound-only (fits no-public-ingress), needs no TLS cert, no reverse proxy, no IP allowlisting, and for a single operator the latency difference vs webhook is negligible. Webhook would require exposing an endpoint (or a tunnel), which contradicts the deployment constraint.

## 2. Streaming simulation via editMessageText

- Pattern: `sendChatAction(typing)` immediately, `sendMessage` with the first chunk, then `editMessageText` on that message as tokens accumulate, final edit with complete text.
- `sendChatAction`: "The status is set for 5 seconds or less (when a message arrives from your bot, Telegram clients clear its typing status)." Re-send every ~4–5 s while generating before the first chunk. ([bots/api#sendchataction](https://core.telegram.org/bots/api#sendchataction))
- Official rate limits (messages; edits are not separately documented):
  - "In a single chat, avoid sending more than one message per second." Bursts may pass, "eventually you'll begin receiving 429 errors." ([bots/faq](https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this))
  - Groups: "not able to send more than 20 messages per minute." (same anchor)
  - Global broadcast: ~30 messages/second. (same anchor)
- 429 handling: `ResponseParameters.retry_after` = "the number of seconds left to wait before the request can be repeated." Always honor it. ([bots/api#responseparameters](https://core.telegram.org/bots/api#responseparameters))
- Edit-specific limits are **not officially documented**; community experience is that edits count against the same per-chat flood control (`unverified`).

**Safe cadence:** throttle edits to at most 1/second per chat, with **one edit every 2–3 seconds** as the recommended default (comfortable margin, still reads as "streaming"). Coalesce buffered tokens per edit; skip the edit if text is unchanged (Telegram returns a 400 "message is not modified" error, `unverified` exact wording). Verdict: streaming simulation is viable and is the standard pattern for Telegram AI bots.

## 3. Formatting and message length

- `sendMessage.text`: "1-4096 characters after entities parsing." ([bots/api#sendmessage](https://core.telegram.org/bots/api#sendmessage)) Media captions: "0-1024 characters after entities parsing." ([bots/api#sendphoto](https://core.telegram.org/bots/api#sendphoto))
- `parse_mode`: `MarkdownV2`, `HTML`, legacy `Markdown`. ([bots/api#formatting-options](https://core.telegram.org/bots/api#formatting-options))
- Code blocks supported: `code` (inline monowidth) and `pre` (block, with optional language) entities. (same anchor)
- MarkdownV2 escaping is strict: outside entities the characters `_ * [ ] ( ) ~ ` > # + - = | { } . !` "must be escaped with a preceding '\'"; inside pre/code, `` ` `` and `\` must be escaped. (same anchor) HTML mode is often easier to generate safely from LLM output (escape only `< > &`).
- Splitting long replies: split at 4096, preferably on paragraph/code-fence boundaries; close and reopen code fences across the split; send parts sequentially (respecting 1 msg/s). During streamed edits, when the buffer nears 4096, finalize the message and start a new one (splitting strategy itself: `unverified`/design choice, not API-documented).
- Failed entity parsing rejects the whole message (400); fall back to `parse_mode` omitted (plain text) on parse errors (`unverified` best practice).

## 4. Media and files

- Send: "Bots can currently send files of any type of up to 50 MB in size"; via multipart upload: "10 MB max size for photos, 50 MB for other files." ([bots/faq](https://core.telegram.org/bots/faq#handling-media), [bots/api#sending-files](https://core.telegram.org/bots/api#sending-files))
- Receive/download: `getFile` "will only work with files of up to 20 MB in size"; download via `https://api.telegram.org/file/bot<token>/<file_path>`; "the link will be valid for at least 1 hour," then call `getFile` again. ([bots/api#getfile](https://core.telegram.org/bots/api#getfile), [bots/faq](https://core.telegram.org/bots/faq#how-do-i-download-files))
- Resending by `file_id` costs no re-upload but cannot change file type. ([bots/api#sending-files](https://core.telegram.org/bots/api#sending-files))
- Larger limits (upload to 2000 MB, unrestricted download) require running a self-hosted Bot API server (`telegram-bot-api`), which is compatible with private deployment. ([bots/api#using-a-local-bot-api-server](https://core.telegram.org/bots/api#using-a-local-bot-api-server))

## 5. Conversation mapping

- Chats: each `Update` carries `message.chat.id`; private chat per user is the natural session key for a single operator.
- Forum topics: `message_thread_id` = "Unique identifier for the target message thread (topic) of a forum; for forum supergroups and private chats of bots with forum topic mode enabled" — usable to map one topic per agent session/task. ([bots/api#sendmessage](https://core.telegram.org/bots/api#sendmessage)) Topic management via `createForumTopic` etc. ([bots/api#createforumtopic](https://core.telegram.org/bots/api#createforumtopic))
- `reply_parameters`/`reply_to_message_id` link replies to specific messages (e.g. answer-to-question threading). ([bots/api#replyparameters](https://core.telegram.org/bots/api#replyparameters))
- Commands: `setMyCommands` — "At most 100 commands can be specified," scoped per chat/language via `BotCommandScope`. ([bots/api#setmycommands](https://core.telegram.org/bots/api#setmycommands)) Command strings: start with `/`, up to 32 chars, Latin letters/digits/underscores. ([bots/features#commands](https://core.telegram.org/bots/features#commands))
- Inline keyboards for approvals: "Pressing buttons on inline keyboards doesn't send messages to the chat" — callback buttons fire a `callback_query` update carrying `data` (1–64 bytes) and the originating message. ([bots/features#inline-keyboards](https://core.telegram.org/bots/features#inline-keyboards), [bots/api#inlinekeyboardbutton](https://core.telegram.org/bots/api#inlinekeyboardbutton))
- `answerCallbackQuery`: "The answer will be displayed to the user as a notification at the top of the chat screen or as an alert." Must be called to stop the button spinner. ([bots/api#answercallbackquery](https://core.telegram.org/bots/api#answercallbackquery))

**Verdict:** inline keyboard + `callback_query` + `answerCallbackQuery` + `editMessageText` (to replace buttons with "Approved by you at HH:MM") is well suited to permission approve/deny prompts. Validate that `callback_query.from.id` is the operator before acting; callback `data` should be an opaque request ID, not the action payload (`unverified` best practice).

## 6. Identity and abuse controls

- User IDs are stable and unique: "Unique identifier for this user or bot… at most 52 significant bits, so a 64-bit integer… safe for storing this identifier." ([bots/api#user](https://core.telegram.org/bots/api#user)) IDs persist across username/display-name changes (`unverified` — implied by "unique identifier," universally relied upon).
- Allowlisting: enforce `update.message.from.id ∈ {operator_id}` (and same for `callback_query.from.id`) at the adapter boundary; drop everything else silently. Anyone can discover and message a bot, so this check is mandatory — the Bot API has no built-in allowlist (`unverified`, by absence in the API reference).
- Privacy mode (groups): "enabled by default for all bots, except bots that were added to a group as admins." Enabled: bot sees only commands addressed to it, replies to it, and service messages; "All messages from private chats" are always received regardless. ([bots/features#privacy-mode](https://core.telegram.org/bots/features#privacy-mode)) For a single-operator private-chat bot this is moot but keep it enabled.
- Rate limits per bot: see section 2 (1 msg/s per chat, 20/min per group, ~30/s global). ([bots/faq](https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this))
- Token: "Keep your token secure and store it safely, it can be used by anyone to control your bot." ([bots/features](https://core.telegram.org/bots/features#botfather)) Store as an environment variable / secret-manager entry, never in code or logs; note the token is embedded in file-download URLs, so scrub those from logs. Rotate via BotFather `/revoke` if exposed (`unverified` — BotFather command, widely documented).

## 7. Retry and idempotency

- `update_id`: "Update identifiers start from a certain positive number and increase sequentially. This identifier becomes especially handy if you're using webhooks, since it allows you to ignore repeated updates or to restore the correct update sequence, should they get out of order." Persist the last processed `update_id` and drop duplicates/lower IDs. ([bots/api#update](https://core.telegram.org/bots/api#update))
- Polling: confirming via `offset` is the dedup mechanism; crash-before-confirm means redelivery, so processing must be idempotent per `update_id`. ([bots/api#getupdates](https://core.telegram.org/bots/api#getupdates))
- Retention: unconfirmed/undelivered updates "will not be kept longer than 24 hours." ([bots/api#getting-updates](https://core.telegram.org/bots/api#getting-updates))
- Webhook non-200: Telegram redelivers the update (hence the official dedup advice above); the exact retry schedule/backoff is **not documented** in the API reference or webhook guide (`unverified` — community observation: repeated retries with increasing intervals until 200 or 24 h expiry).
- Outbound sends have **no idempotency key**; a timeout after a successful send can duplicate a message on retry. Mitigate with conservative timeouts and, if needed, dedup by content hash within a short window (`unverified` design guidance).
- If there are no new updates for at least a week, update identifiers may restart from a new base ("If there are no new updates for at least a week, then identifiers of new updates are chosen randomly…" — partially retrieved; verify full sentence at [bots/api#update](https://core.telegram.org/bots/api#update)). Do not treat `update_id` as globally monotonic across long idle gaps.

## Summary recommendation

Long polling (`getUpdates`, timeout ~50 s) as the sole ingress; single private chat with operator-ID allowlist; streaming simulated with `sendChatAction(typing)` + send-then-edit at one edit per 2–3 s honoring `retry_after`; HTML parse mode with plain-text fallback; split at 4096 chars; inline keyboards + `callback_query` for approvals. No hard blockers identified.
