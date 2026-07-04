---
artifact: experiment-report
experiment: EXP-002
hypothesis: HYP-002
status: PASS (audit-strength; live two-instance filesystem diff deferred — see Method)
version: v1.0
updated: 2026-07-04
---

# EXP-002 — Two-instance isolation probe

**Verdict: PASS (audit-strength). HYP-002 confirmed, with two refinements to the env set.**

Validates [HYP-002](../hypothesis-register.md): *env-var composition (XDG overrides + `OPENCODE_DB` +
port) yields complete instance isolation for every item in the R-05 conflict inventory.* Blocks the
marid-instance design freeze; verifies [ADR-0006](../../adrs/adr-0006-instance-isolated-runtime-env-namespacing.md).

## Result in one line

Every **instance-state** write (DB, auth, config, cache, logs, snapshots, storage, locks) routes
through an XDG-derived `Global.Path.*` (`packages/core/src/global.ts:10-31`), so composing
`XDG_DATA/CACHE/CONFIG/STATE_HOME` (+ per-instance port, + `OPENCODE_DB`) namespaces the whole runtime.
Two refinements complete the env set: **(1)** the port must be explicitly *allocated* (already in the
hypothesis), and **(2)** `os.tmpdir()/opencode` is not relocated by XDG — add `TMPDIR/TMP/TEMP` to the
composed env (one line; `os.tmpdir()` honors them). Neither is an open decision.

## Method (and deviation from the plan)

The hypothesis-register SETUP asks to *launch two instances via a prototype launcher and diff the two
trees + real HOME for stray writes.* **`bun` is not resolvable on this machine** — confirmed absent from
`PATH` in both the non-interactive tool shell *and* the operator's interactive shell (`bun --version`
→ `command not found`). Launching two `serve` instances therefore could not be executed here.

EXP-002's core is a **negative claim** ("zero writes outside each instance's tree") that green tests
structurally cannot prove — a stray write to real HOME passes silently under the test harness's
`:memory:` DB + pid-keyed dirs. The rigorous substitute for the live diff is a **write-site / read-site
code audit**: enumerate every filesystem write and every home/`~`-relative read, and verify each routes
through a per-instance-overridable path. That audit is what this report rests on; the live two-instance
filesystem diff remains the one **deferred** step, to be run on a machine with `bun` before the
marid-instance design freeze (see Residual).

## The isolation lever (code)

`packages/core/src/global.ts:10-31` derives **all** base dirs from XDG env vars (read at import by the
`xdg-basedir` package) and only ever `mkdir`s those `Path.*` dirs (`global.ts:35-43`):

| Base dir | Source | Per-instance lever |
|---|---|---|
| data | `xdgData/opencode` | `XDG_DATA_HOME` |
| cache | `xdgCache/opencode` | `XDG_CACHE_HOME` |
| config | `xdgConfig/opencode` | `XDG_CONFIG_HOME` (or `OPENCODE_CONFIG_DIR`, `global.ts:64`) |
| state | `xdgState/opencode` | `XDG_STATE_HOME` |
| home | `OPENCODE_TEST_HOME ?? os.homedir()` (`global.ts:19`) | `OPENCODE_TEST_HOME` (only home override) |
| tmp | `os.tmpdir()/opencode` (`global.ts:15`) | `TMPDIR`/`TMP`/`TEMP` (**not** an OPENCODE var) |

**In-practice proof for the XDG family:** `packages/opencode/test/preload.ts:34-87` composes exactly
this env per test process (pid-keyed tree: `XDG_*_HOME`, `OPENCODE_TEST_HOME`, `OPENCODE_DB`). The full
suite reads/writes DB, auth, config, cache, logs, snapshots, and storage under that composed tree and is
green on **windows-latest + ubuntu-latest + macos-latest** (CI run `28695064894` @ `develop` HEAD
`3efd61632`). This confirms the composition correctly relocates those paths on all three OSes — including
the Windows resolution the R-05 doc flagged as unverified (`05-config-...:27`).

## R-05 conflict inventory → isolation (all 10 items)

| # | Resource | Path | Isolated by | Status |
|---|---|---|---|---|
| 1 | HTTP port 4096 | TCP | explicit per-instance allocation (marid-instance) | ✓ by-design (in HYP env set) |
| 2 | SQLite DB | `{data}/opencode.db` | `XDG_DATA_HOME` or `OPENCODE_DB` | ✓ |
| 3 | auth.json | `{data}/auth.json` | `XDG_DATA_HOME` | ✓ |
| 4 | mcp-auth.json | `{data}/mcp-auth.json` | `XDG_DATA_HOME` | ✓ |
| 5 | global config | `{config}/opencode.json(c)` | `XDG_CONFIG_HOME` / `OPENCODE_CONFIG_DIR` | ✓ |
| 6 | log file | `{data}/log/opencode.log` | `XDG_DATA_HOME` | ✓ |
| 7 | models.dev cache | `{cache}/models.json` | `XDG_CACHE_HOME` | ✓ |
| 8 | tool binaries | `{cache}/bin` | `XDG_CACHE_HOME` | ✓ |
| 9 | locks dir | `{state}/locks` | `XDG_STATE_HOME` | ✓ |
| 10 | temp | `os.tmpdir()/opencode` | `TMPDIR`/`TMP`/`TEMP` | ⚠ needs env beyond XDG (see below) |
| 11 | snapshot/worktree/storage | `{data}/…` | `XDG_DATA_HOME` | ✓ |

