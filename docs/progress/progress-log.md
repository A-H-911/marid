---
status: Approved
version: 1.0.0
updated: 2026-07-09
owner: operator (STK-001)
---

# Progress Log

Append-only, newest first. Each entry: **Done / Decisions / Deviations / Blockers / Next.** Machine mirror
lives in `keystone-state.json` `progress[]`. Volatile "where are we now" is the
[status report](status-report.md).

## 2026-07-10 — PH-6 scope expansion: Marid Gateway + full cross-client mirroring + real-app test strategy (Proposed, gated)
- **Done:** Operator-directed **scope expansion** of PH-6 (Telegram-first, all-in-one; decision-support only, NO code).
  Authored **ADR-0011** (Marid Gateway — marid-auth becomes a component), **ADR-0012** (full bidirectional mirroring,
  explicit-attach), **ADR-0013** (four-tier Telegram test strategy); **DEC-017/018/019**; **C-10/11/12**;
  **HYP-007..010 + EXP-007..010**; **FR-066**; **RISK-015..020**; **DEP-014..017**; **AC-019/020/021** + expanded
  **AC-017**; revised **PH-6 WBS-6.1..6.6** + MS-007 + roadmap + **test-strategy** (TEST-TG-E2E/UI/MOBILE, TEST-SYNC
  spans channels) + handoff PH-6 start. keystone-state reconciled; `validate_package.py docs/` = **RESULT: OK**.
- **Key source verifications:** mirroring is **additive at `event-filter.ts`** (the firehose already fans out;
  binding-aware `isVisible` + binding registry + channel-client — no new bus, zero upstream edit → **RISK-019
  downgraded**); **INV-001-safe by construction** (view-via-binding, act-via-ownership via `scope.ts:109`); gateway
  design derived from **OpenClaw** (MIT verified — reference-only, **no code port**; nodes-not-channels analog) +
  **Shaheen** (separate-process + one `Server.extend` hook); real-client testing = **GramJS userbot on the test DC**
  + Telegram-Web-Playwright (local-pre-PR + GitHub-on-demand) + native mobilewright (manual); fake-server stays the
  blocking PR gate.
- **Decisions:** all **Proposed** (ADR-0011/0012/0013, DEC-017/018/019) — operator-gated, none Approved (INV-005).
  Three devil's-advocate passes corrected: OpenClaw (suspicious metrics → reference-only), GramJS test-DC caveats
  (`PHONE_CODE_INVALID`/stale/`/test`-bot → EXP-007 de-risks first), and the always-GUI-gate tension (→ local-pre-PR
  + GitHub-on-demand, non-gating). **Deviations:** none. **Blockers:** operator gate — approve ADR-0011/0012/0013 +
  DEC-017/018/019 + the expanded PH-6 before implementation. **Next:** on approval, PH-6 WBS-6.1..6.6 (run
  EXP-007/008/009).

## 2026-07-09 — Post-MVP channels homework: PH-6 Telegram + PH-7 WhatsApp planned (Proposed, gated)
- **Done:** Ran a Keystone update-mode research/evaluation cycle for the two post-MVP channel items (deferred #9
  Telegram, FR-047 WhatsApp) — **decision-support only, no product code**. Deep R-11/R-12 research (cited findings
  `research/findings/{telegram,whatsapp}-options.md`), comparisons **C-8/C-9**, experiment plans **HYP-005/006 +
  EXP-005/006**, ADRs **ADR-0009** (Telegram) / **ADR-0010** (WhatsApp), decisions **DEC-014/015/016**, risks
  **RISK-013/014**, deps **DEP-012/013**, acceptance **AC-017/018**, phases **PH-6/MS-007 + PH-7/MS-008** with
  WBS-6.1..6.6 / 7.1..7.5, and handoff PH-6/PH-7 start + channel-review prompts. Traceability + acceptance-audit regenerated;
  `validate_package.py docs/` = **RESULT: OK**.
