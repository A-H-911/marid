# Marid on OpenCode — Architecture Diagrams

Newcomer-oriented diagrams of the monorepo, showing **both the upstream OpenCode runtime and Marid's
additions**. Each has a **`.png`** (open it) and a **`.svg`** (crisp zoom); the editable Tarseem spec lives
in **`specs/`** (rendered with [Tarseem](#regenerate), not Mermaid).

**Marid colour legend** (the README palette, applied across every diagram):

| Colour | Meaning |
|---|---|
| 🟥 **red** | `marid-auth` — the bearer-token auth / deny-by-default boundary |
| 🟧 **orange** | `marid-telegram` — the channel gateway (separate process, untrusted ingress) |
| ⬛ **dark** | `marid-instance` / the session engine + runtime (reused from OpenCode) |
| 🟦 **blue** | client/access surfaces (TUI, Web, API) |
| ⬜ neutral | upstream OpenCode internals, **reused as-is** |

Marid adds only four things as **new packages speaking existing interfaces** (`marid-auth`,
`marid-instance`, `marid-telegram`, a distribution profile). Diagrams are split into two folders:
**`Marid/`** — the overlay-bearing views (01, 02, 05, 13, 14, 17, 18); and **`OpenCode/`** — the upstream
internals Marid reuses as-is. The swimlane (18) uses the `corporate` theme so its lane colours don't collide
with the semantic Marid palette above. (The root `README.md` keeps its own inline **Mermaid** topology +
channel-policy diagrams, rendered by GitHub.)

Suggested reading order:

| # | Diagram | Type | What it teaches |
|---|---------|------|-----------------|
| 01 | [Architecture overview](Marid/01-architecture-overview.png) | architecture | The whole system on one line: surfaces → CLI/API → session → LLM/tools/DB |
| 02 | [Package dependencies](Marid/02-package-dependencies.png) | dependency | How the 25 `@opencode-ai/*` packages depend on each other (the decomposition) |
| 03 | [Technology stack](OpenCode/03-tech-stack.png) | mindmap | The libraries/tech grouped by concern — start here to learn the stack |
| 04 | [Module map](OpenCode/04-modules-map.png) | mindmap | A tour of `packages/opencode/src/` modules by responsibility |
| 05 | [Runtime data flow](Marid/05-data-flow.png) | flowchart | What happens when you send a prompt (request → LLM → tool loop → DB → UI) |
| 06 | [Agent run loop](OpenCode/06-session-sequence.png) | sequence | The same flow as a sequence diagram across actors (usage view) |
| 07 | [Database (ER)](OpenCode/07-database-er.png) | er | SQLite tables in `packages/core` and their relationships |

## Change-impact / extension-point diagrams

These answer *"if I change X, what moves?"* — use them when modifying, not just learning.

| # | Diagram | For the task… | What it shows |
|---|---------|---------------|---------------|
| 08 | [TUI seam](OpenCode/08-tui-seam.png) | remove / replace the TUI | red `[DELETE]` vs green `[keep]`: exactly which files/route-groups to drop and which stay |
| 09 | [TUI blast-radius](OpenCode/09-tui-blast-radius.png) | remove any package | reverse-deps (consumers above, deps below) — the safe-removal scope |
| 10 | [Streaming pipeline](OpenCode/10-streaming-pipeline.png) | add a stream channel | the 4 edit points: schema event → emit → projector → client subscribe |
| 11 | [Streaming sequence](OpenCode/11-streaming-sequence.png) | add a stream channel | server→client ordering + **replay** via the `seq` columns |
| 12 | [Boot & layers](OpenCode/12-boot-layers.png) | add observability | where the Effect layers compose → where to inject the OTel layer + trace middleware |
| 13 | [Process & telemetry](Marid/13-deployment.png) | add observability | runtime processes (server, MCP/LSP subprocesses, client) + where spans export (OTLP) |
| 14 | [Capability registry](Marid/14-capability-registry.png) | add a tool/provider/MCP | the registry extension points = add-a-capability recipe |

## Deep-dive diagrams

| # | Diagram | Type | What it teaches |
|---|---------|------|-----------------|
| 15 | [Session lifecycle](OpenCode/15-session-lifecycle.png) | state | Legal session transitions: idle ⇄ busy ⇄ retry, compacting, archive, fork, revert (status values from `schema/session-status-event.ts`) |
| 16 | [Message domain model](OpenCode/16-message-domain-model.png) | class | Session → MessageV2 → Part union (`text` / `reasoning` / `tool` / `file` / `step-start`) with branded IDs — read before touching rendering or storage |
| 17 | [Permission flow](Marid/17-permission-flow.png) | activity | Tool call → rule eval (`allow`/`deny`/`ask`) → question → reply (`once`/`always`/`reject`) — the human-in-the-loop path |
| 18 | [Contributor workflow](Marid/18-contributor-workflow.png) | swimlane | The Marid dev loop across You / Local repo / GitHub-CI lanes (install → dev → check → test → generate → **PR to `develop`** → 17 checks → operator merge). Uses the `corporate` (cool blue/slate/teal) theme to avoid colliding with the Marid red/orange palette. |
| 19 | [Codegen pipelines](OpenCode/19-codegen-pipeline.png) | flowchart | The two generate-then-commit chains: API (`./script/generate.ts` → openapi + SDK) and DB (`bun db generate` → `schema.gen.ts`) |
| 20 | [Gateway & mirroring](Marid/20-gateway-mirroring.png) | flowchart | **PH-6**: the marid-auth **gateway** (`/marid/*` binding routes + `owns ∪ bound` SSE filter) + **`@marid/channel-client`** (subscribe / reconnect / re-fetch) + **cross-surface mirroring** + Telegram tool calling over the sync `/session/{id}/message` route — the channel platform on top of the Gate-5 design |

> Verified wiring: OTel lives in `packages/core/src/observability/otlp.ts` (spans via `Effect.withSpan`);
> boot is `packages/opencode/src/cli/bootstrap`; streaming persists to `event_sequence`/`event` and the
> projector layer (`server/projectors.ts`) is still nascent (`initProjectors()` is currently a stub).

## Where to go in the code

- **Start the app:** `packages/opencode/src/index.ts` (CLI) → `@opencode-ai/{server,tui}`
- **API surface:** `packages/protocol/src/api.ts` (Effect `HttpApi`)
- **Agent loop:** `packages/opencode/src/session/` (`session.ts`, `processor.ts`)
- **Tools:** `packages/opencode/src/tool/` · **Providers:** `…/provider/` · **LLM:** `packages/llm/src/`
- **Database:** `packages/core/src/database/`

The text companion to these diagrams is the design package itself — [`architecture.md`](../architecture.md)
(target architecture + patch-surface register) and [`api-event-contract.md`](../api-event-contract.md) (the
route/event surface). A generated token-lean codemap set (`/update-codemaps`) is not yet part of this package.

## Regenerate

Diagrams live under two folders — **`Marid/`** (Marid-overlay views) and **`OpenCode/`** (upstream internals,
reused as-is) — each with its own `specs/`. Rendered with [Tarseem](#regenerate) from the JSON specs:

```bash
D=docs/architecture/diagrams
# render one spec to PNG + SVG
tarseem generate $D/Marid/specs/01-architecture-overview.json -f svg,png -o $D/Marid/ -n 01-architecture-overview

# render all (both folders)
for sub in Marid OpenCode; do
  for f in $D/$sub/specs/*.json; do
    tarseem generate "$f" -f svg,png -o "$D/$sub/" -n "$(basename "$f" .json)"
  done
done
```

Edit a `specs/*.json` and re-run. Other export formats: `-f pdf,drawio,pptx`. **Guardrail:** never put a
governed id (`INV-001`, `AC-014`, …) in a diagram label — `validate_package.py docs/` scans these JSON files.

> Snapshot: 2026-07-09 (Marid overlay). The monorepo is mid-decomposition (`opencode` monolith →
> `@opencode-ai/*`); re-render after large structural changes.
