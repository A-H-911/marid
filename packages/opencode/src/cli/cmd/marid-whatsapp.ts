import path from "node:path"
import fs from "node:fs/promises"
import { isAlive, instanceMaridDir, pathOf, readRecord } from "@marid/instance"
import { createWahaClient, loadConfig, makeSafeLog, runGateway } from "@marid/whatsapp"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { cmd } from "./cmd"

// `marid whatsapp start` (WBS-7.1 wiring, ADR-0005): a standalone gateway process that
// attaches to a running instance over the public API with a scoped channel:<name> token
// and bridges WhatsApp (via a WAHA sidecar) <-> the agent. Holds no provider keys.
//
// Secrets come from the environment (INV-002): the WAHA API key (MARID_WA_WAHA_API_KEY,
// optional), MARID_WA_WAHA_URL, MARID_WA_ALLOW (comma-separated operator JIDs), optional
// MARID_WA_SESSION. Reaches WhatsApp OUTBOUND-only through WAHA (OQ-004) — no inbound port.

async function requireRunning(name: string): Promise<{ url: string; dir: string }> {
  const dir = pathOf(name)
  const present = await fs
    .stat(dir)
    .then(() => true)
    .catch(() => false)
  if (!present) throw new Error(`instance "${name}" does not exist; run \`marid instance add ${name}\` first`)
  const record = await readRecord(dir)
  if (!record || !isAlive(record.pid)) {
    throw new Error(`instance "${name}" is not running; start it with \`marid instance start ${name}\``)
  }
  return { url: `http://127.0.0.1:${record.port}`, dir }
}

const StartCommand = cmd({
  command: "start <instance>",
  describe: "run the WhatsApp gateway against a running instance",
  builder: (yargs) =>
    yargs
      .positional("instance", { type: "string", demandOption: true, describe: "instance name to attach to" })
      .option("token", {
        type: "string",
        demandOption: true,
        describe: "channel:<name> bearer token (from `marid token create --scope channel:<name> --agent <agent>`)",
      })
      .option("agent", {
        type: "string",
        demandOption: true,
        describe: "the restricted agent bound to the token (must match its --agent)",
      }),
  handler: async (args) => {
    const { url, dir } = await requireRunning(args.instance)
    const env = loadConfig(process.env)

    const sdk = createOpencodeClient({ baseUrl: url, headers: { authorization: `Bearer ${args.token}` } })

    const controller = new AbortController()
    const shutdown = () => controller.abort()
    process.once("SIGINT", shutdown)
    process.once("SIGTERM", shutdown)

    // WAHA puts its key in the WS query string, so the connection URL is a secret — every
    // log line is redacted (both the literal key and the x-api-key= param).
    const safeLog = makeSafeLog((line) => console.log(line), env.wahaApiKey)
    safeLog(`marid whatsapp gateway attached to "${args.instance}" (${url}); agent="${args.agent}"; waha=${env.wahaUrl}`)

    const client = createWahaClient({
      baseUrl: env.wahaUrl,
      session: env.session,
      apiKey: env.wahaApiKey,
      signal: controller.signal,
      log: safeLog,
    })

    const pollBindings = async (): Promise<Set<string>> => {
      const res = await fetch(`${url}/marid/self-bindings`, { headers: { authorization: `Bearer ${args.token}` } })
      if (!res.ok) return new Set()
      const body = (await res.json().catch(() => undefined)) as { sessions?: unknown } | undefined
      const sessions = Array.isArray(body?.sessions) ? body.sessions.filter((s): s is string => typeof s === "string") : []
      return new Set(sessions)
    }

    await runGateway({
      sdk,
      client,
      allow: env.allow,
      agent: args.agent,
      session: env.session,
      // One operator → their JID is the default sink for bound (attached) sessions mirrored
      // in from web/TUI. With >1 allowlisted JID there is no single obvious target, so bound
      // sessions render nowhere until a mirror-target is chosen (ponytail: future WBS).
      defaultJid: env.allow.size === 1 ? [...env.allow][0] : undefined,
      pollBindings,
      dedupFile: path.join(instanceMaridDir(dir), "whatsapp-dedup.json"),
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      timers: {
        set: (cb, ms) => {
          const t = setTimeout(cb, ms)
          return () => clearTimeout(t)
        },
      },
      cadenceMs: env.cadenceMs,
      permissionTimeoutMs: env.permissionTimeoutMs,
      approvalTtlMs: env.approvalTtlMs,
      log: safeLog,
      signal: controller.signal,
    })
  },
})

export const MaridWhatsappCommand = cmd({
  command: "whatsapp",
  describe: "run the marid WhatsApp channel gateway",
  builder: (yargs) => yargs.command(StartCommand).demandCommand(),
  handler: () => {},
})
