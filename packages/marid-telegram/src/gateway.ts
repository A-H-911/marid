import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import type { BotApi } from "./bot-api"
import { createDedup } from "./dedup"
import { inboundNote } from "./media"
import { createPermissions, type ReplyDecision, type Timer } from "./permission"
import { restrictedPrompt } from "./policy"
import { runRouter } from "./router"
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

const TEXT_EVENTS = new Set(["message.part.updated", "message.updated", "session.next.text.delta"])
const DONE_EVENTS = new Set(["session.idle", "session.next.step.ended"])
const ASK_EVENTS = new Set(["permission.asked", "permission.updated"])

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

// A session's live per-turn state: the chat it belongs to, its current streamer,
// and the accumulated text parts (keyed by partID, insertion-ordered) for this turn.
interface SessionState {
  chatId: number
  streamer: Streamer
  textByPart: Map<string, string>
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

  const currentText = (state: SessionState) => [...state.textByPart.values()].join("")

  function onEvent(payload: { type: string; properties?: Record<string, unknown> }): void {
    const props = payload.properties ?? {}
    const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined
    if (ASK_EVENTS.has(payload.type)) {
      const id = typeof props.id === "string" ? props.id : undefined
      if (id && sessionID) {
        void permissions.onAsk({ id, sessionID, title: typeof props.title === "string" ? props.title : undefined })
      }
      return
    }
    if (!sessionID) return
    const state = sessions.get(sessionID)
    if (!state) return // not one of our sessions
    if (TEXT_EVENTS.has(payload.type)) {
      const part = props.part as { id?: string; type?: string; text?: string } | undefined
      if (part && part.type === "text" && typeof part.text === "string" && typeof part.id === "string") {
        state.textByPart.set(part.id, part.text)
      } else if (typeof props.delta === "string") {
        // delta-style event (session.next.text.delta): append under a stable key
        const key = typeof props.textID === "string" ? props.textID : "delta"
        state.textByPart.set(key, (state.textByPart.get(key) ?? "") + props.delta)
      }
      const text = currentText(state)
      if (text) void state.streamer.push(text)
      return
    }
    if (DONE_EVENTS.has(payload.type)) {
      const text = currentText(state)
      if (text) void state.streamer.finish(text)
    }
  }

  async function onMessage(message: TgMessage): Promise<void> {
    const base = message.text ?? message.caption ?? ""
    const note = inboundNote(message) // media surfaced as untrusted DATA (INV-004)
    const text = base && note ? `${base}\n${note}` : base || note || ""
    if (!text) return // nothing to prompt with
    const chatId = message.chat.id
    let sessionID = chatToSession.get(chatId)
    if (!sessionID) {
      const created = await deps.sdk.session.create({ agent: deps.agent }, { throwOnError: true })
      sessionID = created.data.id
      chatToSession.set(chatId, sessionID)
    }
    // Fresh streamer + text buffer for this turn's reply.
    const streamer = createStreamer({
      bot: deps.bot,
      chatId,
      now: deps.now,
      sleep: deps.sleep,
      cadenceMs: deps.cadenceMs,
    })
    sessions.set(sessionID, { chatId, streamer, textByPart: new Map() })
    await deps.sdk.session.promptAsync(
      restrictedPrompt({ sessionID, updateId: message.message_id, text, agent: deps.agent }),
      { throwOnError: true },
    )
  }

  const onCallback = (query: TgCallbackQuery): Promise<void> => permissions.onCallback({ id: query.id, data: query.data })

  // Subscribe to the firehose BEFORE polling so no early events are missed.
  const events = await deps.sdk.global.event({ signal: deps.signal })
  const stream = events.stream as AsyncIterator<{ payload?: { type: string; properties?: Record<string, unknown> } }>
  const pump = (async () => {
    while (!deps.signal.aborted) {
      const next = await stream.next().catch(() => ({ done: true, value: undefined }) as IteratorResult<never>)
      if (next.done) break
      if (next.value?.payload) onEvent(next.value.payload)
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
