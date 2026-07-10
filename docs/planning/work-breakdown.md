---
status: Approved
version: 1.0.0
updated: 2026-07-09
owner: operator (STK-001)
---

# Work Breakdown (WBS-)

Phase → work-item decomposition. Every leaf has a Definition of Done and traces to FRs/NFRs/ADRs/KPIs/RISKs.
Phases and their exit milestones are in [roadmap](roadmap.md) and [milestones](milestones.md); execution
follows TDD per [test strategy](../validation/test-strategy.md). Status `✅ done` marks completed leaves.
**PH-5 complete (MS-006, 2026-07-09): all of WBS-5.1..5.5 done.**

## PH-0 Foundations — ✅ COMPLETE (MS-001 met, 2026-07-04)
| WBS | Item | DoD | Traces | Status |
|---|---|---|---|---|
| WBS-0.1 | Create private repo from local clone; add `upstream` fetch-only remote; tag baseline | Repo exists; INV-003 respected; baseline tag pushed | Gate 11, ADR-0001 | ✅ done |
| WBS-0.2 | Import planning package + local artifacts via `feature/planning-package` PR | Gate-12 approval; nothing committed silently | INV-003 | ✅ done |
| WBS-0.3 | Branch protection + CI skeleton (lint, typecheck, unit, 3-OS smoke) | Required checks enforced on main/develop | FR-062/064 | ✅ done (+ CI flake class fixed, P-CI-4, PR #10) |
| WBS-0.4 | EXP-001 concurrency probe | PASS/FAIL report; DEC recorded if FAIL | HYP-001, RISK-010 | ✅ PASS — no marid concurrency layer needed |
| WBS-0.5 | EXP-002 isolation probe | Report; leaking paths enumerated if any | HYP-002, RISK-002 | ✅ PASS (audit) — live tree-diff deferred |
| WBS-0.6 | EXP-003 Telegram cadence probe | Report; cadence constants fixed | HYP-003 | ✅ PASS (live) — ≥2s cadence, 0×429 |
| WBS-0.7 | EXP-004 profile build probe | Report; P-1 seam question answered | HYP-004, DEC-001 | ✅ PASS (analysis) — P-1 dropped; live build deferred |

## PH-1 Marid layer — ✅ COMPLETE (MS-002 met, 2026-07-04, PR #13)
| WBS | Item | DoD | Traces | Status |
|---|---|---|---|---|
| WBS-1.1 | `marid` distribution profile (workspace filter, build scripts, binary target) | Binary builds on 3 OSes; excluded pkgs absent | FR-060, ADR-0002 | ✅ done (additive `src/marid.ts` + `script/marid-build.ts`, P-ENTRY; 3-OS `marid-build` CI green; hygiene grep) |
| WBS-1.2 | marid-auth: bearer tokens + scopes (`marid token` CLI) | 401 without token; scopes enforced; unit+integration tests | FR-031 | ✅ done (`@marid/auth`; 401/403; client scope fork-aware + durable ownership DEC-011) |
| WBS-1.3 | marid-auth: rate limiting + audit JSONL + request-ID | 429 behavior; audit lines complete; redaction test | FR-030/032/033, FR-059 | ✅ done (token-bucket 10/s·30, SSE cap 4, 429+retry-after; audit +session; x-request-id echo) |
| WBS-1.4 | Contract tests pinning committed v1 routes/events | Suite fails on any breaking upstream change | FR-035, RISK-001 | ✅ done (TEST-CONTRACT: routes via `Server.openapi()` + events via `EventManifest` + live `/event` SSE) |
| WBS-1.5 | Branding pass P-2 (name/TUI title/user-agent) + config defaults P-3 (`lsp:false` etc.) | Patch-surface register updated; grep-based hygiene test (Shaheen pattern) | FR-065, NFR-001 | ✅ identity done (name + `serve`/`token`); cosmetic P-2 (README/TUI title/UA/logo) + config P-3 deferred to PH-5 (DEC-013) |

## PH-2 Instances — ✅ COMPLETE (MS-003 met, 2026-07-05, PR #17)
| WBS | Item | DoD | Traces | Status |
|---|---|---|---|---|
| WBS-2.1 | marid-instance: add/list/path/start/stop/status/remove; env composition; launchers (3 OSes) | Commands work; `list --json`; 0700 dirs | FR-053, ADR-0006 | ✅ done (new `@marid/instance` pkg — `composeInstanceEnv` = EXP-002 env set; `MaridInstanceCommand` in `marid.ts`; `list --json`; 0700 trees; launcher via `process.execPath`) |
| WBS-2.2 | Port allocation + PID files + graceful shutdown | No orphan processes; port collisions impossible | FR-053 | ✅ done (race-free port via `--port 0` + logfile readiness; PID/port record; **idempotent start guard** — a second `start` returns the live record, never spawns a second server; platform-split tree-kill — `taskkill /T` on Windows, POSIX signals the process group *and* bare pid SIGTERM→SIGKILL; spiked on Windows) |
| WBS-2.3 | Multi-instance isolation test suite (from R-05 inventory + EXP-002) | KPI-003 green in CI | NFR-008 | ✅ done — MS-003 MET: fast unit tier (every R-05 row) + live 2-instance diff (`instance-isolation.test.ts`, `MARID_ISOLATION=1`) green in the 3-OS `marid-isolation` job (ubuntu 39s / macOS 53s / windows), on every PR-#17 run incl. the final all-green ×2 |

## PH-3 Cross-interface — ✅ COMPLETE (MS-004 met, 2026-07-05, PR #19; synced to main via #20 @862c7bd6fc)
| WBS | Item | DoD | Traces | Status |
|---|---|---|---|---|
| WBS-3.1 | Instance-default launch mode: TUI attaches to instance server | §7 flow works locally | FR-038/042, ADR-0004 | ✅ done — `marid instance attach <name>` (resolves running instance URL + bearer token → the upstream TUI attach path; headers flow to HTTP **and** SSE via the SDK, zero upstream edit). TUI-as-client wire behavior proven by the §7 E2E; interactive-renderer driving is out of automated scope (no repo precedent, 3-OS flake) |
| WBS-3.2 | Reconnect/replay client behavior (SDK guidance + gateway lib) | No event loss across restart in test | FR-036/043, RISK-006 | ✅ done — kill+restart E2E: reconnecting client re-fetches authoritative history written before the restart (no state loss). Firehose is live-only (no `?after=` — contract v1.1 correction); recovery = authoritative-store re-fetch. Speculative gateway package deferred to PH-4 (its consumer, YAGNI); reconnect pattern documented as SDK guidance in the contract |
| WBS-3.3 | Concurrency semantics doc + tests (from EXP-001 result) | Documented queue/steer behavior; tests assert it | FR-040/041 | ✅ done — api-event-contract v1.1 *Concurrency* section (join/steer, BusyError, abort, ordering); concurrency E2E asserts it through the authenticated marid wrapper (two clients, one session, no corruption) |

## PH-4 Telegram — ✅ COMPLETE (MS-005 met, 2026-07-07, PR #23)
| WBS | Item | DoD | Traces | Status |
|---|---|---|---|---|
| WBS-4.1 | marid-telegram: long polling, `update_id` dedup, allowlist | Unknown senders ignored; dedup test | FR-046/050/051 | ✅ done — long-poll ingress + operator-id allowlist + `update_id` dedup store; AC-010 proven live in the 3-OS TEST-TG job (stranger ignored + logged) |
| WBS-4.2 | Egress: HTML formatting, 4096-split, edit-coalesced streaming, typing action | Cadence within EXP-003 constants; 429 honored | FR-048 | ✅ done — HTML/4096-split edit-coalesced streaming at the EXP-003 cadence with 429 handling; AC-011 proven live in TEST-TG (progressive edits, complete) |
| WBS-4.3 | Permission prompts as inline keyboards → `/permission/:id/reply` | Approve/deny round trip < 5 s | FR-028, KPI-002 | ✅ done — race-safe exactly-once inline-keyboard permission flow → `permission.respond`; round trip proven via the faked-SDK integration test (event→keyboard→Deny→reject) |
| WBS-4.4 | Capability policy wiring (restricted agent + `channel:` token + caps) | Policy denial paths tested | FR-052, INV-001 | ✅ done — `@marid/auth` INV-001 by-construction backstop: channel route-allowlist (deny-by-default on owned-session sub-routes, cannot reach /shell or /command) + token-bound-agent body guard; `channel-binding` + `scope` tests |
| WBS-4.5 | Media within Bot-API caps | Send/receive tests | FR-049 | ✅ done — full media send + receive within Bot-API caps; media tests |

## PH-5 Release & sync
| WBS | Item | DoD | Traces | Status |
|---|---|---|---|---|
| WBS-5.1 | Public GitHub Releases pipeline (binaries, sha256, minisign signatures; upstream publish channels stripped) | Signed/checksummed release from tag | FR-060/064, C-6 | ✅ done — release pipeline (PR #27): `marid-release.yml` + `marid-build.ts --release` (tar/zip + sha256) + minisign signing; trust anchor wired (`minisign.pub` committed, secret `MINISIGN_SECRET_KEY`). Verified end-to-end (run 28892667716 green; throwaway prerelease signed+checksummed then deleted). AC-013 Met; AC-014 **Partial** (install path + 3-OS smoke = WBS-5.2). |
| WBS-5.2 | Install/update path for public releases (anonymous download + verify; DEC-010) | Documented + smoke-tested on 3 OSes | ~~RISK-009~~ (dissolved, DEC-010) | ✅ done — public `v0.1.0` RC cut (#35→main, merge-commit `8bf4ab61e`); documented anonymous download→`minisign -Vm`→`sha256sum -c`→run path (README); 3-OS install-smoke on the published signed assets (Linux+Windows green; macOS asset-name typo fixed forward PR #38); `marid upgrade` footgun removed. AC-014 Met. |
| WBS-5.3 | Upstream sync workflow automation (weekly check, monthly merge PR, delta report) | One real sync cycle executed | FR-061, KPI-004 | ✅ done — sync automation (PR #28): `marid-sync-upstream.yml` (weekly conflict-check + monthly merge PR, delta + migration-review + dependency-diff) **and one real 91-commit cycle merged via merge-commit (PR #31, KPI-004)**; `upstream/dev` now an ancestor of develop. AC-015 Met. Codemode reconciled per ADR-0002 (`external` + hygiene allowlist). |
| WBS-5.4 | README + attribution/non-affiliation + logo (per branding brief) | README complete; SVG logo committed | FR-065 | ✅ done — Marid README (attribution + minisign verify + `docs/branding/` logo); flame `mark.svg` + `logo-{light,dark}.png` lockup (operator-designed via Claude Design: Pixelify-Sans "Marid", blue face + orange offset, yellow→orange→red flame); P-2 realized (TUI title + startup logo redrawn, UA dropped w/ rationale); P-3 realized (`lsp:false` distribution default, overridable). FR-065 full. |
| WBS-5.5 | Readiness: traceability check, KPI evidence, docs validation | KPI-005/006 green; readiness report accepted | INV-008 | ✅ done — G-IDS fixed (audit rows now reference criteria defs), FR-064 re-marked `partial` (§18 scans/SBOM deferred, ADR-0007), AC-014 text corrected to public/anonymous (DEC-010); `validate_package.py docs/` = **RESULT: OK**; readiness report authored. **Gate-14 ACCEPTED 2026-07-09.** |

## PH-6 Telegram-first: gateway + full experience + mirroring + tests — post-MVP (all-in-one; ADR-0009/0011/0012/0013 Proposed; not-started, operator-gated)
| WBS | Item | DoD | Traces | Status |
|---|---|---|---|---|
| WBS-6.1 | **Marid Gateway** — evolve marid-auth into the gateway (marid-auth = a module; mandatory bearer + scope; device-token scope-binding concept) + extract a thin **`@marid/channel-client`** (SDK v2 + channel-token + event-pump + session-binding + streamer + reconnect); one `Server.extend`-style hook for new server-side surface | Gateway boots; channel-client wired; TEST-AUTH/TEST-SEC/channel-binding stay green (INV-001 unbroken) | ADR-0011, DEC-017, FR-031/032/033/035, NFR-001, RISK-017 | not-started |
| WBS-6.2 | **Full Telegram experience** (fix-in-place) — Markdown via `telegramify-markdown`; **files both ways** (inbound `resolveDownloadUrl`→`FilePartInput` + outbound send); **whitelisted slash commands**; inline keyboards; multi-part separation | Full round-trip incl. files+slash+inline-kbd; INV-002/004 respected | ADR-0009, DEC-014, FR-046/048/049, DEP-012 | ✅ done (impl) — 4 UX defects fixed in place: MarkdownV2 render (`telegramify-markdown`, split-then-render, 400→plain fallback); **inbound files land** (`resolveDownloadUrl`→`FilePartInput`, filename traversal guard, token URL never logged — INV-002/004); deny-by-default **slash whitelist** (`/new`,`/help`); **multi-part separation** (per-part streamers). Inline keyboards pre-existed (`permission.ts`). marid-telegram suite 68→**89 green**, typecheck clean; **EXP-005 PASS** confirms the fix-in-place approach. On `feat/ph6-marid-gateway` (unmerged); live 3-OS `marid-telegram` + real-client E2E = WBS-6.6. |
| WBS-6.3 | **Bidirectional mirroring** — session↔surface **binding registry** (explicit-attach: `/attach`); binding-aware **`isVisible`** filter (edit `event-filter.ts`); channel-client consumes bound sessions; SSE fan-out (`seq`→`id:`, refresh-on-gap) | An attached session mirrors both ways; unattached does not appear; additive (no upstream edit) | ADR-0012, DEC-018, FR-066/038/042, RISK-019 | not-started |
| WBS-6.4 | **Cross-surface permission + concurrency** — permission surfaces across bound surfaces (first-responder-wins, no double-approve); **view-via-binding, act-via-ownership**; join/steer spans channels | No privilege escalation via mirroring; cross-surface permission + concurrency tests green | ADR-0012, INV-001, FR-028/040/041, RISK-015 | not-started |
| WBS-6.5 | **SSE reconnect + re-fetch recovery** (folds deferred #8) — reconnect the firehose, re-fetch authoritative state, resume; attach triggers reconnect (mid-stream binding) | Injected SSE drop auto-recovers; reconnect test | FR-036/043, RISK-006 | not-started |
| WBS-6.6 | **Test strategy (4 tiers)** — fake-server E2E (blocking PR gate, extended) + GramJS userbot test-DC (TEST-TG-E2E) + Telegram-Web-Playwright (TEST-TG-UI) [local-pre-PR + GitHub-on-demand] + native mobilewright (TEST-TG-MOBILE, manual) + mirroring sync tests (TEST-SYNC) + **blast-radius/degradation tests** (AC-024, TEST-AUTH/CONTRACT); EXP-007/008/009/010 | EXP-007/008/009 PASS; AC-017/019/020/021/024 green; TEST-AUTH/SEC/CONTRACT green | AC-017/019/020/021/024, ADR-0013, RISK-024, EXP-007/008/009/010 | not-started |
| WBS-6.7 | **Docs + diagrams** — update `architecture/api-event-contract.md` (attach/binding/mirror endpoints + events + fan-out `seq`/`stateVersion` + contract version bump; TEST-CONTRACT pins them), `architecture/architecture.md` (Marid Gateway + `@marid/channel-client` + mirroring in the target arch; **patch-surface register** — enumerate the one gateway `Server.extend` hook if it becomes a `P-*`), the **Tarseem OpenCode+Marid diagrams** (`architecture/diagrams/` — gateway, channel-client, mirroring, remediated Telegram), and root docs (README / CLAUDE.md / AGENTS.md / CODEMAPS) | contract + architecture + diagrams + READMEs reflect PH-6; `validate_package.py docs/` = OK | FR-034/035, NFR-010, ADR-0011/0012 | not-started |

## PH-7 WhatsApp adapter — post-MVP (reuses the PH-6 gateway + `@marid/channel-client` + mirroring; ADR-0010/0014/0015 Proposed; not-started, operator-gated)
| WBS | Item | DoD | Traces | Status |
|---|---|---|---|---|
| WBS-7.1 | `@marid/whatsapp` package skeleton — separate process; `channel:` token; config + allowlist + dedup | Package builds; connects to `marid serve` with a channel token | FR-045, ADR-0005/0010 | not-started |
| WBS-7.2 | WhatsApp client integration (WAHA-NOWEB-WS primary / Baileys-direct-hardened alt); outbound-only; auth-state persistence | Inbound/outbound round-trip; outbound-only verified (no inbound port) | FR-047, OQ-004, RISK-014 | not-started |
| WBS-7.3 | Streaming simulation (presence + throttled edit-coalescing) + media send/receive | Streaming within WhatsApp limits; media tests | FR-048/049 | not-started |
| WBS-7.4 | Identity allowlist + inbound dedup + capability policy + **token-bound text-reply permission UX** (ADR-0015; strict parse, single-use/JID/TTL, server-side scope re-check — no interactive buttons) + **attach/mirror** (reuse ADR-0012) | Stranger ignored; bound agent; `APPROVE <token>` parser rejects ambiguous/wrong-token/expired; act-via-ownership; policy-denial tests | FR-028/050/051/052, INV-001, ADR-0012/0015, RISK-021 | not-started |
| WBS-7.5 | **Test strategy (ADR-0014)** — fake-WA at the WAHA WebSocket boundary (**deterministic blocking gate**, TEST-WA/AC-023) + burner real-protocol probe (manual, EXP-012) + native-app mobilewright (manual, EXP-013); narrow WAHA interface so the fake is small; EXP-006/011 | EXP-011 PASS (fake-WA gate); AC-018/022/023 green; burner/native probes documented | AC-018/022/023, EXP-006/011/012/013, ADR-0014, RISK-022 | not-started |
| WBS-7.6 | **Docs + diagrams** — update `architecture/api-event-contract.md` + `architecture/architecture.md` (WhatsApp adapter + WAHA sidecar + token-text permission + narrow interface), the Tarseem **diagrams** (`architecture/diagrams/` — add the WhatsApp channel), and root docs (README / CLAUDE.md / AGENTS.md / CODEMAPS) | docs + diagrams reflect PH-7; `validate_package.py docs/` = OK | FR-035, NFR-010, ADR-0010/0014/0015 | not-started |
