// Capability policy wiring (WBS-4.4, INV-001). Every prompt the gateway sends pins
// the channel's restricted agent. The gateway does NOT pass tools/permission
// overrides — the restricted agent's own config ruleset (bash:deny, edit:deny, …)
// is the single source of truth, and marid-auth rejects a channel prompt that
// tries to widen them. So this body carries only agent + parts.
//
// messageID is intentionally NOT client-supplied: the server's message IDs are
// timestamp-ordered, and a fabricated id would corrupt history ordering. Idempotency
// against redelivered updates is provided by the update_id dedup store (dedup.ts),
// not a client message id.

import type { FilePartInput } from "@opencode-ai/sdk/v2"

export interface PromptBody {
  sessionID: string
  agent: string
  parts: Array<{ type: "text"; text: string } | FilePartInput>
}

// Telegram message content is wrapped as a plain user text part — i.e. as DATA,
// never as instructions or a system/tool position (INV-004). Inbound attachments ride
// along as file parts (the file lands in the workspace as data, not executed); their
// download URL embeds the bot token and must never be logged (INV-002, media.ts).
export function restrictedPrompt(input: {
  sessionID: string
  text: string
  agent: string
  files?: FilePartInput[]
}): PromptBody {
  return {
    sessionID: input.sessionID,
    agent: input.agent,
    parts: [{ type: "text", text: input.text }, ...(input.files ?? [])],
  }
}
