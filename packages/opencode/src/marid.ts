// MARID BINARY ENTRY (WBS-1.1 build-entry decision, 2026-07-04).
//
// Additive, no upstream edit: this file MIRRORS src/index.ts but (a) brands the
// CLI as `marid`, (b) replaces the unauthenticated upstream `serve` with the
// marid-auth-gated `MaridServeCommand`, and (c) adds `marid token`. It reuses
// every upstream command module unchanged.
//
// PATCH-SURFACE / SYNC NOTE (P-* row): because the command list is duplicated
// from index.ts, an upstream PR that adds/removes a top-level command will NOT
// be reflected here automatically. Reconcile this command list against index.ts
// on each upstream sync (upstream-sync-strategy.md checklist item).
import "./marid-env" // MUST stay first: sets __MARID_APP before global.ts loads (WBS-8.2 P-6)
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { maridMigrate } from "./marid-migrate"
import { disclosePierce } from "./marid-pierce"
import { RunCommand } from "./cli/cmd/run"
import { GenerateCommand } from "./cli/cmd/generate"
import { ConsoleCommand } from "./cli/cmd/account"
import { ProvidersCommand } from "./cli/cmd/providers"
import { AgentCommand } from "./cli/cmd/agent"
import { UninstallCommand } from "./cli/cmd/uninstall"
import { ModelsCommand } from "./cli/cmd/models"
import { UI } from "./cli/ui"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { FormatError } from "./cli/error"
import { DebugCommand } from "./cli/cmd/debug"
import { StatsCommand } from "./cli/cmd/stats"
import { McpCommand } from "./cli/cmd/mcp"
import { GithubCommand } from "./cli/cmd/github"
import { ExportCommand } from "./cli/cmd/export"
import { ImportCommand } from "./cli/cmd/import"
import { AttachCommand } from "./cli/cmd/attach"
import { TuiThreadCommand } from "./cli/cmd/tui"
import { AcpCommand } from "./cli/cmd/acp"
import { EOL } from "os"
import { WebCommand } from "./cli/cmd/web"
import { PrCommand } from "./cli/cmd/pr"
import { SessionCommand } from "./cli/cmd/session"
import { DbCommand } from "./cli/cmd/db"
import { errorMessage } from "./util/error"
import { PluginCommand } from "./cli/cmd/plug"
import { Heap } from "./cli/heap"
import { MaridServeCommand, MaridTokenCommand } from "./cli/cmd/marid"
import { MaridInstanceCommand } from "./cli/cmd/marid-instance"
import { MaridTelegramCommand } from "./cli/cmd/marid-telegram"
import { MaridWhatsappCommand } from "./cli/cmd/marid-whatsapp"

const args = hideBin(process.argv)

function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("marid ")) {
    process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text + EOL)
    return
  }
  process.stderr.write(out)
}

const cli = yargs(args)
  .parserConfiguration({ "populate--": true })
  .scriptName("marid")
  .wrap(100)
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", InstallationVersion)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .option("pure", {
    describe: "run without external plugins",
    type: "boolean",
  })
  .middleware(async (opts) => {
    if (opts.printLogs) process.env.OPENCODE_PRINT_LOGS = "1"
    if (opts.logLevel) process.env.OPENCODE_LOG_LEVEL = opts.logLevel
    if (opts.pure) {
      process.env.OPENCODE_PURE = "1"
    }

    Heap.start()

    process.env.AGENT = "1"
    process.env.OPENCODE = "1"
    process.env.OPENCODE_PID = String(process.pid)
  })
  .usage("")
  .completion("completion", "generate shell completion script")
  .command(AcpCommand)
  .command(McpCommand)
  .command(TuiThreadCommand)
  .command(AttachCommand)
  .command(RunCommand)
  .command(GenerateCommand)
  .command(DebugCommand)
  .command(ConsoleCommand)
  .command(ProvidersCommand)
  .command(AgentCommand)
  // marid: no UpgradeCommand — it fetches the upstream `opencode` binary from npm
  // (installation/index.ts → registry.npmjs.org/opencode-ai). Marid updates via the
  // signed GitHub Release download+verify path (README). WBS-5.2.
  .command(UninstallCommand)
  .command(MaridServeCommand) // authenticated; replaces upstream ServeCommand
  .command(MaridTokenCommand) // marid-only: bearer token management
  .command(MaridInstanceCommand) // marid-only: isolated multi-instance lifecycle
  .command(MaridTelegramCommand) // marid-only: Telegram channel gateway (PH-4)
  .command(MaridWhatsappCommand) // marid-only: WhatsApp channel gateway (PH-7)
  .command(WebCommand)
  .command(ModelsCommand)
  .command(StatsCommand)
  .command(ExportCommand)
  .command(ImportCommand)
  .command(GithubCommand)
  .command(PrCommand)
  .command(SessionCommand)
  .command(PluginCommand)
  .command(DbCommand)
  .fail((msg, err) => {
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      if (err) throw err
      cli.showHelp(show)
    }
    if (err) throw err
    process.exit(1)
  })
  .strict()

// WBS-8.2 (DEC-025 / AC-031): one-time copy of a pre-isolation OpenCode install
// into the isolated marid dirs, so upgrading a machine that ran marid v0.2.0
// keeps auth, gateway tokens, sessions DB, and model selection. Best-effort —
// a failure degrades to a fresh marid dir (re-auth), never blocks the CLI.
await maridMigrate().catch((e) => process.stderr.write("[marid] migration skipped: " + errorMessage(e) + EOL))

// WBS-8.2 (AC-026): disclose any OPENCODE_* env var that pierces data isolation.
disclosePierce()

try {
  if (args.includes("-h") || args.includes("--help")) {
    await cli.parse(args, (err: Error | undefined, _argv: unknown, out: string) => {
      if (err) throw err
      if (!out) return
      show(out)
    })
  } else {
    await cli.parse()
  }
} catch (e) {
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error" + EOL)
    process.stderr.write(errorMessage(e) + EOL)
  }
  process.exitCode = 1
} finally {
  process.exit()
}