- **Findings that changed the plan:** (1) **Telegram → fix-in-place** (not the ADR-0008 fork): `marid-telegram`
  is zero-dep hand-rolled and already has the streaming machinery; the only gap is one MIT md library
  (`telegramify-markdown`) — ADR-0008's "re-implements grammy/remark" premise is false; ADR-0009 supersedes
  ADR-0008 on approval. (2) grinev is Basic-auth + admin-features the `channel:` scope denies (403) — reference
  only. (3) **WhatsApp → unofficial client, isolated behind pinned WAHA** (or hardened Baileys-direct); official
  Cloud API needs public ingress (excluded, OQ-004); ban risk (RISK-013) + lotusbail-class supply-chain
  (RISK-014) surfaced and mitigated.
- **Decisions:** all **Proposed** (DEC-014/015/016; ADR-0009/0010) — **operator-gated, none Approved** (INV-005).
  DEC-016 is a Proposed **FR-047 amendment** (official→unofficial-under-containment); FR-047 text stands until
  approved. **Deviations:** experiment *report* files deferred to PH-6/7 execution per keystone convention
  ("experiments run in execution phase"); reframed EXP-006 to a reproducible fake-WA
  probe (Planned; runs at PH-7 start) instead of a live real-number probe, after a devil's-advocate re-check (no
  unofficial-WhatsApp sandbox exists). **Both experiments are Planned — neither ran this cycle** (running them is
  PH-6/PH-7 product code, which this homework scoped out); the recommendations are research-reasoned and the ADRs
  stay Proposed-pending-EXP.
- **Blockers:** operator decision gate — approve DEC-014/015/016 + ADR-0009/0010 + PH-6/PH-7 before any
  implementation. **Next:** on approval, PH-6 (WBS-6.1..6.6, run EXP-005) then PH-7 (WBS-7.1..7.5, run EXP-006).

