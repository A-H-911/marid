import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { authorize } from "../src/scope"
import { createMaridAuth } from "../src/middleware"
import { createTokenStore } from "../src/token"
import { createOwnershipStore } from "../src/ownership"
import { createBindingStore } from "../src/binding"
import { createAuditLog } from "../src/audit"
import { createRateLimiter } from "../src/ratelimit"

// INV-001 regression: an untrusted `channel:` token must NOT reach the top-level
// /pty shell surface. /pty is NOT a /session route, so the deny-by-default channel
// allowlist (channelOwnedRouteAllowed) never runs for it — scope.ts returned ALLOW
// for every non-/session route. Combined with marid/serve.ts deleting
// OPENCODE_SERVER_PASSWORD (upstream pty auth becomes pass-through), a channel token
// could POST /pty (spawn a shell), mint a connect-token, and open the WS — arbitrary
// command execution outside the agent/permission model. These tests pin the fix.

let dir: string
const bearer = (secret: string) => ({ authorization: `Bearer ${secret}`, "content-type": "application/json" })

async function build() {
  const tokens = createTokenStore(dir)
  const ownership = createOwnershipStore(dir)
  const bindings = createBindingStore(dir)
  const audit = createAuditLog(dir, { date: () => "2026-07-19" })
  const auth = createMaridAuth({ tokens, ownership, bindings, audit, limiter: createRateLimiter() })
  return { tokens, auth }
}

const reachedUpstream = () => async () =>
  new Response(JSON.stringify([{ path: "/bin/bash", name: "bash", acceptable: true }]), {
    status: 200,
    headers: { "content-type": "application/json" },
  })

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-auth-pty-"))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe("channel scope is denied the top-level /pty shell surface (INV-001)", () => {
  const owns = () => false
  const ptyRoutes: Array<{ method: string; pathname: string }> = [
    { method: "GET", pathname: "/pty/shells" },
    { method: "GET", pathname: "/pty" },
    { method: "POST", pathname: "/pty" },
    { method: "GET", pathname: "/pty/pty_1" },
    { method: "PUT", pathname: "/pty/pty_1" },
    { method: "DELETE", pathname: "/pty/pty_1" },
    { method: "POST", pathname: "/pty/pty_1/connect-token" },
    { method: "GET", pathname: "/pty/pty_1/connect" },
  ]

  test("authorize() denies channel scope on every /pty route", () => {
    for (const { method, pathname } of ptyRoutes) {
      const decision = authorize({ scope: "channel:whatsapp", method, pathname, owns })
      expect(decision.allow, `${method} ${pathname} must be denied for channel scope`).toBe(false)
    }
  })

  test("a channel token hitting GET /pty/shells is 403 and never reaches the pty handler", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("wa", "channel:whatsapp", "whatsapp-channel")
    const res = await auth.handle(
      new Request("http://x/pty/shells", { method: "GET", headers: bearer(secret) }),
      reachedUpstream(),
    )
    expect(res.status).toBe(403)
  })

  test("a channel token cannot spawn a shell via POST /pty", async () => {
    const { auth, tokens } = await build()
    const { secret } = await tokens.create("wa", "channel:whatsapp", "whatsapp-channel")
    const res = await auth.handle(
      new Request("http://x/pty", { method: "POST", headers: bearer(secret), body: JSON.stringify({}) }),
      reachedUpstream(),
    )
    expect(res.status).toBe(403)
  })

  // Guard the safe non-session routes a channel legitimately needs, so the fix is a
  // tightened allowlist, not a blanket non-session deny.
  test("channel scope still reaches the safe non-session read/meta routes", () => {
    const safe: Array<{ method: string; pathname: string }> = [
      { method: "GET", pathname: "/config" },
      { method: "GET", pathname: "/agent" },
      { method: "GET", pathname: "/provider" },
      { method: "GET", pathname: "/event" },
      { method: "GET", pathname: "/global/event" },
      { method: "GET", pathname: "/doc" },
      { method: "GET", pathname: "/session" },
    ]
    for (const { method, pathname } of safe) {
      expect(authorize({ scope: "channel:whatsapp", method, pathname, owns }).allow, `${method} ${pathname}`).toBe(true)
    }
  })
})
