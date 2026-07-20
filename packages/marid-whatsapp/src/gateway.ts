import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { createChannelClient } from "@marid/channel-client"
import { denialMessage, isAllowed } from "./allowlist"
import type { InboundMessage, WhatsAppClient } from "./client"
import { createDedup } from "./dedup"
import { inboundFileParts, inboundNote, resolveOutboundBytes } from "./media"
import { createPermissions, type Timer } from "./permission"
import { restrictedPrompt } from "./policy"
import { createStreamer } from "./stream"

// Composition root for the WhatsApp gateway (WBS-7.1..7.4 wiring). One process, one
// operator, one WAHA session. Structurally the twin of marid-telegram/gateway.ts — same
// channel-client reuse, same subscribe-then-consume order, same session↔chat binding —
// with three WhatsApp-specific differences:
//
//  1. INBOUND is a WebSocket the WAHA client dials out on (client.onMessage), not a
//     long-poll router. No update_id offset: dedup is a seen-id set (dedup.ts).
//  2. PERMISSION replies are TEXT, so every inbound text from an allowlisted sender goes
//     through permissions.onReply FIRST; only if it is NOT an approval does it become a
//     prompt (approval.ts / ADR-0015).
//  3. There is no slash UI. `/help` and `/new` are still handled as plain-text commands,
//     deny-by-default like Telegram, but parsed here rather than via a routeSlash module.
//
// The channel-agnostic half (firehose subscribe/pump, event interpretation, per-part
// streamer coordination, reconnect + re-fetch recovery, attach re-subscribe) is
// @marid/channel-client, unchanged (ADR-0011 — it names WhatsApp as its second consumer).

export { parseAskEvent } from "@marid/channel-client"

export interface RunGatewayDeps {
  sdk: OpencodeClient
  client: WhatsAppClient
  allow: ReadonlySet<string>
  agent: string
  session: string // the WAHA session name (for logging/context)
  // The single operator's JID: the sink for a BOUND (attached, non-owned) session mirrored
  // in from web/TUI that has no chat of its own. Unset → bound sessions render nowhere.
  defaultJid?: string
  pollBindings?: () => Promise<Set<string>>
  bindingPollMs?: number
  dedupFile: string
  now(): number
  sleep(ms: number): Promise<void>
  timers: Timer
  cadenceMs?: number
  permissionTimeoutMs?: number
  approvalTtlMs?: number
  log: (line: string) => void
  signal: AbortSignal
}

const HELP_TEXT =
  "Commands:\n/new — start a fresh session\n/help — show this help\n\nAny other message is sent to the agent."

