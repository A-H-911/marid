---
status: Approved
version: 1.0.0
updated: 2026-07-17
owner: operator (STK-001)
generation: derived
---

# Status Report

**Derived — regenerated each update cycle.** Point-in-time health snapshot. History is in the
[progress log](progress-log.md); the closing loop is the [acceptance audit](../validation/acceptance-audit.md).

## At a glance

| | |
|---|---|
| Reporting date | 2026-07-17 |
| Active work | **PH-8 COMPLETE — public [v0.3.0](https://github.com/A-H-911/marid/releases/tag/v0.3.0) released 2026-07-16; MS-009 MET.** Total DATA isolation + deep rebrand shipped (all 6 reported v0.2.0 issues → Met AC). The final docs reconcile (WBS-8.6, PR #64 `f022fbf005`) brought the docs package into line with what shipped: **usage.md** gains a "Data isolation & coexistence" section (per-OS data/state/config/cache/managed dirs — the XDG layout on every OS, not `~/Library`/`%AppData%`; the `marid.json` config rule + project-`opencode.json` fallback; the five-var `OPENCODE_*` env-pierce table; the one-time v0.2.0 migration; no auto-update); **README** gets a data-isolation Security-model bullet; **branding.md** flips the ADR-0018 note Proposed→realized; **architecture.md** flips P-6/P-7 planned→realized with real sites (`packages/core/src/global.ts:17`, `config.ts maridConfigNames`) + reconcile recipes; **CLAUDE.md**/**CONTRIBUTING.md** corrected; **NFR-010** Draft→Met. Diagrams 01/05/13 reviewed and left as-is (architecture-level, already Marid-accurate). **TUI + Telegram screenshots deferred** to the operator (headless capture can't be faithful). **All prior PH-8 phases merged:** WBS-8.1 (#54 sync) · 8.2 (#55/#56 isolation+config+pierce) · Phase-3 (#57 agent identity) · 4a/4b (#58/#59 TUI) · 5a (#60) · web (#63 `19ad4279f3`, 5b assets + auth-gate P-9 + lockup) · **TUI logo (#62 `7e4157b94c`, MERGED)** · **8.6 docs (#64 `f022fbf005`, MERGED)** — **AC-025..031 all Met**. **v0.3.0 shipped** (WBS-8.7): `develop→main` sync #66 merge-commit `378ba650` → `v0.3.0` tag → 21 signed assets + 3-OS install-smoke green. **MS-009 MET; PH-8 complete.** |
| Last completed phase | **PH-6 (Telegram-first) DONE — MS-007 MET (2026-07-12, PR #48 squash `4409d92f`, all 20 CI green).** The full PH-6 stack is merged to `develop`: **WBS-6.1** (Marid Gateway + `@marid/channel-client` + attach endpoint + `owns ∪ bound` `/global/event` fine-filter), **6.2** (full Telegram experience — markdown/files/slash/inline-kbd, marid-telegram 68→99 green), **6.3** (durable `BindingStore` + binding-aware `isVisible`), **6.4** (cross-surface permission: first-responder-wins, view-via-binding/act-via-ownership), **6.5** (SSE reconnect + backoff + re-fetch recovery + attach-triggered re-subscribe), **6.6** (four live test tiers), **6.7** (docs: contract **v1.2** + architecture **v1.1** + Tarseem `20-gateway-mirroring` + `docs/usage.md` user guide). **All MS-007 ACs Met** (AC-017/019/020/021/024); EXP-005/007/008/009 PASS. **🔒 INV-001 firehose isolation leak found via the live tier & FIXED** — ADR-0016 (route-based `isStream`) + ADR-0017 (lazy own-session visibility); zero upstream edit, no P-\*. Native-mobile EXP-010 **deferred** (never an MS-007 gate). |
| Overall status | **MVP COMPLETE (gate 14, 2026-07-09) + PH-6 (Telegram-first) COMPLETE (MS-007, 2026-07-12).** Public `v0.1.0` released; KPI-004∧005∧006 green; docs `validate = OK`. PH-6 fully merged to `develop` (PR #48 `4409d92f`) — AC-017/019/020/021/024 all Met. |
| Last milestone met | **MS-007 (2026-07-12)** — PH-6 Telegram-first: gateway + full experience + bidirectional mirroring + live test tiers (PR #48, squash `4409d92f`, all 20 CI green) |
| Next milestone | **MS-009 MET (2026-07-16)** — PH-8 complete; public v0.3.0 released (AC-025..031 Met, all 6 reported v0.2.0 issues → Met AC). **Next open work: MS-008 / PH-7 WhatsApp** — not-started, operator-gated, PH-8-independent (ADR-0010 / DEC-015/016). Backlog: stats mechanism (deferred #10), upstream sync cadence, the `process.test.ts` emission-order CI flake (deferred #11). *(Two former backlog items are closed, [ADR-0019](../adrs/adr-0019-channel-secret-containment-final.md) 2026-07-16: the egress secret-redactor is **dropped from scope**, not deferred; AC-007's formal supersede is **done**.)* |

## Phase progress

| Phase | Status | Exit criteria met? | Evidence | Notes |
|---|---|---|---|---|
| PH-0 Foundations | done | yes | MS-001 (PR #9) | EXP-001..004 PASS |
| PH-1 Marid layer | done | yes | MS-002 (PR #13) | marid-auth + profile |
| PH-2 Instances | done | yes | MS-003 (PR #17) | 3-OS `marid-isolation` |
| PH-3 Cross-interface | done | yes | MS-004 (PR #19) | 3-OS `marid-sync`; contract v1.1 |
| PH-4 Telegram | done | yes | MS-005 (PR #23) | 3-OS `marid-telegram` green; INV-001 backstop; AC-010/011/012 Met |
| PH-5 Release & sync | **done** | yes | **MS-006 (2026-07-09)**: public `v0.1.0` release (#35→main `8bf4ab61e`); WBS-5.1 (#27) · 5.3 (#28/#31) · 5.4 (#33) · 5.2 (#35/#38) · 5.5 (this PR) | KPI-004∧005∧006 green; `validate = OK`. Gate-14 ACCEPTED 2026-07-09 |
| PH-6 Telegram-first | **done** | yes | **MS-007 (2026-07-12)**: Marid Gateway + full Telegram + bidirectional mirroring + 4 live test tiers; WBS-6.3 (#44) · 6.1 (#46) · 6.5 (#47) · 6.2/6.4/6.6/6.7 (#48 `4409d92f`) | AC-017/019/020/021/024 all Met; EXP-005/007/008/009 PASS; INV-001 leak fixed (ADR-0016/0017); zero upstream edit, no P-\* |
| PH-8 Isolation & deep rebrand | **done** | yes | **MS-009 (2026-07-16)**: public v0.3.0 released — #54 (sync) · #55/#56 (isolation+config+pierce) · #57 (agent identity) · #58/#59 (4a/4b TUI) · #60 (5a) · #63 (5b+auth+lockup) · #62 (TUI logo) · #64 (8.6 docs) · **#66 (v0.3.0 sync `378ba650`)** | **AC-025..031 all Met**; 21 signed assets + 3-OS smoke green |

## Acceptance snapshot

MVP: **14 / 16 Met**, **2 Not-met** — both **closed dispositions, not open work** ([ADR-0019](../adrs/adr-0019-channel-secret-containment-final.md),
2026-07-16): **AC-016** accepted-with-deviation (the secret-value redactor is **dropped from scope and will
not be built**; B2/B4 authorization-boundary containment is the control; RISK-007 accepted+closed) and
**AC-007** superseded (premise invalid — the v1 firehose is live-only; the recovery criterion is **AC-008**,
Met). Both read `Not-met` only because the validator's verdict set admits no *Superseded* / *Accepted*; each
row's Notes lead with the real disposition. AC-014 Met via the public `v0.1.0` release (KPI-006);
AC-015 Met via the one real sync cycle (PR #31, KPI-004). AC-010/011 Met via
the live 3-OS TEST-TG; AC-012 Met via the faked-SDK permission round trip + `parseAskEvent` + `permission.test`
+ marid-auth `channel-binding`. Detail in the [acceptance audit](../validation/acceptance-audit.md).

PH-6 (Telegram-first): **AC-017/019/020/021/024 all Met** (2026-07-12, PR #48) — live tool calling, bidirectional
mirroring, userbot + Web-Playwright real-client tiers, gateway blast-radius; EXP-005/007/008/009 PASS.

## Completed since last report
- **WBS-5.2 / AC-014 / KPI-006** (PR #36 finalize, #35 RC → main, #38 smoke fix): **public `v0.1.0` release** —
  7 targets × (archive + `.sha256` + `.minisig`) = 21 signed assets; RC 17 checks green; 3-OS install-smoke
  (Linux+Windows green, macOS asset-name typo fixed forward). `marid upgrade` footgun removed.
- **WBS-5.5** (this PR): G-IDS fixed (audit rows reference criteria defs), FR-064 re-marked `partial`, AC-014
  text corrected (DEC-010), `validate = OK`, readiness report authored.
- Earlier PH-5: **WBS-5.1** (#27) release pipeline + minisign trust anchor; **WBS-5.3 / KPI-004** (#28/#31)
  sync automation + one real 91-commit cycle; **WBS-5.4** (#33) Marid README + flame logo + P-2/P-3.

## In progress
**None — PH-8 complete (MS-009 MET, 2026-07-16).** Public [v0.3.0](https://github.com/A-H-911/marid/releases/tag/v0.3.0)
released: RC dry-run (`v0.3.0-rc.1`) pre-proved the build, then `develop → main` sync #66 merge-commit `378ba650`
→ `v0.3.0` tag → `marid-release.yml` green → **21 signed assets** (7 targets × archive/.sha256/.minisig) + **3-OS
`install-smoke` green** (3 of 7 targets exercised — linux-x64/darwin-arm64/windows-x64; arm64/musl build-only).
AC-025..031 all Met; all 6 reported v0.2.0 issues → a Met AC. **Next open work: PH-7 WhatsApp** (operator-gated,
not started). **(Screenshots: real active-session TUI + Telegram captures remain a tracked fast-follow — README
honestly notes "captures follow in a later pass"; they were never a v0.3.0 gate.)**

**(Phase 6 docs, merged 2026-07-16, PR #64 `f022fbf005`)** — brought the docs package into line with the
deep-rebrand + data isolation shipped on `develop`: **usage.md** "Data isolation & coexistence" (per-OS dirs,
`marid.json` config rule, the `OPENCODE_*` env-pierce table, v0.2.0 migration, no auto-update); **README**
data-isolation bullet; **branding.md** ADR-0018 note → realized; **architecture.md** P-6/P-7 → realized (real
sites + reconcile recipes); **CLAUDE.md**/**CONTRIBUTING.md** corrected; **NFR-010** → Met. Diagrams 01/05/13
reviewed and left as-is (already Marid-accurate; `opencode` labels are kept internal package names — DEC-009).
`validate = OK`; docs-only.

**(TUI logo, merged 2026-07-15, PR #62 `7e4157b94c`)** — operator local-review surfaced two TUI art defects greps +
CI couldn't catch (block-ASCII art is invisible to `grep`): the `/exit` goodbye still spelled "OpenCode"
(`presentation.ts` carried its own hardcoded block logo 4a/4b never touched → rewired to the `logo.ts` mark as the
single source of truth, kept the `marid -s` hint), and the startup flame towered over the wordmark (redesigned
`logo.ts` to a 3-row teardrop flame the same height as the letters, operator-picked from a new
`packages/tui/script/render-logo.ts` ANSI→HTML→headless-Chrome harness). `presentation.test.ts` structural guard;
`logo.test.ts` green; typecheck 34/34. **AC-029 stays Met.**

**(web phase, merged 2026-07-15, PR #63 `19ad4279f3`)** — §5b flame assets + web **auth-gate + navigation-safe
token (P-9)** + **brand lockup** (`marid-logo.png` pixel wordmark + grey halo → shared inline-SVG, flame height = "M"),
superseding #61 (closed). Root-caused + verified live via chrome-devtools; see the 2026-07-15 progress-log entry.
**AC-030 → Met.**

**(5a, merged 2026-07-14, PR #60 `67f56b8edd`)** — web code half: 3 runtime `opencode.ai` fetches killed
(changelog → local `changelog.json`, notification icon + avatar → local `-v3`), web strings → Marid, GO-upsell
removed at root (closed the `retry.ts` residual), Zen/Go de-marketed (IDs kept), apiKey masked, click-throughs →
`github.com/A-H-911/marid`, `TEST-WEB` guard + a latent `titlebar.tsx` typecheck fix. AC-030 no-fetch half Met.

**(4b, merged 2026-07-14, PR #59 `049089b79a`)** — §94 logo redesign: `logo.ts` the single mark source (taller
6-row flame + `leftCore` mask + 6-row "MARID" wordmark), data-driven gradients (edge `#FBD24A→#F5901E→#DC2A16`,
core `#FDEFB0→#F8B73C`), **two-tone split wordmark** (blue `#2F6BFF` MAR / orange `#F0731F` ID) behind a
`COLORTERM` truecolor render gate (single-tone crisp-mono fallback on 256-color); both renderers color per-cell
from shared data; splash badge → compact Marid flame; `go` glyph deleted. **AC-029 → Met** — TUI/CLI rebrand
complete.

**(4a, merged 2026-07-14, PR #58 `a991ed7f62`)** — mechanical rebrand + GO-upsell removal at root. A repo-wide
re-enumeration (the earlier surface map was ~50% incomplete — it missed the whole `--mini` mode, `uninstall`,
`error.ts`, and the crash screen) rebranded every user-facing "OpenCode" string in the shipped `marid` binary:
**main TUI** (exit hint `opencode -s`→`marid -s`, notification title + sound-pack name, update toast, docs link →
Marid repo, both sidebar footers "● Marid {version}", permission prose, ~12 tips' wrong-binary `opencode …`→
`marid …` hints, model-error hints, crash screen + bug-report → Marid repo), the **`--mini` run mode**
(permission/prompt prose), and **`uninstall.ts`**. **GO-upsell removed at the root** — deleted the TUI upsell
subsystem (`dialog-retry-action`+`bg-pulse`+`bg-pulse-render`) and the rate-limit handler in
`routes/session/index.tsx`, and **neutralized the server source** `session/retry.ts` (the inline retry footer
renders `retry.message`, so the dialog delete alone left "…subscribe to Go" visible); both providers de-marketed
(IDs kept). Cosmetic → **unconditional** "Marid" per PH-5 P-2, under the existing **P-2** row (no new `P-*`).
typecheck clean both packages; `presentation`/`app-lifecycle`/`retry`/`permission.shared` tests green.
**AC-029 → Partial. STOP:** operator merge (INV-005). **PR 4b (next):** §94 logo redesign (flame + two-tone split
wordmark) behind a truecolor render gate + splash rebrand + `go`-glyph deletion → AC-029 Met. PH-0..6 complete;
PH-7 (WhatsApp) operator-gated, not started.

## Blockers & risks
No active blockers. WBS-5.5 resolved the two devil's-advocate flags: FR-064 re-marked `partial` (§18
dependency/secret/license scans + SBOM unbuilt — deferred, ADR-0007), and AC-014 text corrected to
public/anonymous (DEC-010). Residuals carried into the release, **all since closed**: AC-016 and AC-007 were
closed 2026-07-16 by [ADR-0019](../adrs/adr-0019-channel-secret-containment-final.md) — the egress
secret-redactor is **dropped from scope** (not deferred), leaving B2/B4 authorization-boundary containment as
the control and **RISK-007 accepted + closed**; AC-007 is **superseded**, its recovery criterion being AC-008
(Met). The Telegram gateway **beta** caveat closed at PH-6/MS-007 — the UX defects were fixed **in place**
(ADR-0009 superseded the ADR-0008 fork plan; deferred #9 Done). Watch: upstream v1→v2 migration (RISK-001) on future syncs.

## Decisions since last report
**PH-8 (2026-07-13, plan §2):** total **DATA** isolation via a build-time app-name, **keep `OPENCODE_*` env** +
pierce disclosure (DEC-022); config `marid.json` + project-`opencode.json` fallback, **no global fallback**
(DEC-023); `.opencode/` kept upstream-named (DEC-024); **one-time-copy** migration (DEC-025); full agent-identity
transform (DEC-026); **no DB rename — keep `opencode.db`** (DEC-027, Approved). Realized by **ADR-0018
(Approved 2026-07-13, Phase-0 operator gate)**.
Earlier: releases **public/anonymous** (DEC-010); **minisign** signing; **ship-under-containment** (ADR-0007);
logo = **red-orange flame + shadowed "marid" wordmark** (2026-07-08); `0.x` release line (package.json stays
upstream `1.17.15`; release↔upstream mapping = baseline SHA per sync).

## Upcoming
**PH-8 (Isolation & deep rebrand) — DONE.** It ran in order, each branch → PR → CI green → operator merge:
**WBS-8.1** upstream sync first (#54) → **8.2** total DATA isolation (build-time app-name P-6 + config P-7 +
migration; #55/#56) → **8.3** agent identity (P-8; #57) → **8.4** TUI rebrand (P-2; #58/#59, logo #62) →
**8.5** web UI (#60/#63) → **8.6** docs/diagrams (#64) → **8.7** release **v0.3.0** (#66 `378ba650` → tag).
MS-009 closed 2026-07-16: AC-025..031 all Met and all 6 reported v0.2.0 issues map to a passing check.

**The only open work is PH-7 WhatsApp** (MS-008) — not-started, **operator-gated**, PH-8-independent
(ADR-0010 / DEC-015/016). Backlog: stats mechanism (deferred #10), upstream sync cadence (monthly; last sync
2026-07-13, so next ≈2026-08-13), and the `process.test.ts` emission-order CI flake (deferred #11 →
P-CI-4 watch-list). *(Closed since the last report: the egress secret-redactor — **dropped from scope**, not
deferred — and AC-007's formal supersede, both via ADR-0019 on 2026-07-16.)*
