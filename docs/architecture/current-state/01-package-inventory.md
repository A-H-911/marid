---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# OpenCode Package Inventory (branch dev, HEAD eb3476660)

Scope: every directory under `packages/`. Target product keeps agent runtime, TUI, server/HTTP API+SSE, SDK, web UI surfaces, plugin/MCP/tool system; drops desktop apps, IDE integrations, enterprise/cloud components.

Classifications: **REQUIRED** (the kept surfaces depend on it), **CANDIDATE-FOR-EXCLUSION** (nothing required depends on it; desktop/cloud/enterprise-ish), **NEEDS-DECISION** (ambiguous).

Note: three `packages/` dirs are not workspace packages at all (no package.json): `containers`, `docs`, `identity`. Two dirs are umbrella folders whose real packages live one level down: `console/*` (6 packages), `stats/*` (3 packages), plus `sdk/js` (root `workspaces` list in package.json:26-33 confirms this layout).

## Summary table

| Package | What it is | Workspace deps (prod unless noted) | Classification | Evidence |
|---|---|---|---|---|
| `opencode` (packages/opencode) | The main product: CLI, agent runtime, provider integration, LSP/MCP, SQLite DB, HTTP server entry. `bun dev` runs it. | llm, plugin, protocol, schema, script, sdk, server, tui; dev: core, http-recorder | REQUIRED | packages/opencode/package.json; CLAUDE.md architecture section |
| `@opencode-ai/core` | Shared runtime core: Effect services, DB (Drizzle/SQLite), pty, global config. Depended on by nearly everything. | effect-drizzle-sqlite, effect-sqlite-node, llm, schema, plugin; dev: http-recorder | REQUIRED | packages/core/package.json |
| `@opencode-ai/llm` | "Schema-first LLM core... provider quirks live in adapters" (README). Typed request/response/tool layer. | schema; dev: http-recorder | REQUIRED | packages/llm/package.json, packages/llm/README.md |
| `@opencode-ai/schema` | Domain schemas (Agent, Command, Connection, Credential, Event, ...). Leaf package. | none | REQUIRED | packages/schema/package.json, packages/schema/src/index.ts:1-5 |
| `@opencode-ai/protocol` | HTTP API contract layer (api.ts, errors.ts, groups/, middleware/) shared by server and clients. | schema | REQUIRED | packages/protocol/package.json, packages/protocol/src |
| `@opencode-ai/server` | HTTP API + SSE server implementation over core/protocol. | core, protocol | REQUIRED | packages/server/package.json |
| `@opencode-ai/tui` | Terminal UI (SolidJS + OpenTUI). | core, plugin, sdk, ui | REQUIRED | packages/tui/package.json |
| `@opencode-ai/plugin` | Plugin SDK for custom tools/TUI plugins. | sdk | REQUIRED | packages/plugin/package.json |
| `@opencode-ai/sdk` (packages/sdk/js) | Generated TypeScript client for the HTTP API (openapi.json lives in packages/sdk). Leaf package. | none | REQUIRED | packages/sdk/js/package.json |
| `@opencode-ai/ui` | Design system: components, themes, icons, i18n, diff viewer (pierre/). Leaf package. | none | REQUIRED | packages/ui/package.json, packages/ui/src |
| `@opencode-ai/app` | Shared web/desktop UI application (SolidJS + Vite), the "web UI surface". | core, schema, sdk, session-ui, ui | REQUIRED | packages/app/package.json |
| `@opencode-ai/session-ui` | Shared session-rendering UI components used by app, storybook, enterprise. | core, sdk, ui | REQUIRED | packages/session-ui/package.json |
| `@opencode-ai/effect-drizzle-sqlite` | Effect wrapper for Drizzle/SQLite. Leaf. | none | REQUIRED | packages/effect-drizzle-sqlite/package.json; prod dep of core |
| `@opencode-ai/effect-sqlite-node` | Node SQLite driver adapter for Effect. Leaf. | none | REQUIRED | packages/effect-sqlite-node/package.json; prod dep of core |
| `@opencode-ai/script` | Shared build/dev script utilities. Prod dep of `opencode` and dev dep of cli. | none | REQUIRED | packages/script/package.json; packages/opencode/package.json |
| `@opencode-ai/http-recorder` | Record/replay Effect HTTP+WS traffic as deterministic JSON cassettes for tests. | none | NEEDS-DECISION | packages/http-recorder/README.md; devDependency-only in core, llm, opencode — needed to run their test suites, not at runtime |
| `@opencode-ai/cli` | A second, Effect-based CLI (bin name `lildax`, commands: api, migrate, service start/restart/status, debug). Parallel/experimental CLI framework; nothing depends on it. | core, sdk, server, tui, script (dev) | NEEDS-DECISION | packages/cli/package.json (bin `lildax`), packages/cli/src/index.ts:1-20 |
| `@opencode-ai/client` | "Private generation target for clients derived from OpenCode's authoritative Effect HttpApi" (README). Input to sdk-next. | schema, protocol, core, httpapi-codegen, server (dev) | NEEDS-DECISION | packages/client/package.json, packages/client/README.md |
| `@opencode-ai/sdk-next` | "Transitional package [that] will replace the existing generated @opencode-ai/sdk" — in-process Effect-native host, no network listener. | client, core, server | NEEDS-DECISION | packages/sdk-next/README.md, packages/sdk-next/package.json |
| `@opencode-ai/httpapi-codegen` | Build-time source generator producing Promise/Effect APIs from HttpApi contracts. Consumed by client (dev). | none | NEEDS-DECISION | packages/httpapi-codegen/README.md; only consumer is packages/client/package.json |
| `@opencode-ai/codemode` | "Effect-native confined code execution over schema-described tools" — sandboxed model-written JS calling host tools. Experimental; zero workspace consumers. | none | NEEDS-DECISION | packages/codemode/package.json, README.md; no `@opencode-ai/codemode` imports anywhere in packages/*/src |
| `@opencode-ai/storybook` | Component workbench for ui/session-ui (dev-time only; root script `dev:storybook`). | session-ui, ui | NEEDS-DECISION | packages/storybook/package.json; root package.json:13 |
| `@opencode-ai/web` | Astro Starlight docs/marketing website (opencode.ai); depends on the `opencode` workspace package for content generation. Not the web UI (that is `app`). | opencode | NEEDS-DECISION | packages/web/package.json:39, packages/web/README.md |
| `@opencode-ai/desktop` | Tauri v2 native desktop wrapper around app. Nothing depends on it. | app, ui | CANDIDATE-FOR-EXCLUSION | packages/desktop/package.json; no reverse deps |
| `console/*` (console-app, -core, -function, -mail, -resource, -support) | Cloud admin/billing console: SolidStart app + SST resources + mail + Lambda functions + support tooling. Self-contained cluster; only external workspace dep is ui (console-app). | internal console-* graph; console-app → ui | CANDIDATE-FOR-EXCLUSION | packages/console/*/package.json; root script `dev:console` uses SST (package.json:11) |
| `stats/*` (stats-app, -core, -server) | Public stats website ("separate site from the console", SolidStart + Lambda). stats-app → ui. | internal stats-* graph; stats-app → ui | CANDIDATE-FOR-EXCLUSION | packages/stats/README.md, packages/stats/*/package.json |
| `@opencode-ai/slack` | Slack bot integration creating threaded conversations. | sdk | CANDIDATE-FOR-EXCLUSION | packages/slack/README.md, packages/slack/package.json; no reverse deps |
| `@opencode-ai/function` | Cloudflare Worker (Durable Objects, R2, SST, GitHub App auth) — cloud sync/share backend. | none | CANDIDATE-FOR-EXCLUSION | packages/function/src/api.ts:1-16 (cloudflare:workers, sst, octokit) |
| `@opencode-ai/enterprise` | SolidStart web app with session `/share` routes — hosted/enterprise share viewer. Nothing required depends on it. | core, session-ui, ui | CANDIDATE-FOR-EXCLUSION | packages/enterprise/package.json, packages/enterprise/src/routes (share/, share.tsx). Note: excluding it removes the hosted session-share page, not the runtime |
| `containers/` | Not a package. Prebuilt CI container images for GitHub Actions. | n/a | CANDIDATE-FOR-EXCLUSION | packages/containers/README.md; no package.json |
| `docs/` | Not a package. Mintlify docs content (docs.json, .mdx). | n/a | CANDIDATE-FOR-EXCLUSION | packages/docs (no package.json, docs.json + mdx files) |
| `identity/` | Not a package. Brand assets (logo marks, PNG/SVG). | n/a | CANDIDATE-FOR-EXCLUSION | packages/identity (image files only, no package.json) |

Counts: REQUIRED 15, NEEDS-DECISION 8, CANDIDATE-FOR-EXCLUSION 9 (top-level dirs; console and stats each expand into their own internal sub-graphs).

## Dependency map (edge list, prod deps; `(dev)` = devDependency)

Leaf packages (no workspace deps): schema, ui, sdk, script, http-recorder, httpapi-codegen, effect-drizzle-sqlite, effect-sqlite-node, codemode, function, console-mail, console-resource, stats-core.

```
opencode      -> llm, plugin, protocol, schema, script, sdk, server, tui, core(dev), http-recorder(dev)
core          -> effect-drizzle-sqlite, effect-sqlite-node, llm, schema, plugin, http-recorder(dev)
llm           -> schema, http-recorder(dev)
protocol      -> schema
server        -> core, protocol
tui           -> core, plugin, sdk, ui
plugin        -> sdk
app           -> core, schema, sdk, session-ui, ui
session-ui    -> core, sdk, ui
web           -> opencode
cli           -> core, sdk, server, tui, script(dev)
client        -> schema, protocol, core, httpapi-codegen(dev), server(dev)
sdk-next      -> client, core, server
storybook     -> session-ui, ui
desktop       -> app, ui
enterprise    -> core, session-ui, ui
slack         -> sdk
console-app   -> console-core, console-mail, console-resource, ui
console-core  -> console-mail, console-resource
console-function -> console-core, console-resource
console-support  -> console-core
stats-app     -> stats-core, ui
stats-server  -> stats-core
```

Reverse view of the REQUIRED spine: schema <- {llm, protocol, core, app, client}; core <- {server, tui, app, session-ui, opencode(dev), cli, client, sdk-next, enterprise}; sdk <- {plugin, tui, app, session-ui, slack, opencode, cli}; ui <- {tui, app, session-ui, storybook, desktop, enterprise, console-app, stats-app}.

`@opencode-ai/ui` is the only REQUIRED package that excluded surfaces (console-app, stats-app, desktop, enterprise, storybook) also depend on — dropping those surfaces leaves ui intact with no dangling edges into them.

## Workspace / build configuration

- Root `package.json` (name `opencode`, private): Bun workspaces `packages/*`, `packages/console/*`, `packages/stats/*`, `packages/sdk/js`, `packages/slack`, plus a shared version `catalog` (package.json:26-40). packageManager bun@1.3.14. Scripts: `dev` (runs packages/opencode with `--conditions=browser`), `dev:desktop`, `dev:web` (packages/app), `dev:console` (SST), `dev:stats` (SST), `dev:storybook`, `lint` (oxlint), `typecheck` (turbo), root `test` is blocked (package.json:8-23).
- `turbo.json`: tasks `typecheck`, `build` (outputs dist/**), and per-package `test` tasks for opencode, core, app, ui, session-ui only; globalEnv CI, OPENCODE_DISABLE_SHARE (turbo.json:3-30).
- Build scripts: `packages/opencode/script/build.ts` (standalone executable), `packages/sdk/js/script/build.ts` (regenerate JS SDK), `script/generate.ts` (SDK + related files after server changes). All three verified to exist.

## License findings

- Repo LICENSE at `C:\Users\ahammo\Repos\opencode\LICENSE`: **MIT License, Copyright (c) 2025 opencode**.
- Obligations for a private downstream fork: include the copyright notice and permission notice "in all copies or substantial portions of the Software" (LICENSE:11-12). MIT permits private modification, sublicensing, and commercial use; no copyleft, no source-disclosure duty. Warranty disclaimer applies as-is.
- Per-package licenses were not individually verified beyond the root LICENSE (`unverified` whether any sub-package declares a different license field); a `grep` of package.json license fields is a cheap follow-up.

## Experimental / churn flags

- **codemode**: added in cb9311442 ("feat: experimental codemode"), reverted in 379adee35, re-added in 2409c7a3d ("feat(codemode): add confined execution package") — currently present with zero consumers. Treat as unstable.
- **sdk-next / client / httpapi-codegen**: an in-flight SDK replacement chain; sdk-next README explicitly calls itself "transitional" and says it "will replace the existing generated @opencode-ai/sdk". The current sdk is still what everything depends on.
- **cli** (`lildax` bin): a second CLI implementation alongside packages/opencode with no reverse dependencies — appears to be a rewrite-in-progress. `unverified` whether it is shipped anywhere.
- **desktop-electron**: mentioned in CLAUDE.md as a package, but `packages/desktop-electron` does not exist at this HEAD — CLAUDE.md is stale on this point.
- **http-recorder**: dev-only across core/llm/opencode; excluding it breaks tests, not runtime.
