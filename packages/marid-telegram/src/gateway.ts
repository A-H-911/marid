import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import type { BotApi } from "./bot-api"
import { createDedup } from "./dedup"
import { inboundFileParts, inboundNote } from "./media"
import { createPermissions, type ReplyDecision, type Timer } from "./permission"
import { restrictedPrompt } from "./policy"
import { runRouter } from "./router"
import { routeSlash } from "./slash"
import { createStreamer, type Streamer } from "./stream"
import type { TgCallbackQuery, TgMessage } from "./telegram"

// Composition root for the Telegram gateway (WBS wiring). One process, one operator.
//
// Flow: subscribe to /event FIRST (the firehose is live-only), then start the
// long-poll router. An allowlisted operator message creates/continues a per-chat
// session and prompts the bound restricted agent. Assistant text streams back as
// coalesced edits; permission asks become inline keyboards.
//
// The exact live event names differ across API generations (message.part.updated /
// session.idle vs session.next.text.delta / .step.ended vs permission.updated /
// permission.asked) — all are in the committed manifest — so dispatch matches a SET
// of type strings and reads fields defensively. Confirmed against a real run by the
// live E2E.

const TEXT_EVENTS = new Set(["message.part.updated", "session.next.text.delta"])
const DONE_EVENTS = new Set(["session.idle", "session.next.step.ended"])
const ASK_EVENTS = new Set(["permission.asked", "permission.updated"])

// Whitelisted slash commands (deny-by-default — slash.ts). Everything else that
// starts with "/" is refused, never prompted to the agent.
const COMMAND_NAMES = new Set(["new", "help"])
const HELP_TEXT = "Commands:\n/new — start a fresh session\n/help — show this help\n\nAny other message is sent to the agent."

// Map a permission-ask event to the fields the keyboard needs. Field names are the
// committed v1 PermissionRequest schema (packages/schema/src/v1/permission.ts):
// `id` (the per_ id = reply requestID), `sessionID`, and `permission` (the tool/
// permission name — there is NO `title` field). Pure + exported so the extraction is
// locked by a unit test (the live harness cannot drive a real permission — the
// openai-compatible test provider does not forward tools to the model).
export function parseAskEvent(payload: {
  type: string
  properties?: Record<string, unknown>
}): { id: string; sessionID: string; title?: string } | undefined {
  if (!ASK_EVENTS.has(payload.type)) return undefined
  const props = payload.properties ?? {}
  const id = typeof props.id === "string" ? props.id : undefined
  const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined
  if (!id || !sessionID) return undefined
  return { id, sessionID, title: typeof props.permission === "string" ? props.permission : undefined }
}

