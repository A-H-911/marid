import { describe, expect, test } from "bun:test"
import { parseAskEvent } from "../src/gateway"

// Locks the gateway's permission-ask field extraction against the committed v1
// PermissionRequest schema (packages/schema/src/v1/permission.ts): the event
// carries `id`, `sessionID`, and `permission` — NOT `title`. The live E2E cannot
// drive a real permission (the openai-compatible test provider does not forward
// tools to the model), so this schema-shaped unit test is the regression guard for
// the wiring the advisor flagged.

// A permission.asked payload exactly as Request.fields defines it.
const asked = {
  type: "permission.asked",
  properties: {
    id: "per_abc123",
    sessionID: "ses_xyz789",
    permission: "bash",
    patterns: ["*"],
    metadata: {},
    always: [],
  },
}

describe("parseAskEvent", () => {
  test("extracts id (the reply requestID) and sessionID from a schema-shaped event", () => {
    expect(parseAskEvent(asked)).toEqual({ id: "per_abc123", sessionID: "ses_xyz789", title: "bash" })
  })

  test("uses `permission` (not a non-existent `title`) as the label", () => {
    const ask = parseAskEvent(asked)
    expect(ask?.title).toBe("bash")
  })

  test("tolerates the alternate committed type permission.updated", () => {
    expect(parseAskEvent({ ...asked, type: "permission.updated" })?.id).toBe("per_abc123")
  })

  test("ignores non-ask events", () => {
    expect(parseAskEvent({ type: "message.part.updated", properties: { id: "x", sessionID: "s" } })).toBeUndefined()
  })

  test("returns undefined when id or sessionID is missing (never surfaces a broken prompt)", () => {
    expect(parseAskEvent({ type: "permission.asked", properties: { sessionID: "ses_x" } })).toBeUndefined()
    expect(parseAskEvent({ type: "permission.asked", properties: { id: "per_x" } })).toBeUndefined()
  })
})
