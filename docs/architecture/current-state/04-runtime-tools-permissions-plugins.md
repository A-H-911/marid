---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# 04 — Agent Runtime Core: Loop, Tools, Permissions, Plugins, MCP, LSP, Providers

All paths relative to `packages/opencode/src/` unless noted. Findings only, no decisions. `unverified` marks unconfirmed items.

## 1. Agent execution loop

- Core loop: `SessionPrompt.runLoop(sessionID)` — a `while (true)` loop at `session/prompt.ts:1081`. Per iteration: set busy (`:1089`), load messages (`:1092`), build assistant message (`:1186`), create processor handle (`:1213`), resolve tools via `SessionTools.resolve` (`:1226`), assemble system prompt (`:1256-1270`), call `handle.process(...)` (`:1271`).
- Entry: `prompt()` at `session/prompt.ts:1052` creates the user message, then `loop()` (`:1342`) wraps `runLoop` in single-flight-per-session `state.ensureRunning` (`session/run-state.ts`).
- Termination: break when last assistant message finished with a non-`tool-calls` reason and no pending tool calls (`prompt.ts:1111-1130`); or processor returns `"stop"` (`:1318`); `"continue"` re-loops; `"compact"` runs compaction then continues (`:1319-1327`). Per-agent step cap `agent.steps` injects a `MAX_STEPS_PROMPT` on the last step (`:1178-1179`, `:1280`).
- Streaming engine: `SessionProcessor.create` (`session/processor.ts:98`); `process()` (`:625`) runs `llm.stream(...)` (`:638`) and routes every AI-SDK stream event through `handleEvent` (`:276`) — reasoning/text/tool parts, tool execution results (`:329-417`). Retry policy wraps the stream (`:658`). Doom-loop guard: 3 identical repeated tool calls triggers a `doom_loop` permission ask (`:354-378`).
- System prompt assembly (in-loop, `prompt.ts:1256-1268`): `[environment, instructions, mcpInstructions, skills]`.
  - `session/system.ts`: `provider(model)` (`:26`) selects the base persona prompt by model family (`session/prompt/anthropic.txt`, `gpt.txt`, `gemini.txt`, `beast.txt`, `codex.txt`); `environment()` (`:58`) emits `<env>` (cwd, worktree, git flag, platform, date, `:63-74`); `skills(agent)` (`:96`); `mcp(agent)` (`:110`) emits per-server `<mcp_instructions>`.
- Compaction: `session/overflow.ts:10,22` computes token budget and overflow; `session/compaction.ts` (`SessionCompaction.Service`) creates a summary turn replacing prior context, invoked from the loop (`prompt.ts:1149,1161-1168`) and prunes old tool output on exit (`:1337`).
- Subagent spawning: `tool/task.ts` (`TaskTool`, id `task`, `:24`). `run()` (`:92`) permission-asks (`:104-114`), resolves the agent (`:116`), creates a child session `sessions.create({parentID, agent, permission})` (`:142-158`), and drives it via `ops.prompt(...)` bridging back to `SessionPrompt` (`:186-200`). Supports foreground wait (`:303-333`) and experimental background jobs (`:242-294`). In-loop subtask parts route through `handleSubtask` (`prompt.ts:255`, invoked `:1144`).
- Subagent permission derivation: `agent/subagent-permissions.ts:14` — child inherits only parent `deny` + `external_directory` rules, plus default `todowrite`/`task` denies unless the subagent's own ruleset grants them (`:21-25`). Subagents cannot spawn tasks by default.

## 2. Tool system

