import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { createChannelClient } from "@marid/channel-client"
import type { BotApi } from "./bot-api"
import { createDedup } from "./dedup"
import { inboundFileParts, inboundNote } from "./media"
import { createPermissions, type ReplyDecision, type Timer } from "./permission"
import { restrictedPrompt } from "./policy"
import { runRouter } from "./router"
import { routeSlash } from "./slash"
import { createStreamer } from "./stream"
import type { TgCallbackQuery, TgMessage } from "./telegram"

// Composition root for the Telegram gateway (WBS wiring). One process, one operator.
//
// Flow: subscribe to the firehose FIRST (it is live-only), then start the long-poll
// router. An allowlisted operator message creates/continues a per-chat session and
// prompts the bound restricted agent. Assistant text streams back as coalesced edits;
// permission asks become inline keyboards.
//
// The channel-agnostic half — the firehose subscribe/pump, event interpretation, and
// per-part streamer coordination — now lives in `@marid/channel-client` (WBS-6.1,
// ADR-0011); this file is the Telegram-specific composition: the chat↔session binding,
// the Telegram rendering sink (`createStreamer`), and the inline-keyboard permission
// surfacing. `parseAskEvent` is re-exported so its committed public API is unchanged.

export { parseAskEvent } from "@marid/channel-client"

export interface RunGatewayDeps {
  sdk: OpencodeClient
  bot: BotApi
  allow: ReadonlySet<number>
  agent: string
  // Where to render a BOUND (operator-attached, non-owned) session that has no inbound
  // chat of its own — its turn originated on web/TUI (WBS-6.1b mirroring-in). "One process,
  // one operator": the single operator's chat. Unset → bound sessions render nowhere
  // (outbound is unaffected).
  defaultChatId?: number
  dedupFile: string
  now(): number
  sleep(ms: number): Promise<void>
  timers: Timer
  cadenceMs?: number
  permissionTimeoutMs?: number
  pollTimeoutSec?: number
  log: (line: string) => void
  signal: AbortSignal
}

// Whitelisted slash commands (deny-by-default — slash.ts). Everything else that starts
// with "/" is refused, never prompted to the agent.
const COMMAND_NAMES = new Set(["new", "help"])
const HELP_TEXT = "Commands:\n/new — start a fresh session\n/help — show this help\n\nAny other message is sent to the agent."

export async function runGateway(deps: RunGatewayDeps): Promise<void> {
  const dedup = createDedup(deps.dedupFile)
  const chatToSession = new Map<number, string>()
  // Reverse binding (session → chat) so an inbound event knows which chat to render into.
  // Set the instant a turn begins, before any event for that session can arrive.
  const sessionChat = new Map<string, number>()

  const permissions = createPermissions({
    bot: deps.bot,
    reply: (sessionID: string, permissionID: string, decision: ReplyDecision) =>
      // Ownership-gated session-scoped route (the channel allowlist permits it).
      deps.sdk.permission
        .respond({ sessionID, permissionID, response: decision }, { throwOnError: true })
        .then(() => undefined),
    chatOf: (sessionID) => sessionChat.get(sessionID),
    timers: deps.timers,
    timeoutMs: deps.permissionTimeoutMs ?? 300_000, // 5 min human-decision window; deny on timeout
    log: deps.log,
  })

  // The shared channel client owns the firehose + event interpretation; Telegram supplies
  // only the per-part rendering sink (one Telegram streamer per assistant text part) and
  // the permission-ask surfacing.
  const client = createChannelClient({
    sdk: deps.sdk,
    signal: deps.signal,
    createStreamer: (sessionID) => {
      // A session the operator prompted has its own chat; a BOUND (attached, non-owned)
      // session mirrored in from web/TUI (WBS-6.1b) has none, so fall back to the single
      // operator's defaultChatId. With neither, there is nowhere to render — return a
      // no-op sink rather than sending to an undefined chat.
      const chatId = sessionChat.get(sessionID) ?? deps.defaultChatId
      if (chatId === undefined) return { push: async () => {}, finish: async () => {} }
      return createStreamer({
        bot: deps.bot,
        chatId,
        now: deps.now,
        sleep: deps.sleep,
        cadenceMs: deps.cadenceMs,
      })
    },
    onAsk: (ask) => void permissions.onAsk(ask),
  })

  // Execute a whitelisted slash command. /new resets the chat→session binding so the
  // next message starts fresh; /help lists the commands. Both reply directly and never
  // touch the SDK prompt path.
  async function handleCommand(name: string, chatId: number): Promise<void> {
    if (name === "new") {
      chatToSession.delete(chatId)
      await deps.bot.sendMessage(chatId, "Started a new session.")
      return
    }
    if (name === "help") await deps.bot.sendMessage(chatId, HELP_TEXT)
  }

  async function onMessage(message: TgMessage): Promise<void> {
    const base = message.text ?? message.caption ?? ""
    const chatId = message.chat.id

    // Deny-by-default slash routing BEFORE building a prompt: a /command is either a
    // whitelisted handler or refused — it is never sent to the agent as text.
    if (base.startsWith("/")) {
      const route = routeSlash(base, COMMAND_NAMES)
      if (route.kind === "command") return handleCommand(route.name, chatId)
      if (route.kind === "rejected") {
        await deps.bot.sendMessage(chatId, `Unknown command: /${route.name}. Try /help.`)
        return
      }
    }

    const note = inboundNote(message) // media surfaced as untrusted DATA (INV-004)
    const text = base && note ? `${base}\n${note}` : base || note || ""
    // Defect 2: the attachment itself now lands in the workspace as a file part (was
    // discarded — only the note was sent). The token-bearing URL is never logged (INV-002).
    const files = await inboundFileParts(message, deps.bot)
    if (!text && files.length === 0) return // nothing to prompt with
    if (files.length > 0) deps.log(`attached ${files.length} inbound file part(s)`)
    let sessionID = chatToSession.get(chatId)
    if (!sessionID) {
      const created = await deps.sdk.session.create({ agent: deps.agent }, { throwOnError: true })
      sessionID = created.data.id
      chatToSession.set(chatId, sessionID)
    }
    // Bind the reverse mapping and start a fresh per-part reply BEFORE prompting, so any
    // event for this session finds its chat and a clean streamer set (one message per part).
    sessionChat.set(sessionID, chatId)
    client.beginTurn(sessionID)
    await deps.sdk.session.promptAsync(restrictedPrompt({ sessionID, text, agent: deps.agent, files }), { throwOnError: true })
  }

  const onCallback = (query: TgCallbackQuery): Promise<void> => permissions.onCallback({ id: query.id, data: query.data })

  // Subscribe to the firehose BEFORE polling so no early events are missed.
  const { done } = await client.start()

  await runRouter({
    getUpdates: (offset, timeoutSec) => deps.bot.getUpdates(offset, timeoutSec),
    sleep: deps.sleep,
    signal: deps.signal,
    pollTimeoutSec: deps.pollTimeoutSec,
    allow: deps.allow,
    dedup,
    log: deps.log,
    onMessage,
    onCallback,
  })
  await done.catch(() => {})
}
