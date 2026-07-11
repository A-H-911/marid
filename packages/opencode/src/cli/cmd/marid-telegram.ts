import path from "node:path"
import fs from "node:fs/promises"
import { isAlive, instanceMaridDir, pathOf, readRecord } from "@marid/instance"
import { createBotApi, loadConfig, redact, runGateway } from "@marid/telegram"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { cmd } from "./cmd"

// `marid telegram start` (WBS-4.5 wiring, ADR-0005): a standalone gateway process
// that attaches to a running instance over the public API with a scoped
// channel:<name> token and bridges Telegram <-> the agent. Holds no provider keys.
// Secrets come from the environment (INV-002): TELEGRAM_BOT_TOKEN, MARID_TG_ALLOW
// (comma-separated operator user ids), optional TELEGRAM_API_URL.

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
  describe: "run the Telegram gateway against a running instance",
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
    const bot = createBotApi({ token: env.botToken, baseUrl: env.botApiBaseUrl })

    const controller = new AbortController()
    const shutdown = () => controller.abort()
    process.once("SIGINT", shutdown)
    process.once("SIGTERM", shutdown)

    const safeLog = (line: string) => console.log(redact(line, env.botToken))
    safeLog(`marid telegram gateway attached to "${args.instance}" (${url}); agent="${args.agent}"`)

    // WBS-6.5c: the channel token's OWN bound sessions, from the non-admin self-view route
    // (the admin /marid/bindings is off-limits to a channel token). Polled by the channel
    // client so an operator attach/detach mid-stream triggers a firehose re-subscribe.
    const pollBindings = async (): Promise<Set<string>> => {
      const res = await fetch(`${url}/marid/self-bindings`, { headers: { authorization: `Bearer ${args.token}` } })
      if (!res.ok) return new Set()
      const body = (await res.json().catch(() => undefined)) as { sessions?: unknown } | undefined
      const sessions = Array.isArray(body?.sessions) ? body.sessions.filter((s): s is string => typeof s === "string") : []
      return new Set(sessions)
    }

    await runGateway({
      sdk,
      bot,
      allow: env.allow,
      agent: args.agent,
      pollBindings,
      // One operator → their chat is the default sink for bound (attached) sessions mirrored
      // in from web/TUI (WBS-6.1b). A private-chat id equals the user id, so a single-operator
      // allowlist gives it for free. ponytail: multi-operator mirror-target selection is future
      // work (WBS-6.5); with >1 operator, bound sessions render nowhere until then.
      defaultChatId: env.allow.size === 1 ? [...env.allow][0] : undefined,
      dedupFile: path.join(instanceMaridDir(dir), "telegram-dedup.json"),
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
      pollTimeoutSec: env.pollTimeoutSec,
      log: safeLog,
      signal: controller.signal,
    })
  },
})

export const MaridTelegramCommand = cmd({
  command: "telegram",
  describe: "run the marid Telegram channel gateway",
  builder: (yargs) => yargs.command(StartCommand).demandCommand(),
  handler: () => {},
})
