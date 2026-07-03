# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
bun install

# Run the CLI (TUI mode) in packages/opencode by default
bun dev

# Run against a specific directory
bun dev <directory>

# Start headless API server (port 4096)
bun dev serve

# Start server + open web interface
bun dev web

# Run web UI separately (requires server running)
bun run --cwd packages/app dev

# Run desktop app (requires Tauri/Rust toolchain)
bun run --cwd packages/desktop tauri dev

# Lint
bun lint

# Type check (run from a package directory, e.g. packages/opencode)
bun typecheck

# Run tests (must be run from a package directory, NOT from repo root)
cd packages/opencode && bun test

# Build standalone executable
./packages/opencode/script/build.ts --single

# Regenerate the JS SDK (after API changes)
./packages/sdk/js/script/build.ts

# Regenerate SDK + related files (after server.ts changes)
./script/generate.ts
```

## Architecture

OpenCode is a monorepo (Bun workspaces + Turbo) containing an AI-powered development agent.

### Core Packages

- **`packages/opencode`** — The main CLI, server, and TUI. All business logic lives here: agent orchestration, provider integration (15+ LLM providers via Vercel AI SDK), LSP, MCP, file watching, git, config, and the SQLite database (Drizzle ORM). The TUI is built with SolidJS + OpenTUI.
- **`packages/app`** — Shared web/desktop UI components (SolidJS + Vite + Tailwind). Used by both the web and desktop surfaces.
- **`packages/ui`** — Design system: components, themes, icons, i18n, diff viewer (Pierre).
- **`packages/desktop`** — Native Tauri v2 app wrapping `packages/app`.
- **`packages/desktop-electron`** — Electron-based alternative desktop app.
- **`packages/plugin`** — Plugin SDK (`@opencode-ai/plugin`) for extending OpenCode with custom tools and TUI plugins.
- **`packages/sdk/js`** — Generated TypeScript client for the OpenCode HTTP API.
- **`packages/core`** — Shared utilities (Effect, OpenTelemetry, versioning, global config).
- **`packages/console`** — Admin/management console (SolidStart + Cloudflare Workers + Stripe).

### Key Architectural Patterns

**Multi-runtime support:** `packages/opencode` uses Bun conditional imports (`#db`, `#pty`, `#hono`) to swap implementations between browser and Node/Bun environments. The TUI runs with `--conditions=browser`.

**Server/client split:** `bun dev` runs the CLI in-process. In production, `opencode serve` exposes an HTTP API (Hono, port 4096) that the web/desktop clients connect to.

**`src/config` self-export pattern:** Config modules export themselves with `export * as Config<Name> from "./module"` at the top of the file. Follow this pattern when adding config modules.

**Effect for async/functional patterns:** The codebase uses the [Effect](https://effect.website) library for functional composition, especially in `packages/core` and server code.

## Style Guide

- **No `any` types.** Use precise types; rely on inference over explicit annotations.
- **No `try`/`catch`.** Prefer `.catch(...)` or Effect-based error handling.
- **Prefer `const`.** Use ternaries or early returns instead of reassignment.
- **No `else` after a `return`.** Use early returns.
- **Inline single-use values** rather than creating intermediate variables.
- **No unnecessary destructuring.** Use dot notation (`obj.a`) to preserve context.
- **Use `Bun.file()`** and other Bun APIs instead of Node equivalents when available.
- **Drizzle schema fields:** Use `snake_case` for field names so column names don't need string overrides.
- **Array methods over `for` loops:** Prefer `map`, `filter`, `flatMap`; use type guards on `filter` to maintain inference.

## Testing

- Tests **cannot run from the repo root** — there is a guard that exits with an error.
- Run tests from a package directory: `cd packages/opencode && bun test`
- Avoid mocks; test actual implementations against real behavior.

## Default Branch

The default branch is `dev`. The local `main` ref may not exist; use `dev` or `origin/dev` for diffs and PR targets.
