#!/usr/bin/env bun
/**
 * Strip upstream GitHub Actions workflows that do not apply to the Marid fork.
 *
 * Upstream (anomalyco/opencode) ships ~26 workflows wired to its own infra:
 * self-hosted `blacksmith-*` runners, the `dev` branch, `.github/TEAM_MEMBERS`
 * governance, and org publish/deploy/release/stats/beta pipelines. On the fork
 * these either fail, queue forever, or (worse) fire scheduled publish/deploy jobs.
 * Marid runs its own CI (`ci.yml`); everything else is removed.
 *
 * This script is idempotent. It is the durable mechanism referenced by
 * docs/architecture/upstream-sync-strategy.md: the upstream-sync workflow runs it
 * after every merge so re-introduced upstream workflows are stripped automatically
 * and we never re-litigate the same CI breakage. When Marid adds its own workflows
 * (e.g. a release or sync pipeline in PH-5), add them to KEEP.
 *
 * Usage: `bun run script/strip-upstream-workflows.ts`
 */
import { readdirSync, rmSync } from "fs"
import path from "path"

const WORKFLOWS_DIR = path.join(".github", "workflows")

// Marid-owned workflows to preserve. Everything else under .github/workflows is upstream.
const KEEP = new Set([
  "ci.yml",
  "marid-pr-title.yml",
  "marid-release.yml",
  "marid-sync-upstream.yml",
  "marid-telegram-userbot.yml", // non-gating Telegram burner E2E (ADR-0013 tier 2) — was missing, would be stripped on sync
  "marid-whatsapp-burner.yml", // non-gating WhatsApp burner probe (ADR-0014 tier 3, EXP-012)
])

const removed = readdirSync(WORKFLOWS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")))
  .map((entry) => entry.name)
  .filter((name) => !KEEP.has(name))

for (const name of removed) rmSync(path.join(WORKFLOWS_DIR, name))

console.log(
  removed.length
    ? `Stripped ${removed.length} upstream workflow(s): ${removed.join(", ")}`
    : "No upstream workflows to strip (only Marid-owned workflows present).",
)
