// MARID RUNTIME BOOTSTRAP — MUST be the first import in src/marid.ts, before any
// module that transitively loads @opencode-ai/core/global (which derives all
// data/state/config dirs from the app-name at module-load time, via a top-level
// await). ES module imports are evaluated in source order, so importing this
// first guarantees these env vars are set before global.ts runs.
//
// P-6 (WBS-8.2 data isolation). The compiled binary bakes the app-name via a
// build-time define ("process.env.__MARID_APP": '"marid"' in marid-build.ts) that
// rewrites the *dot-notation* read in global.ts. In dev (`bun run src/marid.ts`,
// no define) we set it at runtime here instead. Bracket notation is deliberate:
// the define only rewrites the exact token `process.env.__MARID_APP`, so
// `process.env["__MARID_APP"]` is NOT rewritten — it stays valid runtime code in
// both dev and the binary (harmless in the binary, whose global.ts already reads
// the baked "marid"). `??=` leaves an explicit override in place (dev escape hatch).
//
// Note: setting it on process.env means it is inherited by every child process the
// binary spawns (shell tools, MCP servers, plugins). That is harmless — upstream
// `opencode`'s own global.ts does not read __MARID_APP — but is why a co-located
// opencode child would still use its own dirs, not marid's.
process.env["__MARID_APP"] ??= "marid"

// Issue #1 (update popup): a plain marid binary must never offer to self-update
// into the upstream `opencode` npm binary. The upgrade guard (cli/upgrade.ts)
// short-circuits on this flag (Flag.OPENCODE_DISABLE_AUTOUPDATE). Belt-and-braces
// with the P-3 config default; the env alone fully disables the check.
process.env["OPENCODE_DISABLE_AUTOUPDATE"] ??= "1"

export {}
