// Capability policy wiring (WBS-4.4, INV-001). Every prompt the gateway sends pins
// the channel's restricted agent. The gateway does NOT pass tools/permission
// overrides — the restricted agent's own config ruleset (bash:deny, edit:deny, …)
// is the single source of truth, and marid-auth rejects a channel prompt that
// tries to widen them. So this body carries only agent + parts + a deterministic
// messageID (= the Telegram update_id) that makes a redelivered update idempotent.

export interface PromptBody {
  sessionID: string
  messageID: string
  agent: string
  parts: Array<{ type: "text"; text: string }>
}

// Telegram message content is wrapped as a plain user text part — i.e. as DATA,
// never as instructions or a system/tool position (INV-004).
export function restrictedPrompt(input: {
  sessionID: string
  updateId: number
  text: string
  agent: string
}): PromptBody {
  return {
    sessionID: input.sessionID,
    messageID: `tg-${input.updateId}`,
    agent: input.agent,
    parts: [{ type: "text", text: input.text }],
  }
}