## The two refinements

**Port (item 1)** — the process auto-falls-back to a random free port when 4096 is taken
(`server.ts:117-122`), but clients default to 4096 (`attach.ts:14`, `plugin/index.ts:143`), so isolation
requires marid-instance to *allocate and record* a port per instance. Already the hypothesis's "+ port"
term and an explicit ADR-0006 responsibility. Not a gap.

**Temp (item 10)** — `os.tmpdir()/opencode` is shared and not moved by any `XDG_*`/`OPENCODE_*` var.
Audited every write into it: all are collision-free by construction —
`models-dev.ts:182` (`.{pid}.{Date.now()}.tmp`), `skill/discovery.ts:95` / core `:167`
(`.tmp-${token}` staging), `lsp/server.ts:1246` (`fs.mkdtemp`, unique random dir). The R-05 summary
(`05-config-...:105`) likewise omits temp from the concrete-breakage list. So the shared dir is *benign*
today, and full isolation is a **one-line completion**: marid-instance composes `TMPDIR/TMP/TEMP` per
instance (`os.tmpdir()` honors them). Trivial, obviously-correct → a design note in ADR-0006's env set,
**not** an open decision.

## Home-relative reads (the stray-read audit)

Home reads split cleanly, and none write cross-instance state to real HOME:

- **opencode's own home-relative reads use the overridable getter** `Global.Path.home`
  (`OPENCODE_TEST_HOME`-aware): `instruction.ts:62,138` (`~/.claude/CLAUDE.md`), `skill/index.ts:191,212`,
  `config/paths.ts:36-37`, `config/plugin/{reference,skill}.ts`. → isolatable.
- **Raw `os.homedir()` calls are intentional, not leaks:** user-intent `~`/`$HOME` expansion
  (`permission/index.ts:179-182`, `tool/shell.ts:136-149`, `session/prompt.ts:171`, `config/variable.ts:63`),
  shared external-tool discovery (`lsp/server.ts:779,790-793` — .vscode/dotnet, which *should* see the
  real machine), and safety checks (`filesystem/protected.ts:4`, deny-writes-to-home). These are reads /
  user-scoped path resolution, not instance runtime-state writes.

**Write-primitive audit (closes the bypass routes):**
- **Env-based home reads** (`process.env.HOME` / `USERPROFILE` / `APPDATA` / `LOCALAPPDATA`): **none
  found** in `packages/{opencode,core}/src` — the only home levers are `os.homedir()` (above) and the
  `OPENCODE_TEST_HOME`-aware getter.
- **Write primitives** (`writeFile*`, `writeWithDirs`, `Bun.write`, `appendFile*`, `createWriteStream`)
  resolve to three roots, none raw home: (a) instance-state under `Global.Path.*` — config (`config.ts`),
  cache/models/ripgrep (`models-dev.ts:183`, `ripgrep/binary.ts:117`), log, storage, snapshot; (b) the
  **user's worktree / project files** the agent edits (`patch/index.ts:546`, `apply_patch.ts:239`,
  `file-mutation.ts`, `truncate.ts` — intended, project-keyed); (c) user-directed CLI output
  (`run/trace.ts`).

**Conclusion of the audit:** no instance-state write bypasses `Global.Path.*` to reach raw
`os.homedir()`, an env-based home path, or an un-relocated temp path.

## Residual (what the audit cannot fully close)

- **The live two-instance filesystem diff was not run** (no `bun`). The audit substantiates "every
  known write routes through an overridable path"; only a real diff can catch a genuinely *unknown*
  stray write (e.g. from a transitive dependency writing to `$HOME` directly). Recommend running the
  actual EXP-002 (two `serve` instances + `diff` of trees + HOME snapshot before/after) on a
  bun-capable machine before the marid-instance design freeze. Low expected risk given the audit.
- `{cache}/bin` concurrent LSP downloads to identical paths are not obviously locked
  (`05-config-...:100`, unverified) — but with per-instance `XDG_CACHE_HOME` each instance has its own
  `{cache}/bin`, so cross-instance torn installs do not arise under the isolation model (intra-instance
  concurrency is a separate, pre-existing concern, out of EXP-002 scope).

## Decision impact

- **HYP-002: CONFIRMED (audit-strength).** Env composition isolates all 10 conflict-inventory items,
  given the env set = `XDG_DATA/CACHE/CONFIG/STATE_HOME` + `OPENCODE_DB` + allocated port + `TMPDIR/TMP/TEMP`
  (+ optionally `OPENCODE_TEST_HOME` to relocate home-relative opencode reads).
- **ADR-0006 verified**, with one addition to its documented env set: `TMPDIR/TMP/TEMP`.
- No Proposed DEC and no STOP (tmp is a trivial env-set completion, not an either/or; PASS overall).

## Next

EXP-002 closed PASS (audit-strength; live diff deferred) → proceed to EXP-003 (Telegram cadence) and
EXP-004 (distribution-profile build) to complete MS-001, then the MS-001 status note that unblocks PH-1.
