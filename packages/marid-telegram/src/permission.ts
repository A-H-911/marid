import type { BotApi } from "./bot-api"

// Permission approvals as Telegram inline keyboards (WBS-4.3, AC-012, FR-028).
//
// A permission ask (server event) becomes an Approve/Deny keyboard. Approve, Deny,
// and the deny-on-timeout all funnel through ONE resolve() that claims the pending
// entry SYNCHRONOUSLY (sets `claimed` before any await). Because JS is single-
// threaded, that check-and-set is atomic, so the server sees exactly one reply no
// matter how the buttons are mashed: double-tap, Approve-then-Deny, a callback that
// lands after the timeout, or a callback redelivered after a gateway restart all
// lose the claim. Deny wins on timeout.
//
// SDK-free by injection: reply() (the server permission reply) and the clock
// (timers) are injected, so the whole flow is unit-tested deterministically without
// a live server or real timers.

export type ReplyDecision = "once" | "reject"

// Normalized from whichever ask event the server emits (permission.asked ∨
// permission.updated — both are in the committed manifest).
export interface PermissionAsk {
  id: string
  sessionID: string
  title?: string
}

export interface Timer {
  set(callback: () => void, ms: number): () => void // returns a cancel function
}

export interface PermissionDeps {
  bot: Pick<BotApi, "sendMessage" | "editMessageText" | "answerCallbackQuery">
  reply(sessionID: string, permissionID: string, decision: ReplyDecision): Promise<void>
  chatOf(sessionID: string): number | undefined
  timers: Timer
  timeoutMs: number
  log: (line: string) => void
}

export interface Permissions {
  onAsk(ask: PermissionAsk): Promise<void>
  onCallback(query: { id: string; data?: string }): Promise<void>
  // Feed an inbound operator message here BEFORE prompting the agent (ADR-0022, #13). Returns true
  // if it was a quote-reply approval (consumed — the caller does NOT treat it as a prompt); false
  // otherwise, which flows on to the agent. A non-approval message while an approval is pending in
  // that chat is acked as a side effect (still returns false — the message flows on, unchanged).
  onReply(chatId: number, text: string, quotedMessageId?: number): Promise<boolean>
  recover(asks: PermissionAsk[]): Promise<void>
  pendingCount(): number
}

interface Pending {
  sessionID: string
  chatId: number
  messageId?: number
  cancel: () => void
  claimed: boolean
}

function keyboard(permissionID: string) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `p:${permissionID}:a` },
        { text: "🚫 Deny", callback_data: `p:${permissionID}:d` },
      ],
    ],
  }
}

// callback_data is our own opaque string "p:<permissionID>:<a|d>". Parsed by
// stripping the fixed "p:" prefix and ":<action>" suffix so a permissionID
// containing a ":" is still handled.
function parseCallback(data?: string): { permissionID: string; decision: ReplyDecision } | undefined {
  if (!data || !data.startsWith("p:") || data[data.length - 2] !== ":") return undefined
  const permissionID = data.slice(2, -2)
  if (!permissionID) return undefined
  const action = data[data.length - 1]
  if (action === "a") return { permissionID, decision: "once" }
  if (action === "d") return { permissionID, decision: "reject" }
  return undefined
}

// Plain text (no parse_mode): the tool/title comes from untrusted model output, so
// not interpreting it as HTML avoids an injection vector in the prompt itself.
function askText(ask: PermissionAsk): string {
  return `The agent needs approval to run: ${ask.title ?? "a tool"}\nApprove?`
}

// ADR-0022 quote-reply grammar. RELAXED (approve/yes/y/ok/👍 · deny/no/n/👎) because the binding is
// the QUOTE — an unforgeable reference to the exact prompt the operator saw — not a secret. It is
// only ever consulted WITH a quoted id that matches a live prompt in the same chat, so a bare "yes"
// never authorizes anything (INV-004). Inline buttons remain the primary, safer path. (These ~2
// regexes are duplicated from marid-whatsapp/src/approval.ts rather than shared — extracting them
// would couple two sibling channel packages for no real gain.)
const QUOTE_APPROVE = /^(approve|yes|y|ok|👍)$/
const QUOTE_DENY = /^(deny|no|n|👎)$/
function parseQuoteReply(text: string): ReplyDecision | undefined {
  const t = text.trim().toLowerCase()
  if (QUOTE_APPROVE.test(t)) return "once"
  if (QUOTE_DENY.test(t)) return "reject"
  return undefined
}

