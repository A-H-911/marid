import { describe, expect, test } from "bun:test"
import { restrictedPrompt } from "../src/policy"

// WBS-4.4: the gateway pins the restricted agent on every prompt and never sends
// tools/permission (marid-auth would 403 a channel token that did).
describe("restrictedPrompt", () => {
  const body = restrictedPrompt({ sessionID: "ses_1", text: "hello", agent: "telegram-channel" })

  test("pins the bound agent", () => {
    expect(body.agent).toBe("telegram-channel")
  })

  test("wraps the message as a single user text part (INV-004: content is data)", () => {
    expect(body.parts).toEqual([{ type: "text", text: "hello" }])
  })

  test("carries no client messageID (server generates ordered ids), tools, or permission override", () => {
    expect("messageID" in body).toBe(false)
    expect("tools" in body).toBe(false)
    expect("permission" in body).toBe(false)
  })

  test("inbound file parts ride along after the text part (defect 2)", () => {
    const withFile = restrictedPrompt({
      sessionID: "ses_1",
      text: "see attached",
      agent: "telegram-channel",
      files: [{ type: "file", mime: "application/pdf", filename: "report.pdf", url: "https://x/y" }],
    })
    expect(withFile.parts).toEqual([
      { type: "text", text: "see attached" },
      { type: "file", mime: "application/pdf", filename: "report.pdf", url: "https://x/y" },
    ])
  })
})
