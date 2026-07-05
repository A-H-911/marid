import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"

// WBS-1.5 / WBS-1.1 hygiene: the marid binary compiles from src/ (entry
// src/marid.ts). Assert the distribution never pulls in a package the
// keep-remove matrix excludes — a stray import would drag an excluded package
// into the built binary. Grep-based, so it also catches a bad import added on
// an upstream sync. (keep-remove-matrix.md)
const EXCLUDED_PACKAGES = [
  "@opencode-ai/enterprise",
  "@opencode-ai/slack",
  "@opencode-ai/desktop",
  "@opencode-ai/console-app",
  "@opencode-ai/stats-app",
  "@opencode-ai/function",
  "@opencode-ai/web",
  "@opencode-ai/client",
  "@opencode-ai/sdk-next",
  "@opencode-ai/codemode",
]

const SRC = path.join(import.meta.dir, "..", "..", "src")

async function tsFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return tsFiles(full)
      return entry.name.endsWith(".ts") ? [full] : []
    }),
  )
  return nested.flat()
}

describe("marid profile hygiene: excluded packages absent from the build graph", () => {
  test.each(EXCLUDED_PACKAGES)("no source file imports %s", async (pkg) => {
    const files = await tsFiles(SRC)
    const importRe = new RegExp(`(from|import)\\s+["']${pkg.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&")}(["'/])`)
    const offenders: string[] = []
    for (const file of files) {
      const text = await Bun.file(file).text()
      if (importRe.test(text)) offenders.push(path.relative(SRC, file))
    }
    expect(offenders).toEqual([])
  })
})
