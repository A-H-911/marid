---
status: Proposed (approved with gate 13 handoff)
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# Acceptance Criteria (AC-)

Given/When/Then form; each AC is verified by the TEST- family named and rolls up to a KPI/milestone.

| ID | Criterion | Verifies | Tested by |
|---|---|---|---|
| AC-001 | Given a fresh machine with the Marid binary installed, when the operator runs `marid instance add work && marid instance start work`, then a server starts on an allocated port with its own directory tree and answers health checks | FR-053, KPI-003 | TEST-INST |
| AC-002 | Given two running instances, when both execute sessions concurrently, then no file outside each instance's tree is written and neither instance's behavior changes | NFR-008, RISK-002 | TEST-INST |
| AC-003 | Given no bearer token, when any API call is made, then the response is 401 and an audit line is written | FR-031/033 | TEST-AUTH |
| AC-004 | Given a `client`-scope token, when it accesses another client's session or an admin route, then 403 with audit | FR-031, scopes | TEST-AUTH |
| AC-005 | Given a token exceeding its rate limit, when it continues calling, then 429 with `retry-after`, and SSE connections above the cap are refused | FR-032 | TEST-AUTH |
| AC-006 | Given a session created via the SDK, when the operator opens the TUI on the same instance, then the session appears and can be continued, and the SDK subscriber receives the TUI-driven updates live | FR-038/042, KPI-001 | TEST-SYNC |
| AC-007 | Given an SSE client that disconnects mid-run, when it reconnects with `?after=<lastSeq>`, then it receives every missed event for that session exactly once (dedup by aggregate+seq) | FR-036, RISK-006 | TEST-SYNC |
| AC-008 | Given the server process is killed mid-prompt and restarted, when clients reconnect, then session history is intact and the session is usable per the documented recovery behavior | FR-043 | TEST-SYNC |
| AC-009 | Given two simultaneous prompts to one session, when both are submitted, then behavior matches the documented queue/steer semantics (EXP-001 outcome) with no corruption | FR-040/041 | TEST-SYNC |
| AC-010 | Given a non-allowlisted Telegram user, when they message the bot, then no session is created, nothing is answered, and the attempt is logged | FR-050, INV-001 | TEST-TG |
| AC-011 | Given the allowlisted operator asks the bot a question, when the agent streams its answer, then the Telegram message updates progressively (≥2 s cadence), respects the 4096-char split, and finishes with the complete text | FR-046/048, KPI-002 | TEST-TG |
| AC-012 | Given the channel agent's policy denies a tool, when the model requests it, then a permission prompt appears as an inline keyboard; Deny (or timeout) blocks the tool; Approve allows exactly once | FR-028/052, INV-001 | TEST-TG |
| AC-013 | Given the `marid` profile build, when the binary is inspected/run, then excluded surfaces (desktop, console, cloud, slack, docs-site) are absent and a grep-based hygiene test passes | ADR-0002, FR-060 | TEST-BUILD |
| AC-014 | Given a tagged release, when CI completes, then binaries+checksums exist as a private GitHub Release and install/update works via the documented gh-authenticated path on all 3 OSes | FR-060/064, KPI-006 | TEST-BUILD |
| AC-015 | Given an upstream sync PR, when CI runs, then contract tests, migration review, dependency diff, and the delta report are all present; and one real sync cycle has been merged | FR-061, KPI-004 | TEST-SYNCUP |
| AC-016 | Given any log, error output, session export, or channel message, when a configured secret value would appear, then it is redacted. **Scope (ADR-0007):** MVP delivers only (a) the audit/config never storing the secret and (b) the Telegram bot-token masked in gateway logs; the general configured-secret-value redactor across all four surfaces is the **PH-5** target. Secret-in-egress is contained in the MVP by the B2/B4 authorization boundary. | FR-055/059, RISK-007 | TEST-SEC |