export async function runGateway(deps: RunGatewayDeps): Promise<void> {
  const dedup = createDedup(deps.dedupFile)
  const jidToSession = new Map<string, string>()
  // Reverse binding (session → jid) so an inbound event knows which chat to render into.
  const sessionJid = new Map<string, string>()

  const permissions = createPermissions({
    send: (sessionID, text) => {
      const jid = sessionJid.get(sessionID) ?? deps.defaultJid
      return jid ? deps.client.sendText(jid, text).then(() => undefined) : Promise.resolve()
    },
    // Ownership-gated session-scoped route — NEVER the flat /permission/:id/reply (the
    // wrapper cannot ownership-gate an opaque per_ id). The channel allowlist permits this one.
    reply: (sessionID, permissionID, decision) =>
      deps.sdk.permission.respond({ sessionID, permissionID, response: decision }, { throwOnError: true }).then(() => undefined),
    jidOf: (sessionID) => sessionJid.get(sessionID) ?? deps.defaultJid,
    now: deps.now,
    timers: deps.timers,
    timeoutMs: deps.permissionTimeoutMs ?? 300_000,
    approvalTtlMs: deps.approvalTtlMs ?? 300_000,
    log: deps.log,
  })

  const client = createChannelClient({
    sdk: deps.sdk,
    signal: deps.signal,
    sleep: deps.sleep,
    pollBindings: deps.pollBindings,
    bindingPollMs: deps.bindingPollMs,
    createStreamer: (sessionID) => {
      const jid = sessionJid.get(sessionID) ?? deps.defaultJid
      if (jid === undefined) return { push: async () => {}, finish: async () => {} }
      return createStreamer({ client: deps.client, jid, now: deps.now, cadenceMs: deps.cadenceMs, log: deps.log })
    },
    onAsk: (ask) => void permissions.onAsk(ask),
    onFile: (sessionID, file) => {
      const jid = sessionJid.get(sessionID) ?? deps.defaultJid
      if (jid === undefined) return
      const name = file.filename ?? (file.mime.startsWith("image/") ? "image" : "file")
      void resolveOutboundBytes(file.url)
        .then((bytes) => {
          if (!bytes) {
            deps.log("outbound file: could not resolve bytes; skipped")
            return
          }
          return deps.client.sendMedia(jid, { bytes, mimetype: file.mime, filename: name })
        })
        .catch((e) => deps.log(`outbound file send failed: ${String(e)}`))
    },
  })

  async function handleCommand(name: string, jid: string): Promise<boolean> {
    if (name === "new") {
      jidToSession.delete(jid)
      await deps.client.sendText(jid, "Started a new session.")
      return true
    }
    if (name === "help") {
      await deps.client.sendText(jid, HELP_TEXT)
      return true
    }
    await deps.client.sendText(jid, `Unknown command: /${name}. Try /help.`)
    return true
  }

  async function onInbound(message: InboundMessage): Promise<void> {
    if (message.fromMe) return // our own outbound echoed back on message.any-style frames
    const jid = message.from
    // INV-001 / B1: deny-by-default. A stranger is logged and dropped — no session, no reply.
    // The log names the exact JID (may be an opaque `@lid` on modern WhatsApp) so the
    // operator can self-add it — the only recovery surface, since we can't reply (F1).
    if (!isAllowed(jid, deps.allow)) {
      deps.log(denialMessage(jid))
      return
    }
    // Idempotency: WhatsApp/WAHA may redeliver on reconnect (at-least-once). commit AFTER.
    if (await dedup.seen(message.id)) return

    const base = message.body ?? ""

    // PERMISSION FIRST (ADR-0015): an allowlisted sender's text may be an APPROVE/DENY
    // reply. If so it is consumed here and never reaches the agent.
    if (await permissions.onReply(jid, base)) {
      await dedup.commit(message.id)
      return
    }

    // Deny-by-default slash commands (no native slash UI — parsed as plain text).
    if (base.startsWith("/")) {
      const name = base.slice(1).split(/\s+/)[0]?.toLowerCase() ?? ""
      await handleCommand(name, jid)
      await dedup.commit(message.id)
      return
    }

    const note = inboundNote(message) // media as untrusted DATA (INV-004)
    const text = base && note ? `${base}\n${note}` : base || note || ""
    const files = await inboundFileParts(message, deps.client)
    if (!text && files.length === 0) {
      await dedup.commit(message.id)
      return
    }
    if (files.length > 0) deps.log(`attached ${files.length} inbound file part(s)`)

    let sessionID = jidToSession.get(jid)
    if (!sessionID) {
      const created = await deps.sdk.session.create({ agent: deps.agent }, { throwOnError: true })
      sessionID = created.data.id
      jidToSession.set(jid, sessionID)
    }
    // Bind reverse map + start a fresh per-part reply BEFORE prompting.
    sessionJid.set(sessionID, jid)
    client.beginTurn(sessionID)
    // Drive the SYNC prompt route DETACHED (same rationale as Telegram: promptAsync forks
    // off the request scope and resolves a ZERO toolset). Fire-and-forget; the reply
    // renders via the SSE firehose. See docs/execution/telegram-channel-tools.md.
    void deps.sdk.session
      .prompt(restrictedPrompt({ sessionID, text, agent: deps.agent, files }), { throwOnError: true })
      .catch((e) => deps.log(`prompt failed: ${String(e)}`))

    await dedup.commit(message.id)
  }

  // Register the inbound sink BEFORE connecting so no frame is missed, and subscribe to
  // the firehose BEFORE the WAHA socket for the same reason (it is live-only).
  deps.client.onMessage((m) => void onInbound(m).catch((e) => deps.log(`inbound handler failed: ${String(e)}`)))
  const { done } = await client.start()
  await deps.client.connect()
  await done.catch(() => {})
}
