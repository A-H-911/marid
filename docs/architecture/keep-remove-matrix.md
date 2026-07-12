---
status: Approved (gate 6, 2026-07-03)
version: v1.0
updated: 2026-07-08
owner: operator (STK-001)
---

# Keep / Change / Exclude / Remove Matrix (Gate 6)

Strategy baseline (C-2, front-runner): **distribution profile** — files stay in the repo (zero merge
conflicts), excluded packages are simply not built, published, or shipped. "Remove" (physical deletion)
is used for nothing in the MVP. Rollback for any exclusion = re-add the package to the build filter.

## Packages

| Package | Verdict | Dependency impact | Strategy | Merge-conflict risk | Tests needed before | Rollback |
|---|---|---|---|---|---|---|
| opencode, core, llm, schema, protocol, server, tui, plugin, sdk, effect-drizzle-sqlite, effect-sqlite-node, script | **Keep as-is** | Foundation of everything | Build in `marid` profile | n/a | Upstream suites keep running | n/a |
| ui, session-ui, app | **Keep as-is** (web UI keep-list, resolves OQ-005) | app→ui,session-ui,sdk | Build + ship in profile | n/a | Web smoke test | n/a |
| web (docs site) | **Exclude from distribution** | Depends on opencode; nothing depends on it | Not built/shipped; repo copy may later seed Marid docs | None (untouched) | None | Add to profile |
| desktop (Electron) | **Exclude** (CON-004) | Wraps app; nothing depends on it | Not built/shipped | None | None | Add to profile |
| console, function, stats | **Exclude** (cloud/enterprise, CON-004) | Cloud-only deps (Stripe/Planetscale/R2/SST); nothing required depends on them | Not built/shipped | None | None | Add to profile |
| enterprise | **Exclude, defer decision on share feature** | Self-hosted share-link server; session-ui consumer | Not built in MVP; revisit if session sharing is wanted | None | None | Add to profile |
| slack | **Exclude; pattern harvested** | One-off prototype (R-06) | Not built; marid-telegram supersedes the role | None | None | n/a |
| containers, docs, identity | **Exclude** (CI images / upstream docs / logo assets) | None inward | Not built/shipped | None | None | Add to profile |
| cli (`lildax` rewrite), client, sdk-next, httpapi-codegen | **Keep in repo, excluded from distribution** | v2/next-gen chain; zero current consumers of cli | Not shipped; tracked at each sync (C-4 trigger) | None | None | Ship when v2 stabilizes |
| codemode (`@opencode-ai/codemode`) | **Exclude** (experimental, zero consumers, churning) | One dynamic importer `tool/code-mode.ts`, gated behind the default-off `experimentalCodeMode` flag | Not built/shipped — `external` in `marid-build.ts` keeps it out of the binary | None | Hygiene allowlist (`hygiene.test.ts` single-file exception) | **Realized in the 2026-07-07 sync (#31)**: a NEW upstream package; reconciled per ADR-0002 via `external` + single-file hygiene allowlist (no binary leak) |
| storybook, http-recorder | **Keep as dev tooling, never shipped** | http-recorder used by tests | Dev-only | None | Existing tests | n/a |

## Capabilities (§4 classification, evidence in gate-4 assessment)

| Capability | Classification | Note |
|---|---|---|
| Agent loop, tools, permissions, skills/commands/rules, subagents, sessions/history, streaming, branching/cancel/resume, storage+migrations, MCP, providers, event bus | **Keep as-is** | FR-001..017 |
| Server/API, SDK | **Keep with changes** | `marid-gateway` middleware layer on the seam (marid-auth is its auth module, ADR-0011); v1 SDK reused |
| Config | **Keep with changes** | Instance layer via env composition; secret-reference + redaction additions |
| Plugins | **Keep with changes** | Trust policy at gate 8 (in-process, unsandboxed today) |
| LSP | **Make optional** | `lsp:false` default in Marid profile; config re-enables |
| Caching | **Keep as-is, namespaced per instance** | models.json Flock-safe; LSP bin cache isolated per instance |
| Observability | **Keep with changes** | OTLP reused; audit stream added; GenAI attrs pinned |
| Desktop/IDE/editor surfaces | **Exclude** | CON-004 |
| Cloud share/telemetry (console/function/stats/enterprise) | **Exclude** (share: **Defer**) | Revisit share if wanted |
| Auto-update (patch self-update) | **Keep with changes** | Re-point at private releases; gh-token-authenticated |
| Channels | **New** (marid-telegram; slack retired) | FR-045..052 |
| Multi-instance | **New** (marid-instance) | FR-053 |

Open question folded in: the **session share feature** (share links render via cloud/enterprise pieces) —
excluded from MVP; flagged as a Deferred decision with trigger "operator wants shareable session links".
