// Live end-to-end repro for RISK-026 / ADR-0020: a `channel:` token must NOT reach the
// top-level /pty shell surface. Boots a REAL marid-wrapped server (maridServe →
// createMaridHandler → Server.Default), mints a real channel token + an admin token in
// the same file-backed store, and curls the routes over HTTP.
//
//   run:  bun run scripts/pty-channel-breach-repro.ts   (from packages/opencode)
//
// Expected AFTER the ADR-0020 fix:  channel /pty/shells = 403,  admin /pty/shells = 200
//                                   channel /config     = 200  (server up, token valid)
// Expected BEFORE the fix (revert scope.ts): channel /pty/shells = 200  (the breach)
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createTokenStore } from "@marid/gateway"
import { maridServe } from "../src/marid/serve"

async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marid-pty-repro-"))
  const tokens = createTokenStore(dir)
  const channel = (await tokens.create("wa", "channel:whatsapp", "whatsapp-channel")).secret
  const admin = (await tokens.create("adm", "admin")).secret

  const server = maridServe({ hostname: "127.0.0.1", port: 0, dir })
  const base = `http://127.0.0.1:${server.port}`
  const hit = async (route: string, secret: string) => {
    const res = await fetch(`${base}${route}`, { headers: { authorization: `Bearer ${secret}` } })
    await res.text().catch(() => "")
    return res.status
  }

  try {
    const results = {
      "channel GET /pty/shells (must be 403 after fix)": await hit("/pty/shells", channel),
      "admin   GET /pty/shells (route works → 200)": await hit("/pty/shells", admin),
      "channel GET /config     (allowed → 200)": await hit("/config", channel),
      "no-token GET /pty/shells (401)": await (async () => {
        const res = await fetch(`${base}/pty/shells`)
        await res.text().catch(() => "")
        return res.status
      })(),
    }
    console.log(JSON.stringify(results, null, 2))
  } finally {
    server.stop()
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("REPRO ERROR:", e)
    process.exit(1)
  },
)
