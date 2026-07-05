---
experiment: EXP-004
hypothesis: HYP-004
status: PASS (analysis-strength; live build + binary deferred — see Method)
version: v1.0
updated: 2026-07-04
owner: operator (STK-001)
---

# EXP-004 — Distribution-profile build probe (analysis half)

**Verdict: PASS (analysis-strength). Both analysis questions answered favorably; live build deferred.**

Validates [HYP-004](../hypothesis-register.md): *the `marid` distribution profile builds and passes
upstream tests with all excluded packages absent, without editing upstream files (and reveals whether the
P-1 server seam is even needed).* Blocks the Gate-6 verdict durability and the patch-surface register.

Per operator direction (2026-07-04), this report covers the two questions answerable **without `bun`**:
(1) keep-list filter correctness, (2) the P-1 seam question. The live build + test + binary half is
**deferred** (needs `bun`; see Method).

## Method (and deviation)

`bun` is not resolvable on this machine (confirmed in both the non-interactive tool shell and the
operator's interactive shell). So the "green build + upstream tests + one Bun-compiled binary" half of
EXP-004 could not run and is **deferred** to a bun-capable machine. The two questions below are answered
by **static analysis** of the workspace dependency graph and the server/plugin extension surface — no
build required — and are labeled analysis-strength.

## Q1 — Keep-list filter correctness: PASS

**Question:** would a workspace/turbo filter matching the keep-list produce a resolvable build — i.e., does
any *kept* package depend on an *excluded* one? (A kept→excluded edge breaks the filtered build.)

**Method:** parsed `dependencies` + `devDependencies` + `peerDependencies` of every `@opencode-ai/*`
package and cross-checked kept-package deps against the exclusion set from the
[keep-remove matrix](../../architecture/keep-remove-matrix.md).

**Keep-list** (build in `marid` profile): `opencode, core, llm, schema, protocol, server, tui, plugin,
sdk (packages/sdk/js), effect-drizzle-sqlite, effect-sqlite-node, script, ui, session-ui, app` +
dev-only `storybook, http-recorder`.
**Excluded:** `web(docs), desktop, console, function, stats, enterprise, slack, containers, docs,
identity, cli, client, sdk-next, httpapi-codegen, codemode`.

**Result: ZERO violations** — no kept package depends on any excluded package. The keep-list is
dependency-closed; the filtered `marid` build is graph-safe. This verifies the matrix's dependency-direction
assertions ("nothing depends on X") against the actual `package.json` graph, not just the prose.

**Not yet confirmed (deferred, needs bun):** that the filtered build *compiles green*, that kept
packages' upstream test suites *pass* with excluded packages un-built, and that `bun compile` yields a
working single binary. Graph-safety is necessary but not sufficient — a transitive *type* or runtime
import not captured in `package.json` could still surface only at build time.

## Q2 — P-1 server seam: ANSWERED — P-1 is avoidable for MVP

**Question:** can **marid-auth** (FR-030 request-ID correlation, FR-031 bearer-token auth, FR-032 rate
limiting, FR-033 audit log — all HTTP-ingress concerns) attach **without editing upstream server files**?
P-1 in the [patch-surface register](../../architecture/architecture.md) is explicitly conditional:
*"only if no equivalent plugin/server hook exists — verify in EXP-004."*

**Finding A — not via a plugin.** The plugin SDK `Hooks` interface (`packages/plugin/src/index.ts:222-291`)
exposes only agent/chat/tool lifecycle hooks — `event, config, tool, auth (provider auth), provider,
chat.message, chat.params, chat.headers, permission.ask, command.execute.before, tool.execute.before/after,
shell.env, experimental.chat.*`. **There is no HTTP-request / route / middleware hook.** marid-auth's
ingress concerns cannot be a plugin.

**Finding B — yes, via an outer composition wrapper (no server edit).** The server exports
`Server.Default.app.fetch` (`packages/opencode/src/server/server.ts:56-65`): a self-contained
`(request: Request) => Response | Promise<Response>` built from `HttpApiApp.webHandler()`
(`server.ts:57` → `httpapi/server.ts:314` = `HttpRouter.toWebHandler(...)`, the standard self-contained
Effect web-handler pattern also used for in-process serving in `sdk-next/src/opencode.ts:22`). It does
**not** require the `listen()` binder. So marid-server can:
1. own its own HTTP listener,
2. run marid-auth middleware (verify bearer token, rate-limit, write audit log, inject/echo `x-request-id`),
3. delegate authorized requests to `Server.Default.app.fetch(request)`.

This imports the exported handler and wraps it — **no edit to any upstream server file.** The `listen()`
function hardcodes its middleware chain internally (`server.ts:100-102`, `disposeMiddleware`), but marid
is not obliged to use `listen()`; wrapping `Default.app.fetch` is the seam.

**Conclusion:** **P-1 is not required for the MVP.** Recommend downgrading the P-1 row in the
patch-surface register from a *planned ~5-line upstream edit* to *not required — outer-wrapper seam
(`Server.Default.app.fetch`) suffices*. The one caveat that could reintroduce an edit later: marid-auth
via the outer wrapper runs **outside** the Effect HttpApi pipeline, so it cannot propagate a request-ID
*into upstream Effect spans/traces* (the deep half of FR-030) — bearer-auth, rate-limit, audit, and
header echo (FR-031-033 + FR-030 header) all work outside it. If in-pipeline trace correlation is later
required, that is the point to revisit a small P-1 edit.

## Decision impact

- **HYP-004: analysis half CONFIRMED.** Keep-list is dependency-closed (filtered build is graph-safe);
  the P-1 server seam is **avoidable** via the exported `Server.Default.app.fetch` composition wrapper.
- **Patch-surface register:** propose downgrading **P-1** to "not required for MVP (outer-wrapper seam)"
  — a register edit to make alongside this PH-0 PR, pending the deferred live-build confirmation.
- No Proposed DEC, no STOP (no FAIL signal; both questions favorable).

## Residual (deferred — needs bun)

Run the actual EXP-004 on a bun-capable machine before the Gate-6 durability sign-off:
1. `bun`/turbo build filtered to the keep-list; confirm green compile.
2. Run kept packages' upstream test suites with excluded packages un-built.
3. `bun compile` → one working single binary; smoke it.
4. Stand up marid-server wrapping `Server.Default.app.fetch` + a stub auth middleware; confirm a request
   without a valid token is rejected and a valid one is delegated (empirically closes Finding B).

## Next

EXP-004 analysis closed PASS (live build deferred). PH-0 status: EXP-001 ✅, EXP-002 ✅ (live diff
deferred), EXP-003 ⏳ (needs bot token), EXP-004 ✅ analysis (live build deferred). Ready for the MS-001
status note once EXP-003 is run or explicitly deferred.
