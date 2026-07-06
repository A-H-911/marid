import { describe, expect, test } from "bun:test"
import { restrictedPrompt } from "../src/policy"

// WBS-4.4: the gateway pins the restricted agent on every prompt and never sends
// tools/permission (marid-auth would 403 a channel token that did).
describe("restrictedPrompt", () => {
  const body = restrictedPrompt({ sessionID: "ses_1", updateId: 55, text: "hello", agent: "telegram-channel" })

  test("pins the bound agent", () => {
    expect(body.agent).toBe("telegram-channel")
  })

  test("uses a deterministic messageID derived from the update_id (idempotent redelivery)", () => {
    expect(body.messageID).toBe("tg-55")
  })

  test("wraps the message as a single user text part (INV-004: content is data)", () => {
    expect(body.parts).toEqual([{ type: "text", text: "hello" }])
  })

  test("carries no tools or permission override", () => {
    expect("tools" in body).toBe(false)
    expect("permission" in body).toBe(false)
  })
})