## 2026-07-09 — GATE 14 ACCEPTED — MS-006 met, Marid MVP plan complete
- **Done:** Operator (STK-001) accepted the [MVP readiness report](../validation/mvp-readiness-report.md) →
  **execution gate 14 = GO**. MS-006 formally MET: KPI-004 (sync #31) ∧ KPI-005 (clean G-TRACE) ∧ KPI-006
  (RC 17 checks green, public `v0.1.0`). **The Marid MVP plan (PH-0..PH-5) is complete.** Readiness report
  status → Approved; `checkpoints.md` Gate 14 → passed; `milestones.md` MS-006 → accepted.
- **Accepted residuals (post-MVP, Approved dispositions):** AC-016 egress secret-redactor (ADR-0007), AC-007
  formal supersede (re-fetch recovery delivered), Telegram gateway beta → fork (ADR-0008 / deferred #9),
  FR-064 §18 scans/SBOM (ADR-0007), stats mechanism (deferred #10).
- **Decisions:** gate-14 GO (operator, 2026-07-09). **Deviations:** none. **Blockers:** none.
  **Next:** post-MVP backlog (Telegram fork, egress redactor, AC-007 supersede, upstream sync cadence).

## 2026-07-09 — Root docs Marid-ized (P-5; folded into the WBS-5.5 PR #39)
- **Done:** Rewrote the public-repo front-door docs for Marid (patch-surface **P-5**): `CONTRIBUTING.md`
  (Marid docs-first / Keystone feature loop as the centerpiece — pick `AC-` → failing `TEST-` → implement
  (new pkg / `P-*`) → trackers → `validate=OK` → PR to `develop` → 17 checks → operator merge; links, not
  duplicates, CLAUDE.md + `docs/AGENTS.md`); `SECURITY.md` (Marid auth/isolation/audit model, reports→operator,
  keeps the honest "no tool-sandbox / redactor-deferred AC-016" caveats); `CONTEXT.md` (product-name rebrand
  only, inherited SDK term-names kept); `STATS.md` (single-operator stub → deferred #10 for a real GitHub
  Releases download-count mechanism); `AGENTS.md` (light Marid-precedence header + `dev`→`develop` + branch-naming
  fix). Added the **public-repo/'private'=single-operator-usage** clarifier to README + CLAUDE.md. Registered
  P-5 in `architecture.md` + a reconcile rule in `upstream-sync-strategy.md` (Marid wins; AGENTS = take upstream
  body + re-apply header). No governed-ID tokens added; `validate_package.py docs/` = OK.
- **Decisions:** "Private" clarified = single-operator *usage*, repo + releases **public** (DEC-010). Diagrams
  (Tarseem overlay of both OpenCode + Marid) scoped to a **separate follow-up PR** (38 binary files). **Deviations:**
  none. **Blockers:** none. **Next:** #39 CI green → operator gate-14; then the Tarseem diagram PR.

## 2026-07-09 — MS-006 MET (PH-5 complete; public v0.1.0 released; WBS-5.2 + 5.5)
- **Done:** **Public `v0.1.0` release cut** — `release/v0.1.0` fast-forwarded to develop, #35 merged to `main`
  (merge-commit `8bf4ab61e`), tag `v0.1.0` fired `marid-release.yml`: 7 targets × (archive + `.sha256` +
  `.minisig`) = **21 signed/checksummed public assets**. RC 17 checks green (**KPI-006**). 3-OS install-smoke
  proves the anonymous download→`minisign -Vm`→`sha256sum -c`→run path (Linux+Windows green; macOS asset-name
  typo `.tar.gz`→`.zip` fixed forward, PR #38). **WBS-5.2 done → AC-014 Met.** **WBS-5.5 readiness:** G-IDS
  cleared (audit rows now *reference* the criteria definitions, `[AC-NNN](acceptance-criteria.md)`), FR-064
  re-marked `partial` (§18 dep/secret/license scans + SBOM unbuilt — deferred, ADR-0007), AC-014 criterion text
  corrected to public/anonymous (DEC-010); `validate_package.py docs/` = **RESULT: OK**; readiness report
  authored. Finalize #36 also landed a **Windows CI fix** (a `site.webmanifest` symlink had been overwritten
  with JSON, breaking Windows checkout) and the `/session/status` 403 scope fix.
- **Decisions:** Publish `v0.1.0` now (operator, 2026-07-09). Telegram ships **beta** — replace the hand-rolled
  gateway post-MVP with a fork (ADR-0008 / deferred #9). **Deviations:** macOS install-smoke fixed forward
  (release integrity unaffected — asset present + signed). A stale local `v0.1.0` tag pointed at an ancient
  commit and triggered the wrong (upstream) workflow → caught before any publish, retagged at `8bf4ab61e`.
- **Blockers:** none. **Next:** operator **gate-14 MVP go/no-go** acceptance of the readiness report → MS-006
  formally closed. Post-MVP: Telegram fork, egress secret-redactor (AC-016), AC-007 formal supersede.

## 2026-07-08 — WBS-5.2 prep (install/update path + 3-OS asset smoke; RC still pending)
- **Done:** Removed the self-update footgun — dropped `UpgradeCommand` from the Marid entry
  (`packages/opencode/src/marid.ts`); `marid upgrade` would have fetched the upstream `opencode` binary from
  npm (`installation/index.ts` → registry.npmjs.org/opencode-ai), never Marid. Documented the **update path**
  in the README (re-download the signed release + re-verify; no self-update by design). Added a **3-OS
  install-smoke** job to `marid-release.yml` (`needs: release`, matrix ubuntu/macos/windows): downloads the
  published asset + `.minisig` + `.sha256`, verifies the signature against the committed `minisign.pub`, checks
  the sha256, extracts, runs `marid --version`. Its value is the **signed-release-asset** path (the binary boot
  is already covered by `ci.yml`'s `marid-build` self-smoke).
- **Deviations:** WBS-5.2 is **not closed** and **AC-014 stays Partial** — the install-smoke only proves out
  when a real release publishes, which happens at the **RC** (`release/v0.1.0` → main → tag `v0.1.0`), the
  operator-gated outward-facing step still to come. The install-smoke workflow YAML is untested until then.
- **Blockers:** none (RC is an operator decision, INV-005). **Next:** cut the RC → `marid-release.yml` fires →
  install-smoke green (17 checks = KPI-006) → flip AC-014 Met → WBS-5.5 readiness → gate 14.

## 2026-07-08 — WBS-5.4 branding done (README + logo + P-2 + P-3)
- **Done:** Marid branding realized (FR-065 → full). **README** rewritten (Marid identity, interfaces table,
  minisign verify quick-start, security model, attribution/non-affiliation verbatim, sync/license). **Logo**
  operator-designed via a Claude Design project: flame + "Marid" in OpenCode's block-logo style, **Pixelify Sans
  700, blue face `#2F6BFF` + orange offset `#F0731F`, yellow→orange→red flame** — committed as `docs/branding/
  mark.svg` (portable flame) + `logo-{light,dark}.png` (lockup; PNG because GitHub won't render a web-font SVG
  wordmark). **P-2** realized: TUI window title (`app.tsx`) + TUI/CLI startup logo redrawn (`tui/src/logo.ts` +
  `cli/ui.ts`, flame + "Marid", ember-orange flame; terminal "M" opened up so it no longer reads as "H").
  **P-3** realized: distribution default `lsp:false` via `OPENCODE_CONFIG_CONTENT` at instance spawn
  (`marid-instance/src/paths.ts` `instanceConfigEnv` + `lifecycle.ts`), operator-overridable; +2 tests.
- **Scope decisions (devil's-advocate, documented in `branding.md` + P-2 register):** **User-Agent dropped
  from P-2** — real UAs are hardcoded `opencode/${version}` at ~15 provider/plugin sites (rebranding all →
  NFR-001 violation + breaks upstream provider tests; provider-facing, not operator-facing). `package.json` bin
  not touched (marid binary named by `marid-build.ts`). `index.ts` scriptName / opencode help snapshot left
  upstream (the marid CLI is already `.scriptName("marid")`).
- **Verify:** hygiene test 10/10 pass (no excluded-pkg imports); marid-instance paths 18/18 (P-3); opencode +
  tui typecheck clean.
- **Decisions:** logo direction/font/palette are operator-approved (Claude Design confirmation loop). **Blockers:**
  none. **Next:** WBS-5.2 (RC `v0.1.0` + install path + 3-OS asset smoke) → WBS-5.5 (readiness, FR-064 re-mark)
  → STOP at gate 14.

## 2026-07-08 — PH-5 partial: WBS-5.1 (release) + WBS-5.3 (sync) done & merged; trackers reconciled
- **Done:** PH-5 release pipeline + sync automation landed on develop (PRs **#27–#31**, HEAD `51fb00c6b`).
  **WBS-5.1** — `marid-release.yml` + `marid-build.ts --release` (tar/zip + `.sha256` + minisign `.minisig`);
  minisign trust anchor wired (`minisign.pub` committed, secret `MINISIGN_SECRET_KEY`); verified end-to-end
  (workflow run 28892667716 green; throwaway prerelease signed+checksummed, `-Vm`/`-c` validated, then deleted).
  **WBS-5.3 (KPI-004)** — `marid-sync-upstream.yml` + **one real 91-commit upstream cycle merged via
  merge-commit (#31)**; `upstream/dev` now an ancestor of develop; delta + migration-review + dependency-diff
  jobs present. Codemode (new upstream pkg) reconciled per ADR-0002 (`external` in `marid-build.ts` +
  single-file hygiene allowlist for `tool/code-mode.ts`). Supporting: #29 (telegram P-CI-4 timing scale),
  #30 (telegram live-E2E retry-wrapper; **RISK-006** corrected + **deferred-work #8** = gateway firehose has
  no reconnect — diagnosed, not fixed in-phase by design).
- **Reconciliation (this entry):** `work-breakdown.md` WBS-5.1/5.3 → ✅ done; `acceptance-audit.md`
  **AC-015 → Met**, **AC-014 → Partial** (release verified; install path + 3-OS smoke = WBS-5.2), AC-016 stays
  Partial (summary recount fixed — it had wrongly listed AC-016 under Met); `keystone-state.json` + `status-report`
  regenerated; `keep-remove-matrix.md` gains a codemode-excluded note.
- **Decisions:** releases **public/anonymous** (DEC-010); **minisign** signing; **ship-under-containment**
  (AC-016 redactor + FR-064 supply-chain scans deferred post-MVP, ADR-0007). Logo → **red-orange flame + shadowed
  "marid" wordmark** (operator directive 2026-07-08; amends branding.md's 2-color spec). First RC → **`v0.1.0`**
  on an independent `0.x` line (package.json stays upstream `1.17.15`; release↔upstream link is the baseline SHA;
  `--version` reports the tag).
- **Deviations:** AC-014 marked **Partial not Met** (install half is WBS-5.2) — corrects the resume-file's
  "AC-014→Met"; the PH-5 **roadmap/milestone rows are NOT flipped** here (they flip at MS-006/gate 14, not per-WBS).
  Devil's-advocate review (2026-07-08) also found: FR-064 is a **hollow trace** (marked `full`, scans unbuilt →
  re-mark at WBS-5.5) and AC-014's text was stale vs DEC-010 ("private/gh-auth" → corrected to public/anonymous).
- **Blockers:** none. **Next:** WBS-5.4 (README + red-orange-flame logo + P-2 branding + P-3 `lsp:false`) → WBS-5.2
  (RC `v0.1.0` + install path + 3-OS asset smoke) → WBS-5.5 (readiness, FR-064 re-mark) → **STOP at gate 14**.

## 2026-07-07 — PH-4 security threat-model audit (B1–B8) + corrective doc reconciliation
- **Done:** Full audit against `security-threat-model.md` — every B1–B8 mitigation verified against code and
  tests; ran all three Marid suites (**marid-telegram 58 / marid-auth 72 / marid-instance 40 = 170 pass, 0
  fail**); TEST-SEC injection-containment probes (`channel-binding.test.ts`: escape-agent / widen-tools /
  widen-permission / `/shell` / `/command` / no-agent / unbound-agent) all fail closed (403, `delegated=false`);
  AC-012 permission round trip confirmed. **Finding:** the B7 "redaction filters on channel egress" control is
  claimed but not implemented — only the Telegram bot-token literal is masked (gateway logs); channel egress,
  general logs/errors, and `marid export` (raw by default) have no configured-secret-value redactor; AC-016's
  cited evidence (`audit.test.ts`) tests 0600 + field shape, not redaction. Secret-in-egress is contained by the
  B2/B4 authorization boundary (restricted agent can't read `auth.json`). B5 supply-chain controls (plugin
  allowlist, provider pinning, FR-064 scanning) are unbuilt PH-5 work.
- **Corrective changes (operator-approved scope "docs + cheap guards"):** threat model → v1.1 (B7 + residual
  corrected to fact, status stays Approved — defect fix); **AC-016 verdict Met → Partial** + evidence fixed
  (13 → **12 / 16 Met**, +1 Partial); RISK-007 / RISK-004 mitigation text corrected (flagged for operator
  re-score); **ADR-0007 (Proposed)** records containment-first MVP posture + redactor deferred to PH-5;
  **code guard:** explicit `--hostname 127.0.0.1` loopback bind in `marid-instance` `serveLaunch()` (B3 drift
  guard; `MARID_BIND_HOST` override + warning preserves the documented non-loopback path); **P-4 reserved**
  (deferred `export` default-flip).
- **Decisions:** containment-not-redaction is **Proposed** (ADR-0007), not settled — awaits operator approval.
  **Open sub-decision:** `marid export` raw-default fix — (a) global default-flip [P-4, upstream edit], (b)
  provenance-aware, (c) *interim* doc guardrail + defer to PH-5 (chosen pending confirmation). **Deviations:**
  none (audit-only + doc/guard; no upstream code edited; no merge). **Blockers:** operator to (1) approve
  ADR-0007, (2) pick the export option. **Next:** PH-5 (redactor + B5 controls), or operator direction.

## 2026-07-07 — MS-005 MET (PH-4 Telegram complete)
- **Done:** 3-OS `marid-telegram` green on PR #23 (all 20 checks incl. TEST-TG on ubuntu/macOS/windows) —
  KPI-002. Telegram round trip (AC-010 stranger-ignored, AC-011 streamed reply) proven live; policy-denial
  path (AC-012) proven via the faked-SDK permission round trip + marid-auth INV-001 backstop. Merged
  develop@81ba7e7 (squash). AC-010/011/012 flip to Met → **13 / 16 MVP ACs Met**.
- **Decisions:** (recap of this session's, now shipped) INV-001 = by-construction backstop in `@marid/auth`
  (channel scope deny-by-default on owned-session sub-routes + token-bound-agent guard), not gateway
  convention; hand-rolled Bot API client (no telegram-library dep, RISK-004); full media send + receive.
- **Deviations:** AC-012's LLM-tool→permission link is an opencode harness limit — the HTTP-served run
  resolves zero tools (not a provider or gateway defect), so the permission ROUND TRIP is proven via a
  faked-SDK integration test (event→keyboard→Deny→`permission.respond(reject)`) rather than a live model call.
- **Blockers:** operator to add `marid-telegram` ×3 to required checks (14→17). **Next:** PH-5 (Release &
  sync, MS-006 = MVP).

## 2026-07-06 — PH-4 Telegram built (WBS-4.1..4.5)
- **Done:** new additive `@marid/telegram` pkg (ADR-0005, zero runtime deps, type-only SDK) — long-poll
  ingress + allowlist + `update_id` dedup (AC-010), HTML/4096-split streaming with EXP-003 cadence + 429
  (AC-011), permission inline-keyboard flow (race-safe exactly-once), policy, full media, `marid telegram
  start` CLI. Plus the `@marid/auth` **INV-001 by-construction backstop** (WBS-4.4): channel scope is now
  deny-by-default on owned-session sub-routes (closes a verified hole — `channel:` == `client` could reach
  `/session/:id/shell`), and a token-bound-agent body guard rejects any channel prompt that selects a
  different agent or widens tools. 169 unit tests (auth 72, instance 40, telegram 58) + live TEST-TG
  (AC-010/011) vs a real `marid serve` + fake LLM + local fake Telegram; new 3-OS `marid-telegram` CI job.
- **Decisions:** (operator, this session) INV-001 = by-construction backstop (not gateway convention);
  hand-rolled Bot API client (no telegram-library dep, RISK-004); full media send+receive. Client
  `messageID` dropped from prompts (server ids are timestamp-ordered — a fabricated one corrupts history;
  idempotency is the update_id dedup store).
- **Deviations:** AC-012's LLM-tool→permission link is NOT driven live — the opencode HTTP-served run
  resolves **zero tools** (verified: fake LLM called, calls=1/misses=0, request carries no `tools` field,
  for the build agent AND a `tools:{bash:true}` agent; internal `prompt.loop()` has tools, served
  `promptAsync` does not). Not a provider or gateway issue. The gateway's permission ROUND TRIP
  (event→keyboard→Deny→`permission.respond(reject)`) is instead proven end-to-end via a faked-SDK
  integration test emitting a schema-shaped `permission.asked`; `parseAskEvent` locks the field names
  (id/sessionID/permission — a review caught the gateway reading a non-existent `title`).
- **Blockers:** operator to add `marid-telegram` ×3 to required checks (14→17). **Next:** open the PH-4 PR;
  on 3-OS green + merge, flip MS-005 (separate trackers PR).

## 2026-07-06 — Keystone v1.0.0 package migration
- **Done:** re-homed the whole `docs/` package to the Keystone v1.0.0 layout (progress/, execution/,
  governance/, planning split, validation/traceability, architecture/diagrams); rebuilt `keystone-state.json`
  to the new schema; frontmatter → `status/version/updated/owner`; added agent-control surface
  (`AGENTS.md` + `CLAUDE.md` import); mechanical validator green.
- **Decisions:** the three PH-1 sub-decisions (formerly labeled 11a/b/c) promoted to real register rows
  DEC-011 / DEC-012 / DEC-013. No content lost.
- **Deviations:** none. **Blockers:** none.
- **Next:** PH-4 (Telegram, MS-005) remains the next execution phase.

## 2026-07-05 — MS-004 MET (PH-3 Cross-interface complete)
- **Done:** 3-OS `marid-sync` green on PR #19 (first macOS+linux exercise of the cross-interface path);
  KPI-001 demo repeatable. Merged develop@82a92d8943; synced to main@862c7bd6fc; ruleset → 14 required checks.
- **Decisions:** api-event-contract v1.0→v1.1 — added Concurrency section (EXP-001), corrected the `?after=`
  replay claim (firehose is live-only; recovery = authoritative re-fetch). ADR-0004 + EXP-001 carry pointers.
- **Deviations:** interactive SolidTUI not driven headlessly (no repo precedent) — TUI wire role exercised via
  `marid instance attach`. **Blockers:** none.
- **Next:** PH-4 unblocked (needs WBS-1.2 tokens, done).

## 2026-07-05 — PH-3 Cross-interface built (WBS-3.1..3.3)
- **Done:** `marid instance attach <name>` (bearer flows to HTTP + SSE, zero upstream edit); TEST-SYNC live E2E
  (§7 discovery/continue, concurrency, restart-recovery) vs a real authed `marid serve`; new 3-OS `marid-sync`
  CI job. **Decisions:** WBS-3.2 DoD met by authoritative-store re-fetch, not event replay.
- **Deviations:** none. **Blockers:** operator to add `marid-sync` ×3 to required checks (11→14).
- **Next:** open PR #19; on green flip MS-004.

## 2026-07-05 — MS-003 MET (PH-2 Instances complete)
- **Done:** 3-OS `marid-isolation` green on every PR #17 run incl. final all-green ×2; KPI-003. Merged
  develop@6e013b45e; sync main@06b36e4cb; ruleset → 11 checks. Devil's-advocate review closed P-CI-4 residuals
  with two runtime probes. **Decisions:** globalPassThroughEnv delivers OPENCODE_TIMING_SCALE (proven at runtime).
- **Deviations:** none. **Blockers:** none. **Next:** PH-3 and PH-4 unblocked.

## 2026-07-05 — PH-2 Instances built (WBS-2.1..2.3)
- **Done:** new `@marid/instance` pkg (`composeInstanceEnv` = EXP-002 env set; race-free port; PID/port record;
  idempotent start guard; platform-split tree-kill); `MaridInstanceCommand`; 39 unit + live 2-instance diff;
  new 3-OS `marid-isolation` job. ADR-0006 verified live (EXP-002 residual closed).
- **Decisions:** OPENCODE_DB omitted (XDG_DATA_HOME isolates the DB); home not relocated.
- **Deviations:** graceful shutdown POSIX-only (Windows has no catchable SIGTERM). **Blockers:** operator to add
  `marid-isolation` to required checks (8→9). **Next:** open PR #17.

## 2026-07-05 — PH-1 follow-up: strict client-scope event/list isolation RESOLVED
- **Done:** marid-owned `@marid/auth/event-filter.ts` body-filters non-owned frames from `GET /event` and
  entries from `GET /session` + `GET /permission`; zero upstream edit, no new P-*. Advisor-caught fixes:
  invariant pinned across all session families; permission leak class closed; accept-encoding stripped before
  filtered list routes. PR #15 → develop a3524a6f9; sync #16 main e14c232e1.
- **Decisions:** built via option (b). **Deviations:** POST `/permission/:id/reply` reply-gating residual
  (opaque `per_` id) documented, not hidden. **Blockers:** none. **Next:** PH-2 / PH-3.

## 2026-07-04 — MS-002 MET (PH-1 Marid layer complete)
- **Done:** PR #13 merged (11 checks green incl. 3-OS `marid-build`); authenticated `marid` binary passes
  contract tests. New `@marid/auth` (tokens/scopes/rate-limit/audit/request-ID); `marid serve` wrapper on the
  EXP-004 seam (zero server edit); TEST-CONTRACT; additive `src/marid.ts` + `script/marid-build.ts`. 92 tests.
- **Decisions:** DEC-011 durable ownership sidecar; DEC-012 additive marid.ts entry (P-ENTRY); DEC-013 branding
  split (identity now, cosmetic PH-5). **Deviations:** firehose/list altitude follow-up flagged (later resolved).
  **Blockers:** none. **Next:** PH-2 / PH-3 (PH-4 needs tokens, done).

## 2026-07-04 — MS-001 MET (PH-0 Foundations complete)
- **Done:** EXP-001..004 all PASS (no FAIL → no fallbacks); CI skeleton green; fork + baseline tag; branch
  protection. PRs #9 (reports), #10 (P-CI-4). **Decisions:** no marid concurrency layer (EXP-001); instance env
  set = XDG + port + TMP (EXP-002); Telegram ≥2s cadence (EXP-003); P-1 dropped — auth as outer wrapper (EXP-004).
- **Deviations:** two live steps deferred (bun-dependent). **Blockers:** none. **Next:** PH-1 / MS-002.
