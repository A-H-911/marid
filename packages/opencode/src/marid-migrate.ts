// MARID DATA MIGRATION (WBS-8.2, DEC-025 / AC-031). One-time copy of a populated
// pre-isolation OpenCode data/state into the isolated marid dirs. A machine that
// ran marid v0.2.0 shared OpenCode's machine-global dirs; after P-6 the marid
// binary reads/writes `~/.local/share/marid` instead, so without this the upgrade
// would strand the operator's auth, gateway bearer tokens, sessions DB, Telegram
// pairing, and model selection in the old `opencode` dir. This copies them once.
//
// INV-002: logs a COUNT only — never file names or contents (auth.json and the
// gateway-token dir are secrets).
import path from "path"
import fs from "fs/promises"
import { xdgData, xdgState } from "xdg-basedir"
import { Global } from "@opencode-ai/core/global"

// The marker lives in the (already-created) marid data dir. Its presence means
// migration has run — or was intentionally skipped on a fresh machine — so it
// NEVER re-runs. global.ts mkdir's the marid dirs unconditionally at load, so a
// "target dir missing" check would never fire; the marker is the real trigger.
const MARKER = path.join(Global.Path.data, ".marid-migrated")

// Regenerable caches — not worth copying (can be large; rebuilt on demand).
const SKIP_AT_ROOT = new Set(["repos", "log"])

async function exists(p: string): Promise<boolean> {
  return fs
    .access(p)
    .then(() => true)
    .catch(() => false)
}

async function copyDir(src: string, dest: string, skip?: Set<string>): Promise<number> {
  let count = 0
  const entries = await fs.readdir(src, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (skip?.has(entry.name)) continue
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await fs.mkdir(d, { recursive: true })
      count += await copyDir(s, d)
    } else if (entry.isFile()) {
      // Never overwrite a file that already exists in the isolated dir.
      if (await exists(d)) continue
      await fs.copyFile(s, d)
      count++
    }
    // symlinks/others skipped: auth/db/tokens/sessions are all plain files.
  }
  return count
}

export async function maridMigrate(): Promise<void> {
  if (await exists(MARKER)) return

  // Compute the pre-isolation OpenCode source dirs INDEPENDENTLY of Global.Path,
  // which now resolves to the marid dirs. `data` carries auth.json, mcp-auth.json,
  // opencode.db, and the `marid/` gateway-token store; `state` carries model.json.
  const pairs: Array<[string, string]> = [
    [path.join(xdgData!, "opencode"), Global.Path.data],
    [path.join(xdgState!, "opencode"), Global.Path.state],
  ]

  let migrated = 0
  for (const [src, dest] of pairs) {
    // Guard against copying a dir into itself (would happen only if __MARID_APP
    // resolved back to "opencode"); this migration only runs from the marid entry.
    if (path.resolve(src) === path.resolve(dest)) continue
    if (!(await exists(src))) continue
    migrated += await copyDir(src, dest, dest === Global.Path.data ? SKIP_AT_ROOT : undefined)
  }

  if (migrated > 0)
    process.stderr.write(
      `[marid] one-time migration: copied ${migrated} item(s) from a pre-isolation OpenCode install into the isolated marid dirs.\n`,
    )

  // Write the marker unconditionally (even when nothing was migrated) so a fresh
  // machine never re-scans on every launch.
  await fs.writeFile(MARKER, new Date().toISOString() + "\n").catch(() => {})
}
