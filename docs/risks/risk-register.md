---
artifact: risk-register
status: Draft
version: v0.1
updated: 2026-07-03
---

# Risk Register (RISK-)

Scoring: Impact × Likelihood, 1–3 each (9 = act now). Owner is the operator (STK-001) unless delegated
to the execution agent (STK-002). MVP column: does the mitigation belong in the MVP?

| ID | Risk | I | L | Score | Mitigation | Trigger to act | MVP |
|---|---|---|---|---|---|---|---|
| RISK-001 | Upstream v1→v2 API/SDK migration breaks the Marid layer or strands it on a deprecated surface | 3 | 3 | 9 | Build on v1 behind marid-auth facade (C-4); standing sync-checklist item watching v2/sdk-next stability; migration decision pre-drafted | sdk-next README drops "experimental" / v1 routes deprecated | Yes |
| RISK-002 | Cross-instance state corruption (auth.json RMW lost-writes, LSP cache torn installs, shared log) | 3 | 2 | 6 | Directory namespacing per instance (no shared mutable files by construction); EXP-002 verifies | EXP-002 failure or any stray-write report | Yes |
| RISK-003 | Prompt injection via Telegram / repo content / tool output leads to unintended tool use | 3 | 2 | 6 | INV-001 policy: channel agent = restricted ruleset, default-deny sensitive tools, approval prompts; injection framing per R-10 (enforce at tool-authorization boundary) | Any policy bypass in testing | Yes |
| RISK-004 | Supply-chain compromise via runtime npm-install (providers/plugins) or upstream deps | 3 | 1 | 3 | Pin provider installs in distribution profile; dependency+secret scanning in CI (FR-064); plugin trust policy (gate 8) | Scanner alert | Yes (CI part) |
| RISK-005 | Solo-maintainer fork fatigue: syncs stop happening, fork drifts | 3 | 2 | 6 | Small enumerated patch surface (P-*); monthly cadence + CI conflict-detector doing the boring part; delta report keeps drift visible | Two skipped sync cycles | Yes (process) |
| RISK-006 | SSE firehose is live-only → gateway misses events on disconnect | 2 | 2 | 4 | Per-session v2 `?after=<seq>` replay on reconnect (exists, R-02); gateway tracks last seq per session | EXP/integration test shows loss | Yes |
| RISK-007 | Secrets leak into session history/logs and get relayed to channels | 3 | 1 | 3 | Redaction rules (FR-055/059); audit separation; never echo config/auth values in tool output shown to channels | Redaction test failure | Yes |
| RISK-008 | Windows parity gaps (no /proc status, .cmd launchers, path handling) | 2 | 2 | 4 | claudectl already solved launcher parity (R-11); 3-OS CI smoke mandatory (NFR-004) | CI matrix failure | Yes |
| RISK-009 | Private-release update friction (gh token needed for self-update) | 1 | 3 | 3 | Documented gh-authenticated install/update path; acceptable for single operator | Operator pain report | Yes (docs) |
| RISK-010 | The v2 queue/steering path is less finished than it looks (partially wired, R-03) | 3 | 2 | 6 | EXP-001 before relying on it; C-5 fallback (busy-lock) pre-selected | EXP-001 FAIL | Yes |
| RISK-011 | Upstream changes direction/license or goes private | 2 | 1 | 2 | MIT baseline snapshot preserved in fork history; adapter-layer fallback (C-1 E) documented | Upstream announcement | No (watch) |
| RISK-012 | Scope creep back toward multi-user/public deployment before MVP ships | 2 | 2 | 4 | Charter non-goals + scope-change rule (DEC required); auth designed with headroom (tokens w/ scopes) but not built out | Any FR added outside registers | Yes (process) |
