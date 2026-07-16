import { expect, test } from "bun:test"
import { sessionEpilogue } from "../../src/util/presentation"
import { logo as brand } from "../../src/logo"

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "")

test("formats session continuation summary", () => {
  const epilogue = sessionEpilogue({ title: "A session", sessionID: "ses_123" })
  expect(epilogue).toContain("A session")
  expect(epilogue).toContain("marid -s ses_123")
})

test("renders the current Marid mark from logo.ts (no stale OpenCode block-art)", () => {
  const stripped = stripAnsi(sessionEpilogue({ title: "t", sessionID: "s" }))
  // The wordmark rows come straight from logo.ts — so a rebrand/height change can't leave a stale
  // goodbye. (String greps can't see block-ASCII art; this is the structural guard for it.)
  for (const row of brand.right) expect(stripped).toContain(row.trimEnd())
  // The old hand-rolled logo used a `_ ^ ~` shading font — none of those may remain.
  expect(stripped).not.toContain("^")
  expect(stripped).not.toContain("~")
})