- Tool contract: `tool/tool.ts` — `Def` (`:55-65`): `id`, `description`, effect-schema `parameters`, `execute(args, ctx)`. `Context` (`:36-46`): `sessionID`, `messageID`, `agent`, `abort`, `messages`, `metadata()` (live streaming title/metadata), `ask()` (raises a permission request). `wrap` (`:99-148`) validates args and auto-truncates output.
- Registry: `tool/registry.ts` (`@opencode/ToolRegistry`, `:80`). Built-in list (`builtin`, `:218-235`): `invalid`, `question` (client-gated), `bash` (shell), `read`, `glob`, `grep`, `edit`, `write`, `task`, `webfetch`, `todowrite`, `websearch` (provider-gated `:55-57`), `skill`, `apply_patch` (GPT models only, `:272-275`), `lsp` (flag `experimentalLspTool`), `plan` (flag `experimentalPlanMode`).
- Custom tools: loaded from `{tool,tools}/*.{js,ts}` in config dirs (`registry.ts:171-185`) and from plugins (`:187-192`, Zod-to-JSONSchema bridge).
- Model-aware filtering: `tools(model)` (`registry.ts:266-306`) swaps `apply_patch` vs `edit`/`write`, runs the `tool.definition` plugin hook per tool, and augments the `task` description with available subagents (`:251-264`).
- Per-agent filtering happens downstream: `session/llm/request.ts:208-214` drops tools denied by `Permission.disabled` (`permission/index.ts:204-214`, maps edit/write/apply_patch to the `edit` permission).
- Execution + streaming: `session/tools.ts:39-130` builds the AI-SDK tool map; each `execute` (`:98-128`) fires `tool.execute.before/after` plugin hooks and calls the tool. Tool parts stream over the bus: `session/session.ts:637-645` publishes `PartUpdated` on every part update; deltas via `:879-886`. Part lifecycle in `session/processor.ts:214-251,160-203`.
- Shell tool (`tool/shell.ts`, id `bash`): platform-specific spawn (PowerShell `-NonInteractive` on Windows, `:293-310`); default timeout 2 min (`:347`), enforced by racing exit/abort/timeout (`:540-557`); output streamed with rolling byte cap + truncation file (`:486-530`). **No OS sandbox** — safety is tree-sitter command parsing (`:311-336`, `collect` `:378-414`): file-touching commands get path args resolved, out-of-project paths raise `external_directory` asks, and every command raises a `bash` permission pattern built from `BashArity.prefix()` (`permission/arity.ts:1-9`, arity dictionary `:24-161`).
- External directory guard: `tool/external-directory.ts:15-45` — any path outside the project instance raises `ctx.ask({permission:"external_directory", patterns:[dir glob]})`.

## 3. Permission model

- Evaluation: `Permission.evaluate` (`permission/index.ts:28-38`) flattens rulesets and takes the **last** matching rule (`Wildcard.match` on both permission name and pattern); default `{action:"ask", pattern:"*"}`. Later rules override earlier ones.
- Ask flow: `ask` (`index.ts:67-107`) checks configured ruleset + persisted approvals; `deny` fails with `DeniedError`, `allow` skips, otherwise creates a `Deferred`, publishes `Event.Asked` (`:100`) on the bus, and awaits reply.
- Reply: `reply` (`index.ts:109-167`) — reject fails the deferred (and rejects all other pending asks in the session, `:121-140`); approve with `always` persists patterns into an in-memory `approved` list as allow rules (`:145-151`) and auto-resolves now-satisfied pending asks (`:153-166`). Persistence is session-lifetime, not written to disk (unverified whether approvals survive restart — no disk write observed in `permission/index.ts`).
- Config: `fromConfig` (`index.ts:186-198`) turns `opencode.json` `permission` maps (`{bash: "allow"}` or `{bash: {"git *": "allow"}}`) into rules, with `~`/`$HOME` expansion (`:178-184`).
- Scoping: per-agent ruleset (`agent.permission`) merged with per-session ruleset at ask time (`session/tools.ts:78-86`). Built-in agents ship distinct rulesets (see section 4).
- Approval surface: HTTP API — `GET /permission` and `POST /permission/:requestID/reply` (`server/routes/instance/httpapi/groups/permission.ts:31-43`, handler `handlers/permission.ts:16-37`). The TUI subscribes to `Event.Asked`/`Event.Replied` on the bus and replies through the same service.
- Churn note: `permission/` is low-churn (55 file-touches in 3 months vs 1309 for `server/`) — the model is stable.

## 4. Skills, commands, rules, custom agents

### Skills
- Discovery (`skill/index.ts:173-233`): global + project-walk of `.claude/skills/**/SKILL.md` and `.agents/skills/**/SKILL.md` (`:21-24,191-201`; Claude-Code dirs honored unless `disableClaudeCodeSkills`); opencode config dirs `{skill,skills}/**/SKILL.md` (`:205-208`); `config.skills.paths[]` and remote `config.skills.urls[]` (`:211-227`, remote pull in `skill/discovery.ts:49-132`).
- Format: `SKILL.md` with YAML frontmatter `name` (required) + `description` (`index.ts:53-59`); body is the content.
- Surfaced three ways: system-prompt listing (`session/system.ts:96-107`, filtered by agent permission `skill/index.ts:310-315`), the `skill` tool that loads content on demand (`tool/skill.ts:12-70`, gated by `skill` permission), and as slash commands (`command/index.ts:134-152`).

