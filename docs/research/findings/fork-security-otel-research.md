---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# Research: Fork Maintenance, AI-Agent Security, OTel GenAI

Track R-10 external research. Every claim cites a URL or is marked `unverified`.

## A. Downstream Fork Maintenance

### A1. Strategy options and when each wins

Four documented strategies for tracking an active upstream:

| Strategy | Mechanics | Wins when | Loses when |
|---|---|---|---|
| Periodic merge | `git merge upstream/main` on a schedule | Fork is published and others consume it (no force-push); large divergence; team wants monotonic history | Downstream delta becomes invisible — patches interleave with upstream history ([amboar](https://amboar.github.io/notes/2021/09/16/history-preserving-fork-maintenance-with-git.html)) |
| Rebase (patch stack on tip) | Rebase downstream commits onto each upstream release; force-push | Delta is small/curated; you want `git log upstream/main..HEAD` to *be* the delta report | Fork has external consumers (force-push breaks them); delta grows unbounded |
| Patch files (quilt-style) | Store `.patch` files + apply scripts; upstream source never forked in git | Delta is small, mostly deletions/branding; build-from-source model. This is VSCodium's model: build scripts clone MS `vscode`, apply ordered patches (core → quality → platform), with `dev/patch.sh` / `dev/update_patches.sh` to regenerate patches per upstream release ([VSCodium repo](https://github.com/VSCodium/vscodium), [DeepWiki patch docs](https://deepwiki.com/VSCodium/vscodium/7.2-creating-and-testing-patches)) | Delta involves substantial new subsystems; patches rot fast on refactored files |
| History-preserving rebase (hybrid) | Rebase the stack, then merge old tip back so history stays reachable — no force-push | You want rebase's clean delta *and* merge's consumer-safety ([amboar](https://amboar.github.io/notes/2021/09/16/history-preserving-fork-maintenance-with-git.html)) | Extra ceremony; history is noisier |

Real-world data points:
- Meta (WebRTC, 50+ use cases) tracks a patch stack continuously rebased onto upstream releases, kept in a separate repo; they now train AI agents to auto-resolve rebase conflicts, leaving only architectural conflicts to humans ([Meta Engineering, 2026](https://engineering.fb.com/2026/04/09/developer-tools/escaping-the-fork-how-meta-modernized-webrtc-across-50-use-cases/)).
- Joaquim Rocha (GNOME/Kinvolk fork experience) recommends rebase over merge, avoiding "evil merges," atomic commits, squashing downstream fix-ups into their originating commit, and putting upstreamable commits at the bottom of the stack ([how-to-fork](https://joaquimrocha.com/how-to-fork)).
- Cursor's exact internal strategy for its VS Code fork is not publicly documented — `unverified`.

For a private fork with few external consumers and a moderate delta (this repo's case), rebase-style patch stack or history-preserving rebase are the standard fits; periodic merge is the fallback once the delta gets large enough that rebases routinely conflict.

### A2. Tactics that shrink merge pain

- **New files/packages over in-place edits.** Downstream code in new files/packages cannot conflict textually; only integration points (registration, config wiring) do. Corollary of "each commit should touch as little upstream surface as possible" ([how-to-fork](https://joaquimrocha.com/how-to-fork)); VSCodium's patch ordering isolates concern-per-patch for the same reason ([DeepWiki](https://deepwiki.com/VSCodium/vscodium/7.2-creating-and-testing-patches)).
- **Config/flag-based divergence.** Prefer behavior switched by config/build flags over forked code paths; VSCodium keeps insider-vs-stable divergence in quality-specific patch layers rather than branches ([DeepWiki](https://deepwiki.com/VSCodium/vscodium/3.2-insider-vs-stable-builds)).
- **Upstream everything upstreamable.** Contributing a change upstream removes it from the delta permanently — the single biggest lever ([how-to-fork](https://joaquimrocha.com/how-to-fork)).
- **Automated sync CI.** Keep a staging branch that rebases/merges upstream automatically in CI so conflicts surface days, not months, after the upstream change ([die-antwort](https://die-antwort.eu/techblog/2016-08-git-tricks-for-maintaining-a-long-lived-fork/), [how-to-fork](https://joaquimrocha.com/how-to-fork)).
- **Delta reporting.** `git range-diff` compares the old patch stack to the rebased one per sync ([git-scm docs](https://git-scm.com/docs/git-range-diff)); `git diff upstream/main...HEAD --stat` gives the standing footprint. Meta reviews the rebased stack per release the same way ([Meta](https://engineering.fb.com/2026/04/09/developer-tools/escaping-the-fork-how-meta-modernized-webrtc-across-50-use-cases/)).
- **CODEOWNERS on high-conflict files** so each recurring conflict has a named owner — `unverified` as a documented fork-specific policy; standard GitHub mechanism applied to sync PRs.

### A3. Cadence

- "Rebase early, rebase often" — conflict probability compounds with interval length; automate a frequent (even daily) staging rebase in CI ([how-to-fork](https://joaquimrocha.com/how-to-fork), [die-antwort](https://die-antwort.eu/techblog/2016-08-git-tricks-for-maintaining-a-long-lived-fork/)).
- Release-tracking model: VSCodium cuts a build per upstream VS Code stable release, pinning target tag/commit in `upstream/stable.json` ([VSCodium](https://github.com/VSCodium/vscodium)); Meta rebases per upstream release ([Meta](https://engineering.fb.com/2026/04/09/developer-tools/escaping-the-fork-how-meta-modernized-webrtc-across-50-use-cases/)).
- Practical synthesis for a fast-moving upstream like opencode (multiple releases/week): time-boxed sync (weekly) with an always-on CI conflict-detector branch, plus a **security fast-path** — cherry-pick or immediately sync any upstream security fix out of band rather than waiting for the next scheduled sync. Fast-path as a named policy is distro practice (e.g., stable branches take security patches immediately, features on cadence) — `unverified` for a single canonical citation.

## B. AI-Agent Security (OWASP LLM Top 10, 2025)

### B1. Top 10 items most relevant to a tool-using agent platform with messaging ingress

Canonical list: [OWASP GenAI LLM Top 10 (2025)](https://genai.owasp.org/llm-top-10/). Most relevant to this platform, with canonical mitigation:

| ID | Risk | Relevance | Canonical mitigation |
|---|---|---|---|
| LLM01 Prompt Injection | Every ingress: chat messages, repo files, tool/MCP outputs | Highest | No complete fix exists; defense-in-depth: privilege separation, input/output filtering, human approval for high-risk actions, adversarial testing ([OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/), [Oligo summary](https://www.oligo.security/academy/owasp-top-10-llm-updated-2025-examples-and-mitigation-strategies)) |
| LLM05 Improper Output Handling | Model output feeds shell/edit/HTTP tools and UI | High | Treat model output as untrusted user input: validate/sanitize before execution or rendering; parameterize; encode for context ([OWASP](https://genai.owasp.org/llm-top-10/)) |
| LLM06 Excessive Agency | Agents hold tool + filesystem + network powers | High | Least privilege per tool, minimal tool set per task, human-in-the-loop for consequential actions; OWASP splits root causes into excessive functionality/permissions/autonomy ([Aembit](https://aembit.io/blog/owasp-top-10-llm-risks-explained/), [OWASP](https://genai.owasp.org/llm-top-10/)) |
| LLM02 Sensitive Information Disclosure | Secrets in repos/env reachable by tools | High | Data minimization in context, secret scanning/redaction, output filtering ([OWASP](https://genai.owasp.org/llm-top-10/)) |
| LLM07 System Prompt Leakage | Agent/system prompts encode policy | Medium | Never put secrets or sole enforcement in system prompts; enforce controls outside the model ([OWASP](https://genai.owasp.org/llm-top-10/)) |
| LLM03 Supply Chain | Plugins, MCP servers, model providers | Medium | Vet/pin dependencies and MCP servers, SBOM, provenance ([OWASP](https://genai.owasp.org/llm-top-10/)) |
| LLM10 Unbounded Consumption | Token/cost abuse via messaging ingress | Medium | Rate limits, quotas, budget caps per session/user ([OWASP](https://genai.owasp.org/llm-top-10/)) |

LLM04 (poisoning), LLM08 (vector/embedding), LLM09 (misinformation) are lower-priority for this platform unless RAG is added ([OWASP](https://genai.owasp.org/llm-top-10/)).

### B2. Indirect prompt injection and tool permission scoping

- **Microsoft's layered defense** (Zero Trust guidance + MSRC): preventative techniques ("spotlighting"/delimiting untrusted content so the model can distinguish instructions from data), detection classifiers (Prompt Shields), impact mitigation via least privilege and explicit user consent for sensitive actions, deterministic blocks on data-exfil channels ([Microsoft Learn: Defend against indirect prompt injection](https://learn.microsoft.com/en-us/security/zero-trust/sfi/defend-indirect-prompt-injection), [MSRC blog 2025](https://www.microsoft.com/en-us/msrc/blog/2025/07/how-microsoft-defends-against-indirect-prompt-injection-attacks), [MCP-specific guidance](https://developer.microsoft.com/blog/protecting-against-indirect-injection-attacks-mcp)).
- **Treat all tool outputs and repo content as untrusted ingress**, same trust tier as an incoming chat message: any file read, web fetch, or MCP tool result can carry instructions ([Microsoft Learn](https://learn.microsoft.com/en-us/security/zero-trust/sfi/defend-indirect-prompt-injection)).
- **Least-privilege agent design**: expose only the tools the current task needs; short-lived, narrowly-scoped credentials; a read-only agent cannot be escalated regardless of injection success ([Microsoft Learn](https://learn.microsoft.com/en-us/security/zero-trust/sfi/defend-indirect-prompt-injection); research corroboration [LogJack](https://arxiv.org/pdf/2604.15368)).
- **Output-side policy gate independent of injection detection**: map proposed tool actions to risk tiers — read = auto-approve, write = require approval, shell/credential ops = block or hard-confirm. Works even when the injection itself goes undetected ([LogJack](https://arxiv.org/pdf/2604.15368); mirrors opencode's existing permission system).
- Anthropic and OpenAI publish comparable agent-security guidance (human confirmation for consequential actions, sandboxing, injection red-teaming) — direction verified via secondary reporting ([Windows Forum roundup](https://windowsforum.com/threads/prompt-injection-flaws-anthropic-google-microsoft-risk-secrets-in-ai-agents.413524/)); exact primary-doc wording `unverified` in this pass.

Threat-model takeaway: messaging-channel ingress means attacker-controlled text reaches the model *by design*; the enforceable boundary is tool authorization and output handling, not prompt hygiene.

## C. OpenTelemetry GenAI Semantic Conventions

### C1. Status and shape

- **Status: Development (experimental), not stable.** All GenAI span/metric conventions are marked Development and subject to breaking change; no public stabilization timeline ([gen-ai-spans.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md)).
- **Repo moved (2026):** all `gen_ai.*` conventions were deprecated in the main semconv repo and moved to a dedicated repo, `open-telemetry/semantic-conventions-genai` ([redirect notice](https://opentelemetry.io/docs/specs/semconv/gen-ai/), [new repo](https://github.com/open-telemetry/semantic-conventions-genai)). Pin instrumentation via `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` ([OTel semconv releases](https://github.com/open-telemetry/semantic-conventions/releases)).
- **Span types defined:** inference, embeddings, retrieval, memory, and execute-tool spans ([gen-ai-spans.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md)).
- **LLM inference span:** name `{gen_ai.operation.name} {gen_ai.request.model}` (e.g. `chat gpt-4`). Required: `gen_ai.operation.name` (well-known values incl. `chat`, `embeddings`, `execute_tool`, `invoke_agent`), `gen_ai.provider.name` (well-known values incl. `openai`, `anthropic`, `aws.bedrock`, `gcp.vertex_ai`). Recommended: `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` ([gen-ai-spans.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md)).
- **Tool execution span:** `execute_tool {gen_ai.tool.name}` with `gen_ai.tool.name`, tool-call id/type attributes; tool definitions/arguments/results have JSON schemas in the repo ([gen-ai-spans.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md), [repo model/](https://github.com/open-telemetry/semantic-conventions-genai)). MCP-specific span/metric models also exist in the repo (`model/mcp/`).
- **Content capture:** spec defaults to *not* recording prompts/outputs (sensitive + costly); options are span attributes or external-storage upload ([gen-ai-spans.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md)).
- Metrics exist alongside spans (token usage, operation duration) in `docs/gen-ai/gen-ai-metrics.md` of the same repo — same Development status.

### C2. Correlating request -> session -> LLM call -> tool call

- **Primary mechanism is span nesting, not correlation IDs:** top-level `invoke_agent` span, child `chat` spans per LLM call, child `execute_tool` spans per tool invocation ([OTel blog: GenAI Observability, 2026](https://opentelemetry.io/blog/2026/genai-observability/)).
- **Agent spans:** `create_agent`, `invoke_agent` (CLIENT for remote, INTERNAL for in-process frameworks), and `invoke_workflow` for multi-agent coordination; attributes `gen_ai.agent.id`, `gen_ai.agent.name` ([gen-ai-agent-spans.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md)).
- **Cross-trace session correlation:** `gen_ai.conversation.id` is the defined attribute for linking spans across turns of one conversation/session — this is the hook for "session" in a long-lived agent where each request is its own trace ([gen-ai-agent-spans.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md)).
- Established pattern: one trace per user request (root = `invoke_agent`), nesting for intra-request causality, `gen_ai.conversation.id` for cross-request session stitching. Instrumentation adopting this now should expect attribute renames until stabilization ([OTel blog](https://opentelemetry.io/blog/2026/genai-observability/)).
