# Contributing to Marid

**Marid** is a private, single-operator distribution built as a **tracking fork of
[OpenCode](https://github.com/anomalyco/opencode)** (MIT). "Private" means the *intended usage* — one
operator, on a private network — **not** the repository: the repo and the signed releases are **public**
(DEC-010). Marid adds only four things on top of the inherited OpenCode runtime — `marid-gateway`
(the Marid Gateway; `marid-auth` is its auth module), `marid-instance`, `marid-telegram`, and a distribution
profile — as **new packages speaking existing interfaces** (DEC-009).

Because of that, the single most important thing to understand before contributing is **how work is
driven here**: docs first.

## Adding a feature the Marid way (docs-first)

Marid's plan and state live in **`docs/`** — a **[Keystone](../docs/README.md) package** that governs
requirements → decisions → work items → tests → acceptance, plus the tracking and validation gates.
Keystone governs the *docs and their consistency*; it is **not** a build or scaffolding system. Code
follows the docs, not the other way around.

The loop for any non-trivial change:

1. **Pick an acceptance criterion** (`AC-`) from [`docs/validation/acceptance-criteria.md`] — or, if none
   fits, propose one (and the decision/requirement behind it) first.
2. **Write the failing test** (`TEST-`) per [`docs/validation/test-strategy.md`] — real behavior, avoid mocks.
3. **Implement** to green. **Prefer a new package** over editing upstream; every direct upstream-file edit
   must be enumerated as a **`P-*` row** in the [patch-surface register](../docs/architecture/architecture.md)
   (preference order: new package → config → CI → last-resort upstream edit).
4. **Update the trackers** in the same change (the *tracking protocol* — see CLAUDE.md): progress log,
   status report, acceptance audit, roadmap/work-breakdown/milestones, `keystone-state.json`.
5. **Validate the docs package:** `python <keystone-skill>/scripts/validate_package.py docs/` must print
   `RESULT: OK`. Requires **Keystone ≥ 1.0.0** — 0.1.0 lacks the `G-PROGRESS` gate entirely and reports 31
   false duplicate-definition findings against the acceptance audit's bare `AC-` ids.
6. **Open a PR into `develop`** (squash). All **17 required checks** must be green.
7. **The operator merges** — never self-merge or merge unprompted (**INV-005**).

Authoritative references — **read these, this guide only points to them**:

- [`docs/README.md`](../docs/README.md) — the docs package map and where to start.
- [`docs/AGENTS.md`](../docs/AGENTS.md) — standing operating context, invariants, and the AC-first loop.
- [`CLAUDE.md`](CLAUDE.md) — the operating manual: the full tracking-protocol triggers, the **Git & CI
  flow**, patch-surface discipline, and the Windows **toolchain note**.

## Development environment

- Requirements: **Bun 1.3+**.
- Install and run:

  ```bash
  bun install                                   # Windows, if the native tree-sitter build fails: bun install --ignore-scripts
  bun run --cwd packages/opencode src/marid.ts  # runs the *marid* CLI (TUI) — data-isolated (__MARID_APP)
  bun run --cwd packages/opencode src/marid.ts <directory>   # run against a specific directory
  ```

  > Run **`src/marid.ts`**, not `bun dev`: `bun dev` runs the upstream `index.ts` entry (the un-isolated
  > `opencode` app), so isolation/rebrand behaviour won't reflect. `marid.ts` sets `__MARID_APP` first (P-6).

  > Windows: `bun install` rewrites the tracked `bun.lock`; run `git checkout -- bun.lock` afterward.
  > Tests must run from a package dir (`cd packages/opencode && bun test`), never the repo root. See the
  > CLAUDE.md **Toolchain note** for details.

- After changing the API or SDK (e.g. `packages/opencode/src/server/server.ts`), run `./script/generate.ts`
  to regenerate the SDK and related files.

- **Build a standalone binary** (Marid distribution profile):

  ```bash
  ./packages/opencode/script/marid-build.ts   # produces dist/marid-<target>/bin/marid-<target>
  ```

  (The upstream `build.ts --single` still exists but produces the `opencode` binary — Marid ships via
  `marid-build.ts`. See CLAUDE.md Part 2 for the full command set.)

### Debugging

Bun debugging is rough around the edges. The most reliable path is to run manually and attach a debugger:

```bash
bun run --inspect=ws://localhost:6499/ --cwd packages/opencode ./src/marid.ts serve --port 4096
```

Tips: `--inspect-wait`/`--inspect-brk` if you need to break before startup; `export
BUN_OPTIONS=--inspect=ws://localhost:6499/` to avoid repeating the flag. In VSCode, `"request": "launch"`
configs and the JavaScript Debug Terminal can map breakpoints incorrectly — prefer attach.

## Pull requests

- **Target `develop`, squash-merge.** `develop → main` happens via a release/sync PR (merge-commit). `main`
  is the protected release branch. (Full flow: CLAUDE.md "Git & CI flow".)
- **17 required checks** must be green before merge; you **cannot self-merge** — the operator merges on
  explicit instruction (INV-005).
- Keep PRs **small and focused**; explain the change and **how you verified it** (what you tested, how a
  reviewer reproduces it). Include screenshots for UI changes.
- **PR titles** follow conventional commits (enforced by `marid-pr-title`): `feat` / `fix` / `docs` /
  `chore` / `refactor` / `test`, optional scope, e.g. `feat(marid-gateway): …`, `fix(app): …`, `docs: …`.

## Style

Not strictly enforced, but the house style (mirrors CLAUDE.md's Style Guide):

- Keep logic in one function unless breaking it out adds real reuse/composition.
- No unnecessary destructuring; prefer dot access to preserve context.
- Avoid `else` after a `return`; prefer early returns.
- Prefer `.catch(...)` / Effect-based handling over `try`/`catch`.
- Precise types; **no `any`**; prefer inference over explicit annotations.
- Immutable patterns; prefer `const` over `let`.
- Concise, descriptive names.
- Use Bun APIs (`Bun.file()`) when they fit.

## Security

See [SECURITY.md](SECURITY.md). Report suspected vulnerabilities privately to the operator via this repo's
GitHub Security Advisories — not in a public issue. AI-generated security reports are not accepted.
