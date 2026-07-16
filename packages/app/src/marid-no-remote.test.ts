import { test, expect } from "bun:test"
import { Glob } from "bun"
import { join } from "node:path"

// AC-030 guard (Marid PH-8 web rebrand): no opencode.ai remote may be referenced in
// the shipped web code (packages/app + packages/ui). This catches a sync regression
// that re-introduces a fetch, notification icon, <img src>, or click-through link to
// opencode.ai. Scans .ts/.tsx only (theme $schema JSON is excluded by extension).
//
// Allowlist (not remote fetches): i18n display translation strings, the dev-only
// origin hostname heuristic, comments, and this test file itself.

const PACKAGES = join(import.meta.dir, "..", "..")
const SCAN_DIRS = [join(PACKAGES, "app", "src"), join(PACKAGES, "ui", "src")]
const NEEDLE = "opencode" + ".ai"

function isAllowed(path: string, line: string): boolean {
  const unix = path.replaceAll("\\", "/")
  if (unix.includes("/i18n/")) return true
  if (unix.endsWith("marid-no-remote.test.ts")) return true
  const trimmed = line.trim()
  if (trimmed.startsWith("//") || trimmed.startsWith("*")) return true
  if (line.includes("hostname")) return true
  return false
}

test("no opencode.ai remote is referenced in the web UI (AC-030)", async () => {
  const offenders: string[] = []
  for (const dir of SCAN_DIRS) {
    const glob = new Glob("**/*.{ts,tsx}")
    for await (const rel of glob.scan(dir)) {
      const full = join(dir, rel)
      const lines = (await Bun.file(full).text()).split("\n")
      lines.forEach((line, i) => {
        if (!line.includes(NEEDLE)) return
        if (isAllowed(full, line)) return
        offenders.push(`${full}:${i + 1}: ${line.trim()}`)
      })
    }
  }
  expect(offenders).toEqual([])
})
