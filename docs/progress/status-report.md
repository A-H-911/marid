---
status: Approved
version: 1.0.0
updated: 2026-07-14
owner: operator (STK-001)
generation: derived
---

# Status Report

**Derived — regenerated each update cycle.** Point-in-time health snapshot. History is in the
[progress log](progress-log.md); the closing loop is the [acceptance audit](../validation/acceptance-audit.md).

## At a glance

| | |
|---|---|
| Reporting date | 2026-07-14 |
| Active work | **PH-8 Phase 5b (WBS-8.5) — web UI rebrand, visual assets, at the operator gate.** The flame identity across every web brand surface (`packages/ui`). **`Mark` + `Splash`** (`components/logo.tsx`) rewritten from the OpenCode square glyph to the **Marid flame silhouette** (kept `--icon-*` fills + viewBoxes → theme coloring + call-sites unchanged). **`favicon-v3.svg`** → full-color gradient flame (edge `#FBD24A→#F5901E→#DC2A16`, core `#FDEFB0→#F8B73C`). **Raster set** regenerated from that master SVG: favicon 96/`.ico`, apple-touch 180, PWA 192/512 (maskable), 1200×630 `social-share.png` OG card (flame + two-tone "Marid"). Pipeline: Chrome-headless SVG render + a pure-JS `node zlib` box downscaler (no ImageMagick; Chrome mis-sizes 180/192 windows). Every flame render **visually verified**. ui typecheck clean; ui 7/7; lint 0 errors. Legacy non-`-v3` favicons left (referenced by the excluded `packages/console`). **AC-030 → Met** (both halves; operator visual sign-off = merge gate). **5a MERGED** (PR #60 `67f56b8edd`). Prior PH-8 merged: WBS-8.1 (#54), 8.2 (#55/#56), Phase-3 (#57), 4a (#58), 4b (#59), 5a (#60) — **AC-025/026/027/028/029/031 Met; AC-030 Met on 5b merge**. **STOP: awaits operator merge (INV-005).** |
| Last completed phase | **PH-6 (Telegram-first) DONE — MS-007 MET (2026-07-12, PR #48 squash `4409d92f`, all 20 CI green).** The full PH-6 stack is merged to `develop`: **WBS-6.1** (Marid Gateway + `@marid/channel-client` + attach endpoint + `owns ∪ bound` `/global/event` fine-filter), **6.2** (full Telegram experience — markdown/files/slash/inline-kbd, marid-telegram 68→99 green), **6.3** (durable `BindingStore` + binding-aware `isVisible`), **6.4** (cross-surface permission: first-responder-wins, view-via-binding/act-via-ownership), **6.5** (SSE reconnect + backoff + re-fetch recovery + attach-triggered re-subscribe), **6.6** (four live test tiers), **6.7** (docs: contract **v1.2** + architecture **v1.1** + Tarseem `20-gateway-mirroring` + `docs/usage.md` user guide). **All MS-007 ACs Met** (AC-017/019/020/021/024); EXP-005/007/008/009 PASS. **🔒 INV-001 firehose isolation leak found via the live tier & FIXED** — ADR-0016 (route-based `isStream`) + ADR-0017 (lazy own-session visibility); zero upstream edit, no P-\*. Native-mobile EXP-010 **deferred** (never an MS-007 gate). |
| Overall status | **MVP COMPLETE (gate 14, 2026-07-09) + PH-6 (Telegram-first) COMPLETE (MS-007, 2026-07-12).** Public `v0.1.0` released; KPI-004∧005∧006 green; docs `validate = OK`. PH-6 fully merged to `develop` (PR #48 `4409d92f`) — AC-017/019/020/021/024 all Met. |
| Last milestone met | **MS-007 (2026-07-12)** — PH-6 Telegram-first: gateway + full experience + bidirectional mirroring + live test tiers (PR #48, squash `4409d92f`, all 20 CI green) |
| Next milestone | **MS-009 (PH-8 Isolation & deep rebrand)** — Phase 0 merged (PR #53); **ADR-0018 + DEC-022..027 Approved**; **WBS-8.1 upstream sync at the operator merge gate** (this PR). AC-025..031 Met + all 6 reported v0.2.0 issues map to a passing check → v0.3.0. *(MS-008 / PH-7 WhatsApp remains not-started, operator-gated, PH-8-independent.)* |

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
| PH-8 Isolation & deep rebrand | **Phase 5b (web visual assets) at operator gate; Phase 6 (docs) next** | 8.1/8.2/Phase-3/4a/4b/5a merged; 5b at gate | #54 (sync) · #55/#56 (isolation+config+pierce) · #57 (agent identity) · #58 (4a) · #59 (4b) · #60 (5a web code) · this PR (5b visual assets) | **AC-025/026/027/028/029/031 Met**; **AC-030 Met on 5b merge** — web rebrand complete (code + flame assets) |

## Acceptance snapshot

MVP: **14 / 16 Met**, **1 Partial** (AC-016 — MVP redaction slice holds, full secret-value redactor deferred,
ADR-0007), **1 Not-met** (AC-007 — premise superseded). AC-014 Met via the public `v0.1.0` release (KPI-006);
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
**PH-8 Phase 5b (WBS-8.5) — web UI rebrand, visual assets, at the operator gate.** The flame identity across every
web brand surface (`packages/ui`). **`Mark` + `Splash`** (`components/logo.tsx`) rewritten from the OpenCode
square-in-square glyph to the **Marid flame silhouette** (a teardrop matching the TUI `logo.ts` DNA), keeping the
`--icon-*` fill vars + viewBoxes so theme coloring and all call-sites are unchanged (monochrome at those small UI
glyphs). **`favicon-v3.svg`** → a full-color gradient flame (edge `#FBD24A→#F5901E→#DC2A16`, core
`#FDEFB0→#F8B73C`) on the `#131010` ground. **Raster set regenerated from that master SVG:** favicon 96/`.ico`
(16/32/48), apple-touch 180, PWA 192/512 (maskable), and a 1200×630 **`social-share.png`** OG card (flame +
two-tone "Marid" wordmark + tagline); the two SVG sources are committed alongside. Pipeline: Chrome-headless render
of the SVG + a **pure-JS `node zlib` box downscaler** (no ImageMagick — Windows `convert` is the NTFS tool, and
Chrome mis-sizes the 180/192 headless windows). Every flame render **visually verified** (favicon 96/512,
apple-touch 180, social card, Mark + Splash). ui typecheck clean; ui 7/7; `bun lint` 0 errors. **AC-030 → Met**
(both halves; operator visual sign-off = merge gate). **Deviation:** legacy non-`-v3` favicons +
`social-share-{zen,black}.png` left in place — still referenced by the EXCLUDED `packages/console`, so deletion is
out of scope. **Next:** Phase 6 (docs/diagrams) → Phase 7 (release v0.3.0).

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
public/anonymous (DEC-010). Disclosed residuals carried into the release: AC-016 Partial (egress
secret-redactor deferred, RISK-007 / ADR-0007 containment), AC-007 Not-met (premise superseded — re-fetch
recovery is the delivered behavior), Telegram gateway **beta** (UX defects → post-MVP fork, ADR-0008 /
deferred #9). Watch: upstream v1→v2 migration (RISK-001) on future syncs.

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
**PH-8 (Isolation & deep rebrand) — at the operator gate.** On ADR-0018 approval + merge of this docs PR, the
phases run in order (each branch → PR → CI green → operator merge): **WBS-8.1** upstream sync first
(`upstream/dev cf7503687a`, 167 commits / 458 files) → **8.2** total DATA isolation (build-time app-name P-6 +
config P-7 + migration) → **8.3** agent identity (P-8) → **8.4** TUI rebrand (P-2) → **8.5** web UI (separate PR)
→ **8.6** docs/diagrams/screenshots → **8.7** release **v0.3.0**. MS-009 closes when AC-025..031 are Met and all 6
reported v0.2.0 issues map to a passing check. **Still operator-gated, PH-8-independent:** **PH-7 WhatsApp**
(ADR-0010 / DEC-015/016). Backlog: egress secret-redactor (ADR-0007 / AC-016), AC-007 formal supersede, stats
mechanism (deferred #10), upstream sync cadence.
