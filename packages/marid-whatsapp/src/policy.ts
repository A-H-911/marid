import type { FilePartInput } from "@opencode-ai/sdk/v2"

// Channel capability policy (FR-052, INV-001, AC-018 "no tool/permission widening").
//
// The adapter carries a `channel:` token and NEVER re-implements policy — INV-001 is
// enforced SERVER-side by @marid/gateway. This function's job is therefore narrow and
// negative: build a prompt body that contains ONLY what a channel token is allowed to
// send, so the gateway's bound-agent backstop has nothing to reject.
//
// The gateway 403s a channel-token prompt that (a) omits its bound agent, or (b) carries
// `tools` or `permission` overrides. We do not send them — not as a policy decision here,
// but so a bug can't smuggle them. The negative test (marid-gateway) is the real gate;
// this is the shape that keeps us on the allowed side of it.
//
// `messageID` is deliberately NOT client-supplied (same as marid-telegram/policy.ts).

export interface RestrictedPromptInput {
  sessionID: string
  text: string
  agent: string
  files?: FilePartInput[]
}

export interface RestrictedPrompt {
  sessionID: string
  agent: string
  parts: Array<{ type: "text"; text: string } | FilePartInput>
}

export function restrictedPrompt(input: RestrictedPromptInput): RestrictedPrompt {
  return {
    sessionID: input.sessionID,
    agent: input.agent,
    parts: [{ type: "text", text: input.text }, ...(input.files ?? [])],
  }
}