// #13: shown when the operator sends a non-approval message while an approval is pending. Points
// back to the still-visible inline keyboard (Telegram buttons stay on-screen) rather than a token.
const PENDING_ACK =
  "Still waiting on your approval — tap ✅ Approve or 🚫 Deny on the prompt above (or it will time out)."

export function createPermissions(deps: PermissionDeps): Permissions {
  const pending = new Map<string, Pending>()

  async function resolve(permissionID: string, decision: ReplyDecision, note: string): Promise<boolean> {
    const p = pending.get(permissionID)
    if (!p || p.claimed) return false
    p.claimed = true // claim BEFORE any await — exactly-once guarantee
    p.cancel()
    pending.delete(permissionID)
    await deps.reply(p.sessionID, permissionID, decision).catch((e: unknown) => {
      deps.log(`permission ${permissionID}: server reply failed: ${e instanceof Error ? e.message : String(e)}`)
    })
    if (p.messageId !== undefined) {
      await deps.bot.editMessageText(p.chatId, p.messageId, note).catch(() => {})
    }
    return true
  }

  async function onAsk(ask: PermissionAsk): Promise<void> {
    if (pending.has(ask.id)) return
    const chatId = deps.chatOf(ask.sessionID)
    if (chatId === undefined) {
      deps.log(`permission ${ask.id}: no chat bound to session ${ask.sessionID}; not surfaced`)
      return
    }
    const entry: Pending = { sessionID: ask.sessionID, chatId, claimed: false, cancel: () => {} }
    pending.set(ask.id, entry)
    const sent = await deps.bot
      .sendMessage(chatId, askText(ask), { reply_markup: keyboard(ask.id) })
      .catch((e: unknown) => {
        deps.log(`permission ${ask.id}: sendMessage failed: ${e instanceof Error ? e.message : String(e)}`)
        return undefined
      })
    if (!pending.has(ask.id)) return // already resolved while sending
    if (sent) entry.messageId = sent.message_id
    // Deny wins on timeout: an unanswered prompt is rejected after timeoutMs.
    entry.cancel = deps.timers.set(() => void resolve(ask.id, "reject", "Timed out — denied"), deps.timeoutMs)
  }

  async function onCallback(query: { id: string; data?: string }): Promise<void> {
    const parsed = parseCallback(query.data)
    if (!parsed) {
      await deps.bot.answerCallbackQuery(query.id, "Unrecognized").catch(() => {})
      return
    }
    const note = parsed.decision === "once" ? "✅ Approved" : "🚫 Denied"
    const handled = await resolve(parsed.permissionID, parsed.decision, note)
    await deps.bot.answerCallbackQuery(query.id, handled ? note : "Already handled").catch(() => {})
  }

  // Is there a live approval bound to this chat? (#13 ack, and a cheap short-circuit.)
  function pendingChatHas(chatId: number): boolean {
    for (const p of pending.values()) if (p.chatId === chatId) return true
    return false
  }

  async function onReply(chatId: number, text: string, quotedMessageId?: number): Promise<boolean> {
    // ADR-0022: a quote-reply is honored ONLY when it quotes a live prompt in THIS chat — the
    // quoted-id match IS the authorization (cf. WhatsApp redeemQuote). resolve() keeps the
    // exactly-once claim shared with the buttons and the timeout-deny.
    if (quotedMessageId !== undefined) {
      const decision = parseQuoteReply(text)
      if (decision) {
        for (const [permissionID, p] of pending) {
          if (p.messageId === quotedMessageId && p.chatId === chatId) {
            await resolve(permissionID, decision, decision === "once" ? "✅ Approved" : "🚫 Denied")
            return true
          }
        }
      }
    }
    // #13: a normal message while an approval is pending draws no response otherwise (the run is
    // suspended on the gate). Ack it, but do NOT consume — normal chat still flows to the agent,
    // and the gate is untouched (this never approves).
    if (pendingChatHas(chatId)) await deps.bot.sendMessage(chatId, PENDING_ACK).catch(() => {})
    return false
  }

  // After a restart the in-memory map is empty and /event is live-only, so re-render
  // keyboards for asks the server still lists as pending (GET /permission).
  async function recover(asks: PermissionAsk[]): Promise<void> {
    for (const ask of asks) if (!pending.has(ask.id)) await onAsk(ask)
  }

  return { onAsk, onCallback, onReply, recover, pendingCount: () => pending.size }
}
