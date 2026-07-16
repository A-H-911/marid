// MARID agent-identity transform (WBS-8.2 Phase 3, DEC-026, AC-028). The system
// prompts ship OpenCode's identity ("You are OpenCode…"), its feedback repo
// (github.com/anomalyco/opencode), and a self-doc-fetch instruction pointing at
// opencode.ai/docs. Rather than fork every prompt/*.txt (large patch surface that
// drifts on sync, and misses sync-ADDED prompts), we rewrite the emitted text at
// the single system-prompt choke point (session/system.ts `provider()`).
//
// Gated on the same __MARID_APP that isolates the dirs (P-6): the upstream
// `opencode` app leaves the text byte-unchanged (no regression); only the marid
// distribution rebrands. Downstream consumer: session/llm/request.ts (custom-prompt
// agents bypass this, which is acceptable per ADR-0018 D6).
const MARID_REPO = "https://github.com/A-H-911/marid"

export function maridizePrompt(text: string, app: string = process.env["__MARID_APP"] ?? "opencode"): string {
  if (app === "opencode") return text
  return (
    text
      // Support/feedback + repo URLs → the Marid repo (do the full URL first, before
      // the generic brand replacement, so the path segment is rewritten cleanly).
      .replaceAll("https://github.com/anomalyco/opencode/issues", `${MARID_REPO}/issues`)
      .replaceAll("https://github.com/anomalyco/opencode", MARID_REPO)
      // Self-doc-fetch → point at the Marid repo instead of opencode.ai/docs.
      .replace(/https:\/\/opencode\.ai\/docs/gi, MARID_REPO)
      .replace(/https:\/\/opencode\.ai/gi, MARID_REPO)
      // Brand identity. The negative lookbehind on "." preserves the kept `.opencode`
      // project dir name (DEC-024) if a sync-added prompt ever references it.
      .replace(/(?<!\.)\bOpenCode\b/g, "Marid")
      .replace(/(?<!\.)\bOPENCODE\b/g, "MARID")
      .replace(/(?<!\.)\bopencode\b/g, "marid")
  )
}
