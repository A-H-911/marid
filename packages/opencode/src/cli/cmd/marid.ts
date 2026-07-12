import { createTokenStore, isValidScope, type Scope } from "@marid/gateway"
import { cmd } from "./cmd"
import { maridDir, maridServe } from "../../marid/serve"

const store = () => createTokenStore(maridDir())

const TokenCreateCommand = cmd({
  command: "create <name>",
  describe: "issue a bearer token for a client",
  builder: (yargs) =>
    yargs
      .positional("name", { type: "string", demandOption: true, describe: "unique token name" })
      .option("scope", {
        type: "string",
        default: "client",
        describe: "admin | client | channel:<name>",
      })
      .option("agent", {
        type: "string",
        describe: "for channel:<name> scope — bind the token to this restricted agent (WBS-4.4, INV-001)",
      }),
  handler: async (args) => {
    if (!isValidScope(args.scope)) throw new Error(`invalid scope "${args.scope}" (use admin | client | channel:<name>)`)
    const scope: Scope = args.scope
    if (args.agent && !scope.startsWith("channel:")) throw new Error("--agent is only valid for a channel:<name> scope")
    if (scope.startsWith("channel:") && !args.agent) {
      throw new Error("a channel:<name> token requires --agent <name> (the restricted agent it may run)")
    }
    const result = await store().create(args.name, scope, args.agent)
    // The secret is shown exactly once — only its hash is persisted.
    console.log(result.secret)
  },
})

const TokenListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list issued tokens (names + scopes, never secrets)",
  handler: async () => {
    const tokens = await store().list()
    if (tokens.length === 0) {
      console.log("no tokens issued")
      return
    }
    for (const token of tokens) console.log(`${token.name}\t${token.scope}`)
  },
})

const TokenRevokeCommand = cmd({
  command: "revoke <name>",
  describe: "revoke a token by name",
  builder: (yargs) =>
    yargs.positional("name", { type: "string", demandOption: true, describe: "token name to revoke" }),
  handler: async (args) => {
    const removed = await store().revoke(args.name)
    console.log(removed ? `revoked ${args.name}` : `no token named ${args.name}`)
  },
})

export const MaridTokenCommand = cmd({
  command: "token",
  describe: "manage marid bearer tokens",
  builder: (yargs) =>
    yargs
      .command(TokenCreateCommand)
      .command(TokenListCommand)
      .command(TokenRevokeCommand)
      .demandCommand(),
  handler: () => {},
})

export const MaridServeCommand = cmd({
  command: "serve",
  describe: "start an authenticated marid server",
  builder: (yargs) =>
    yargs
      .option("port", { type: "number", default: 0, describe: "port to listen on (0 = auto)" })
      .option("hostname", { type: "string", default: "127.0.0.1", describe: "hostname to listen on" }),
  handler: async (args) => {
    const server = maridServe({ hostname: args.hostname, port: args.port })
    console.log(`marid server listening on ${server.url}`)
    await new Promise<void>(() => {}) // run until signalled
  },
})