### Slash commands
- Discovery: `{command,commands}/**/*.md` in every config dir (`config/command.ts:13-39`); config dirs = `~/.config/opencode`, `.opencode` walked cwd-to-worktree, `OPENCODE_CONFIG_DIR` (`config/paths.ts:23-41`).
- Format: markdown, frontmatter (`agent`, `model`, `description`, `subtask`), body = template (`command.ts:26-31`).
- Templates: `$1..$n` positional, `$ARGUMENTS`, `` !`cmd` `` shell substitution, `@file` references — substituted in `session/prompt.ts:1370-1408` (regexes in `config/markdown.ts:5-6`).
- Merged sources: config commands, MCP prompts (args become `$1..$n`, `command/index.ts:105-132`), skills. Built-ins: `init` and `review` (`command/index.ts:46-88`).

### Rules / instructions
- Loaded by `session/instruction.ts`: global `<config>/AGENTS.md` + `~/.claude/CLAUDE.md` (unless `disableClaudeCodePrompt`) (`:60-63`); project `AGENTS.md` > `CLAUDE.md` > deprecated `CONTEXT.md`, first name that matches wins, all ancestor copies of that name included (`:64-68,123-133`); then `config.instructions[]` globs and http(s) URLs (`:135-168`).
- Order in system prompt: global, project, config instructions, each prefixed `Instructions from: <path>` (`:110-153,165-168`).
- On-demand nested rules: when a file is read, nearby AGENTS.md/CLAUDE.md up-tree get attached once per message (`:179-221`).

### Custom agents
- Discovery: `{agent,agents}/**/*.md` and `{mode,modes}/*.md` in config dirs (`config/agent.ts:13-59`) plus `agent` entries in `opencode.json` (`agent/agent.ts:267-294`).
- Format (`agent/agent.ts:35-56`): frontmatter `description`, `mode` (`primary|subagent|all`), `model`, `temperature`, `top_p`, `steps`, `permission` ruleset, `hidden`, `disable`; body = prompt.
- Built-ins (`agent/agent.ts:140-265`): `build` (default primary, allow-all), `plan` (edits denied except plan files), `general` (subagent), `explore` (read-only subagent), plus hidden `compaction`/`title`/`summary` agents with deny-all tools.
- Default agent: `config.default_agent` else `build` (`agent/agent.ts:328-340`).

## 5. Plugin architecture

- Loading (`plugin/index.ts`, `plugin/loader.ts`): internal plugins imported directly (`index.ts:65-82`); external from config `plugin` origins — local file paths or npm packages installed on demand (`plugin/shared.ts:56-59,207-213`), npm gated by an `engines.opencode` semver check (`shared.ts:194-205`). Module shape: default export `{ id?, server: Plugin }` or legacy bare functions (`shared.ts:272-304`).
- SDK surface (`packages/plugin/src/index.ts`): `Plugin = (input: PluginInput) => Promise<Hooks>` (`:74`). `PluginInput` provides an in-process opencode SDK client, project/worktree paths, `serverUrl`, and Bun `$` shell (`:56-66`).
- Hooks (`packages/plugin/src/index.ts:222-335`): `event` (all bus events), `config`, `tool` (register tools), `auth` (provider login flows), `provider` (dynamic models), `chat.message`, `chat.params`, `chat.headers`, `permission.ask`, `tool.execute.before/after`, `tool.definition`, `command.execute.before`, `shell.env`, `dispose`, plus `experimental.*` transforms (system/messages/compaction).
- Trust/isolation: **none** — plugins are dynamically `import()`ed and run in-process with full shell and SDK access; hooks dispatched sequentially (`plugin/index.ts:218-293`). Installing a plugin means trusting its code.
- Built-in plugins are all provider-auth plugins: openai/codex, github-copilot, cloudflare, azure, digitalocean, snowflake-cortex, xai, plus npm-sourced gitlab/poe auth (`plugin/index.ts:12-22,66-81`).

## 6. MCP

- Client only. Config schema (`packages/core/src/v1/config/mcp.ts`): `Local` (stdio: `command[]`, `cwd`, `environment`, `timeout`, `:6-24`) and `Remote` (`url`, `headers`, `oauth`, `:44-60`).
- Transports: stdio via `StdioClientTransport` (`mcp/index.ts:332-362`); remote tries Streamable HTTP then falls back to SSE (`:261-330`). Servers connect concurrently at startup with reconnect/tool-change notification handlers (`:434-464,497-521`).
- Tool exposure: MCP tools become AI-SDK `dynamicTool`s named `<server>_<tool>` (`mcp/catalog.ts:42-83,117-119`); resources/prompts keyed `server:uri` (`:104-112`); MCP prompts appear as slash commands (section 4).
- Auth: full OAuth 2.0 with PKCE and RFC 7591 dynamic client registration (`mcp/oauth-provider.ts:26,55-79`); tokens persisted via `McpAuth` (`oauth-provider.ts:96-162`); browser callback server on port 19876 with CSRF state check (`mcp/index.ts:799-950`); managed over the HTTP API (`server/routes/instance/httpapi/handlers/mcp.ts:23-73`).
- OpenCode does not serve MCP itself; `McpServer` references in `acp/` are the Agent Client Protocol SDK (Zed integration) passing MCP configs through (`acp/service.ts:950-1007`).

