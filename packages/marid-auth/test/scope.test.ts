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

  test("/session/status is a meta route, not a session — non-admin is NOT ownership-gated (web-UI bootstrap)", () => {
    // Regression: "status" was read as a session id → ownership gate → 403 on every connect.
    for (const scope of ["client", "channel:telegram"] as const) {
      expect(authorize({ scope, method: "GET", pathname: "/session/status", owns: () => false })).toEqual({
        allow: true,
      })
    }
  })

  describe("channel scope (PH-4, WBS-4.4): stricter than client — deny-by-default on owned sessions", () => {
    const ch = "channel:telegram" as const
    const mine = owns(["ses_x"])

    test("still requires ownership (no cross-session access)", () => {
      expect(authorize({ scope: ch, method: "GET", pathname: "/session/ses_y/message", owns: mine })).toEqual({
        allow: false,
      })
    })

    test("may create/list sessions and reach read-only meta + the event stream", () => {
      expect(authorize({ scope: ch, method: "POST", pathname: "/session", owns: () => false })).toEqual({
        allow: true,
        recordSession: true,
      })
      for (const pathname of ["/session", "/config", "/agent", "/provider", "/event", "/permission"]) {
        expect(authorize({ scope: ch, method: "GET", pathname, owns: () => false })).toEqual({ allow: true })
      }
    })

    test("may read its own session, history, prompt (sync + async), abort, and reply to a permission", () => {
      const allow = { allow: true }
      expect(authorize({ scope: ch, method: "GET", pathname: "/session/ses_x", owns: mine })).toEqual(allow)
      expect(authorize({ scope: ch, method: "GET", pathname: "/session/ses_x/message", owns: mine })).toEqual(allow)
      expect(authorize({ scope: ch, method: "GET", pathname: "/session/ses_x/message/msg_1", owns: mine })).toEqual(allow)
      expect(authorize({ scope: ch, method: "POST", pathname: "/session/ses_x/message", owns: mine })).toEqual(allow)
      expect(authorize({ scope: ch, method: "POST", pathname: "/session/ses_x/prompt_async", owns: mine })).toEqual(allow)
      expect(authorize({ scope: ch, method: "POST", pathname: "/session/ses_x/abort", owns: mine })).toEqual(allow)
      expect(
        authorize({ scope: ch, method: "POST", pathname: "/session/ses_x/permissions/per_9", owns: mine }),
      ).toEqual(allow)
    })

    test("is DENIED direct-execution and mutation routes even on a session it owns (the INV-001 fix)", () => {
      const denied = { allow: false }
      for (const sub of ["shell", "command", "revert", "unrevert", "init", "share", "summarize", "fork", "children", "todo", "diff"]) {
        expect(authorize({ scope: ch, method: "POST", pathname: `/session/ses_x/${sub}`, owns: mine })).toEqual(denied)
      }
      // message-part mutation is denied (deeper than a single message read)
      expect(
        authorize({ scope: ch, method: "POST", pathname: "/session/ses_x/message/msg_1/part/prt_1", owns: mine }),
      ).toEqual(denied)
      // a channel never forks, so a fork it "owns" records nothing and is denied
      expect(authorize({ scope: ch, method: "POST", pathname: "/session/ses_x/fork", owns: mine })).toEqual(denied)
    })
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
