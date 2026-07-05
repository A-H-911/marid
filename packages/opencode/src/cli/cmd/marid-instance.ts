import path from "node:path"
import fs from "node:fs/promises"
import { add, isAlive, list, pathOf, readRecord, remove, start, status, stop, type LaunchResolver } from "@marid/instance"
import { cmd } from "./cmd"
import { validateSession } from "../tui/validate-session"

// Resolve how to (re-)launch `marid serve` for the current runtime:
//   - compiled `marid` binary: process.execPath IS the binary → [binary, serve, ...]
//   - dev (`bun run src/marid.ts ...`): process.execPath is bun/node → prepend the
//     script + --conditions=browser (matching how the server subprocess is launched
//     elsewhere in the repo). The compiled binary bakes its run conditions in.
// Always `--port 0`: the OS assigns a free port and marid-instance reads the actual
// one back from the server log (no port-allocation race).
function serveLaunch(): LaunchResolver {
  const exec = process.execPath
  const base = path.basename(exec).toLowerCase()
  const isRuntime = base.startsWith("bun") || base.startsWith("node")
  const maridEntry = path.resolve(import.meta.dir, "../../marid.ts")
  return () =>
    isRuntime
      ? { command: exec, args: ["run", "--conditions=browser", maridEntry, "serve", "--port", "0"] }
      : { command: exec, args: ["serve", "--port", "0"] }
}

async function requireExists(name: string): Promise<string> {
  const dir = pathOf(name)
  const present = await fs
    .stat(dir)
    .then(() => true)
    .catch(() => false)
  if (!present) throw new Error(`instance "${name}" does not exist; run \`marid instance add ${name}\` first`)
  return dir
}

const AddCommand = cmd({
  command: "add <name>",
  describe: "create an isolated instance tree",
  builder: (yargs) => yargs.positional("name", { type: "string", demandOption: true, describe: "instance name" }),
  handler: async (args) => {
    const dir = await add(args.name)
    console.log(`created instance "${args.name}" at ${dir}`)
  },
})

const ListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list instances and their run state",
  builder: (yargs) => yargs.option("json", { type: "boolean", default: false, describe: "machine-readable output" }),
  handler: async (args) => {
    const items = await list()
    if (args.json) {
      console.log(JSON.stringify(items, null, 2))
      return
    }
    if (items.length === 0) {
      console.log("no instances")
      return
    }
    for (const item of items) {
      const state = item.running ? `running  :${item.port} (pid ${item.pid})` : "stopped"
      console.log(`${item.name}\t${state}\t${item.dir}`)
    }
  },
})

const PathCommand = cmd({
  command: "path <name>",
  describe: "print an instance's directory",
  builder: (yargs) => yargs.positional("name", { type: "string", demandOption: true, describe: "instance name" }),
  handler: async (args) => {
    console.log(pathOf(args.name))
  },
})

const StartCommand = cmd({
  command: "start <name>",
  describe: "start an instance's authenticated server on an allocated port",
  builder: (yargs) => yargs.positional("name", { type: "string", demandOption: true, describe: "instance name" }),
  handler: async (args) => {
    const dir = await requireExists(args.name)
    const record = await start(args.name, dir, serveLaunch())
    console.log(`instance "${args.name}" listening on http://127.0.0.1:${record.port} (pid ${record.pid})`)
  },
})

const StopCommand = cmd({
  command: "stop <name>",
  describe: "stop an instance's server (and its child processes)",
  builder: (yargs) => yargs.positional("name", { type: "string", demandOption: true, describe: "instance name" }),
  handler: async (args) => {
    const result = await stop(await requireExists(args.name))
    if (result.stopped) console.log(`stopped "${args.name}"`)
    else if (result.stale) console.log(`"${args.name}" was not running (cleared stale record)`)
    else console.log(`"${args.name}" is not running`)
  },
})

const StatusCommand = cmd({
  command: "status <name>",
  describe: "show whether an instance is running and on which port",
  builder: (yargs) => yargs.positional("name", { type: "string", demandOption: true, describe: "instance name" }),
  handler: async (args) => {
    const info = await status(await requireExists(args.name))
    if (info.running) console.log(`running  :${info.port} (pid ${info.pid})`)
    else if (info.stale) console.log(`stopped (stale record — pid ${info.pid} gone)`)
    else console.log("stopped")
  },
})

// WBS-3.1 (ADR-0004): the TUI as a client of the instance's server. Resolves the
// running instance's URL from its record and launches the SAME upstream TUI attach
// path (validateSession + tui/layer `run`) with a Marid bearer token — the SDK
// applies these headers to both HTTP calls AND the /event SSE stream, so no upstream
// edit is needed. This is the "config/launch default, not a code fork" ADR-0004 asks for.
const AttachCommand = cmd({
  command: "attach <name>",
  describe: "open the TUI attached to a running instance's authenticated server",
  builder: (yargs) =>
    yargs
      .positional("name", { type: "string", demandOption: true, describe: "instance name" })
      .option("token", {
        type: "string",
        demandOption: true,
        describe: "bearer token for this instance (from `marid token create`)",
      })
      .option("continue", { alias: ["c"], type: "boolean", describe: "continue the last session" })
      .option("session", { alias: ["s"], type: "string", describe: "session id to continue" }),
  handler: async (args) => {
    const dir = await requireExists(args.name)
    const record = await readRecord(dir)
    if (!record || !isAlive(record.pid)) {
      throw new Error(`instance "${args.name}" is not running; start it with \`marid instance start ${args.name}\``)
    }
    const url = `http://127.0.0.1:${record.port}`
    const headers = { authorization: `Bearer ${args.token}` }

    const { TuiConfig } = await import("@/config/tui")
    const config = await TuiConfig.get()
    await validateSession({ url, sessionID: args.session, headers })

    const { Effect } = await import("effect")
    const { run } = await import("../tui/layer")
    const { createLegacyTuiPluginHost } = await import("@/plugin/tui/runtime")
    await Effect.runPromise(
      run({
        url,
        config,
        pluginHost: createLegacyTuiPluginHost(),
        headers,
        args: { continue: args.continue, sessionID: args.session },
      }),
    )
  },
})

const RemoveCommand = cmd({
  command: "remove <name>",
  aliases: ["rm"],
  describe: "delete a stopped instance and its tree",
  builder: (yargs) => yargs.positional("name", { type: "string", demandOption: true, describe: "instance name" }),
  handler: async (args) => {
    const removed = await remove(args.name)
    console.log(removed ? `removed "${args.name}"` : `no instance named "${args.name}"`)
  },
})

export const MaridInstanceCommand = cmd({
  command: "instance",
  describe: "manage isolated marid instances",
  builder: (yargs) =>
    yargs
      .command(AddCommand)
      .command(ListCommand)
      .command(PathCommand)
      .command(StartCommand)
      .command(StopCommand)
      .command(StatusCommand)
      .command(AttachCommand)
      .command(RemoveCommand)
      .demandCommand(),
  handler: () => {},
})