export interface RunGatewayDeps {
  sdk: OpencodeClient
  bot: BotApi
  allow: ReadonlySet<number>
  agent: string
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

// A session's live per-turn state: the chat it belongs to, ONE streamer per assistant
// text part (defect 4 — each distinct part is its own Telegram message, not one joined
// blob), the accumulated text per part (keyed by partID, insertion-ordered), and the
// set of USER message ids. We stream any text part whose message is NOT a user
// message — excluding user messages (rather than including assistant ones) avoids an
// ordering race: the user's message.updated reliably precedes the user's text part,
// whereas an assistant text part can arrive before its message.updated.
interface SessionState {
  chatId: number
  streamers: Map<string, Streamer>
  textByPart: Map<string, string>
  userMessages: Set<string>
}

export async function runGateway(deps: RunGatewayDeps): Promise<void> {
  const dedup = createDedup(deps.dedupFile)
  const chatToSession = new Map<number, string>()
  const sessions = new Map<string, SessionState>()

  const permissions = createPermissions({
    bot: deps.bot,
    reply: (sessionID: string, permissionID: string, decision: ReplyDecision) =>
      // Ownership-gated session-scoped route (the channel allowlist permits it).
      deps.sdk.permission
        .respond({ sessionID, permissionID, response: decision }, { throwOnError: true })
        .then(() => undefined),
    chatOf: (sessionID) => sessions.get(sessionID)?.chatId,
    timers: deps.timers,
    timeoutMs: deps.permissionTimeoutMs ?? 300_000, // 5 min human-decision window; deny on timeout
    log: deps.log,
  })

  // One streamer per part (lazily created on the part's first text), so each assistant
  // text part streams into its own message. finishAll force-flushes every part's final
  // text when the turn ends.
  function streamerFor(state: SessionState, partID: string): Streamer {
    const existing = state.streamers.get(partID)
    if (existing) return existing
    const streamer = createStreamer({ bot: deps.bot, chatId: state.chatId, now: deps.now, sleep: deps.sleep, cadenceMs: deps.cadenceMs })
    state.streamers.set(partID, streamer)
    return streamer
  }

  function finishAll(state: SessionState): void {
    for (const [partID, text] of state.textByPart) {
      if (text) void streamerFor(state, partID).finish(text)
    }
  }

  function onEvent(payload: { type: string; properties?: Record<string, unknown> }): void {
    const props = payload.properties ?? {}
    const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined
    const ask = parseAskEvent(payload)
    if (ask) {
      void permissions.onAsk(ask)
      return
    }
    if (!sessionID) return
    const state = sessions.get(sessionID)
    if (!state) return // not one of our sessions

    // Track user message ids (to exclude the operator's own echoed text), and treat a
    // completed assistant message as a done signal (some generations emit no
    // session.idle).
    if (payload.type === "message.updated") {
      const info = props.info as { id?: string; role?: string; time?: { completed?: number } } | undefined
      if (info?.role === "user" && typeof info.id === "string") state.userMessages.add(info.id)
      if (info?.role === "assistant" && info.time?.completed) finishAll(state)
      return
    }

    if (TEXT_EVENTS.has(payload.type)) {
      const part = props.part as { id?: string; type?: string; text?: string; messageID?: string } | undefined
      let partID: string
      if (
        part &&
        part.type === "text" &&
        typeof part.text === "string" &&
        typeof part.id === "string" &&
        typeof part.messageID === "string" &&
        !state.userMessages.has(part.messageID) // never stream the operator's own text back
      ) {
        partID = part.id
        state.textByPart.set(partID, part.text)
      } else if (typeof props.delta === "string") {
        // delta-style event (session.next.text.delta): inherently assistant text
        partID = typeof props.textID === "string" ? props.textID : "delta"
        state.textByPart.set(partID, (state.textByPart.get(partID) ?? "") + props.delta)
      } else {
        return
      }
      const text = state.textByPart.get(partID)!
      if (text) void streamerFor(state, partID).push(text) // each part -> its own message
      return
    }

    if (DONE_EVENTS.has(payload.type)) finishAll(state)
  }

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
    // Fresh per-part streamer map + text buffers for this turn's reply (streamers are
    // created lazily as each assistant text part arrives — one message per part).
    sessions.set(sessionID, { chatId, streamers: new Map(), textByPart: new Map(), userMessages: new Set() })
    await deps.sdk.session.promptAsync(restrictedPrompt({ sessionID, text, agent: deps.agent, files }), { throwOnError: true })
  }

  const onCallback = (query: TgCallbackQuery): Promise<void> => permissions.onCallback({ id: query.id, data: query.data })

  // Subscribe to the firehose BEFORE polling so no early events are missed.
  // Frames are routing-wrapped on /global/event ({ payload: {type,properties} }) but
  // raw on /event; tolerate both by unwrapping payload when present.
  const events = await deps.sdk.global.event({ signal: deps.signal })
  type Frame = { type?: string; properties?: Record<string, unknown>; payload?: { type: string; properties?: Record<string, unknown> } }
  const stream = events.stream as AsyncIterator<Frame>
  const pump = (async () => {
    while (!deps.signal.aborted) {
      const next = await stream.next().catch(() => ({ done: true, value: undefined }) as IteratorResult<Frame>)
      if (next.done) break
      const frame = next.value
      const evt = frame?.payload ?? frame
      if (evt && typeof evt.type === "string") onEvent({ type: evt.type, properties: evt.properties })
    }
  })()

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
  await pump.catch(() => {})
}