## 7. LSP integration

- Purpose: diagnostics after edit/write/patch (`tool/edit.ts:197-200`, `tool/write.ts:75-82`, `tool/apply_patch.ts:269-289`), plus hover/definition/references/symbols/call-hierarchy via the experimental `lsp` tool (`tool/lsp.ts`, permission-gated `:56-61`, flag `experimentalLspTool`).
- Lifecycle: lazy — servers spawn on first file touch, matched by extension, cached per project root (`lsp/lsp.ts:208-297`); many servers auto-download binaries on first use (e.g. gopls `lsp/server.ts:372`, disable via `disableLspDownload`).
- Config: `lsp: false` disables everything (`lsp/lsp.ts:151-152`); per-server enable/disable/overrides (`:160-181`).
- Coupling: it is a self-contained Effect service (`@opencode/LSP`, `lsp/lsp.ts:136,501-505`) with explicit deps; tools depend on it, not vice versa, and already guard for "no client" (`tool/lsp.ts:77-78`). A non-IDE distribution could stub it or ship `lsp: false` with no other changes — it is effectively optional today.

## 8. LLM providers

- Catalog: models.dev feed builds the provider/model database (`provider/provider.ts:1321-1323`, transform `:1192-1275`), layered with plugin providers (`:1371-1396`), config `provider` entries (`:1399-1489`), env-var keys (`:1493-1503`), and stored auth (`:1506-1516`).
- SDK: Vercel AI SDK — `BUNDLED_PROVIDERS` maps npm package to dynamic import of `create*` factories (`provider/provider.ts:107-134`); unbundled providers are **npm-installed at runtime** then imported (`:1751-1765`). Models typed `LanguageModelV3`.
- Auth/keys: `auth/index.ts` — `auth.json` under the global data dir, mode `0o600` (`:10,79`); credential types `oauth`/`api`/`wellknown` (`:14-35`); overridable via `OPENCODE_AUTH_CONTENT` (`:59-63`). Provider auth-login flows come from plugins (section 5).
- Selection: `model` config string is `provider/model`; `getModel`/`defaultModel`/fuzzy `closest()` (`provider/provider.ts:1136-1143`); allow/deny via `enabled_providers`/`disabled_providers` (`:1362-1369`).

## 9. Extension seams for embedding

- HTTP API: Effect `HttpApi` composed in `server/routes/instance/httpapi/api.ts:54-84` — instance groups Config, File, Mcp, Permission, Provider, Session, Tui, Workspace, etc.; typed clients in `@opencode-ai/protocol` / `packages/sdk/js`. `opencode serve` is the headless entry.
- Event stream: SSE at the event handler (`server/routes/instance/httpapi/handlers/event.ts:69-84`) streaming all bus events with heartbeat; cross-instance signals on the singleton `GlobalBus` EventEmitter (`bus/global.ts:11-22`).
- Config injection: layered load order in `config/config.ts` — remote well-known, global file, `$OPENCODE_CONFIG`, project files, `.opencode` dirs, `$OPENCODE_CONFIG_CONTENT` (inline JSON env var, `:467-475`), remote org config, managed/MDM overrides last (`:355-533`). `OPENCODE_CONFIG_CONTENT` + `OPENCODE_AUTH_CONTENT` allow fully headless, file-less configuration.
- Behavior hooks: the plugin Hooks surface (section 5) is the main behavior-injection seam (tool wrapping, permission interception, chat param mutation, custom tools/providers/auth).
- DI: everything (Config, Provider, LSP, Permission, ToolRegistry) is an Effect `LayerNode` service, so the runtime is embeddable without CLI/TUI in principle (the server package already consumes it this way).

## Stability (git churn, Apr–Jul 2026, file-touches under src/)

| Area | Touches | Read |
|---|---|---|
| server | 1309 | hot — API surface actively changing |
| session | 756 | hot — loop/processor under active work |
| tool | 505 | moderate |
| config | 351 | moderate |
| provider | 310 | moderate |
| plugin / mcp | 173 / 139 | settling |
| lsp / skill / agent / permission / bus / command | 93 / 64 / 64 / 55 / 35 / 29 | stable |

Experimental flags observed: `experimentalLspTool`, `experimentalPlanMode`, background task mode (`tool/task.ts:242-294`), `experimental.*` plugin hooks, `experimental_workspace` plugin input.
