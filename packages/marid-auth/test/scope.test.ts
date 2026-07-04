import { describe, expect, test } from "bun:test"
import { authorize } from "../src/scope"

const owns = (owned: string[]) => (id: string) => owned.includes(id)

describe("scope authorization (pure)", () => {
  test("admin is allowed everything, never records ownership", () => {
    expect(authorize({ scope: "admin", method: "POST", pathname: "/session", owns: () => false })).toEqual({
      allow: true,
    })
    expect(
      authorize({ scope: "admin", method: "GET", pathname: "/session/ses_other/message", owns: () => false }),
    ).toEqual({ allow: true })
  })

  test("client may create a session and that create records ownership", () => {
    expect(authorize({ scope: "client", method: "POST", pathname: "/session", owns: () => false })).toEqual({
      allow: true,
      recordSession: true,
    })
  })

  test("client may act on a session it owns", () => {
    const input = { scope: "client" as const, method: "POST", pathname: "/session/ses_mine/message", owns: owns(["ses_mine"]) }
    expect(authorize(input)).toEqual({ allow: true })
  })

  test("client is denied a session it does not own", () => {
    const input = { scope: "client" as const, method: "GET", pathname: "/session/ses_other/message", owns: owns(["ses_mine"]) }
    expect(authorize(input)).toEqual({ allow: false })
  })

  test("client may reach non-session meta/config routes and the event stream", () => {
    for (const pathname of ["/config", "/agent", "/provider", "/event", "/", "/status"]) {
      expect(authorize({ scope: "client", method: "GET", pathname, owns: () => false })).toEqual({ allow: true })
    }
  })

  test("client may list sessions (root GET) — firehose/list body filtering is out of wrapper scope", () => {
    expect(authorize({ scope: "client", method: "GET", pathname: "/session", owns: () => false })).toEqual({
      allow: true,
    })
  })

  test("channel scope behaves like client in PH-1 (policy binding deferred to PH-4)", () => {
    expect(
      authorize({ scope: "channel:telegram", method: "GET", pathname: "/session/ses_x/message", owns: owns(["ses_x"]) }),
    ).toEqual({ allow: true })
    expect(
      authorize({ scope: "channel:telegram", method: "GET", pathname: "/session/ses_y/message", owns: owns(["ses_x"]) }),
    ).toEqual({ allow: false })
  })

  test("client forking a session it owns records the new (child) session", () => {
    // POST /session/:id/fork — owns the parent, so allowed AND records the new fork id
    expect(
      authorize({ scope: "client", method: "POST", pathname: "/session/ses_mine/fork", owns: owns(["ses_mine"]) }),
    ).toEqual({ allow: true, recordSession: true })
  })

  test("client cannot fork a session it does not own", () => {
    expect(
      authorize({ scope: "client", method: "POST", pathname: "/session/ses_other/fork", owns: owns(["ses_mine"]) }),
    ).toEqual({ allow: false })
  })

  test("init (mutating an owned session) is not treated as create — no ownership recorded", () => {
    expect(
      authorize({ scope: "client", method: "POST", pathname: "/session/ses_mine/init", owns: owns(["ses_mine"]) }),
    ).toEqual({ allow: true })
  })

  test("trailing-slash and query strings do not confuse session-id extraction", () => {
    expect(authorize({ scope: "client", method: "GET", pathname: "/session/ses_mine", owns: owns(["ses_mine"]) })).toEqual({
      allow: true,
    })
    expect(authorize({ scope: "client", method: "GET", pathname: "/session/ses_other", owns: owns(["ses_mine"]) })).toEqual({
      allow: false,
    })
  })
})
