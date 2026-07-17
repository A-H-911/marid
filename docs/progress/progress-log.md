---
status: Approved
version: 1.0.0
updated: 2026-07-17
owner: operator (STK-001)
---

# Progress Log

Append-only, newest first. Each entry: **Done / Decisions / Deviations / Blockers / Next.** Machine mirror
lives in `keystone-state.json` `progress[]`. Volatile "where are we now" is the
[status report](status-report.md).

## 2026-07-17 — Tracker reconcile: ADR-0019 propagation + docs-package validator conformance — unmerged, at the operator gate
- **Done:** finished the tracking protocol that **PR #71** (`6b9e29ae5d`) left 3/5 complete — it updated the
  [acceptance audit](../validation/acceptance-audit.md) + `keystone-state.json` but skipped this log and the
  [status report](status-report.md), which still advertised the closed items as open backlog. Propagated
  [ADR-0019](../adrs/adr-0019-channel-secret-containment-final.md) everywhere it was owed: the audit's MVP
  tally (`14/16 Met` + **2 Not-met**, replacing the self-contradicting "1 Partial + 1 Not-met" that survived
  next to already-flipped rows), the audit's post-MVP paragraph (**AC-017 Pending→Met**, stale since MS-007),
  its PH-5→**PH-8/MS-009** scope line, and the status report's snapshot / residuals / backlog / `Upcoming`
  tense. **Deferred-work register:** item 1 `Resolved`→**Done** and item 9 `Superseded`→**Done** (both were
  off the register's own enum); **item 6 `In progress`→Done** — stale ~8 days: DEC-010 (2026-07-03) made the
  repo public, protection is live (17 required checks), and the WBS-5.1 "private releases" premise was
  reconciled *to public* at MS-006 (AC-014 Met on the public `v0.1.0`); its source doc
  [deviation-branch-protection](../decisions/deviation-branch-protection.md) flipped Proposed→**Superseded**
  (it still read "making the repo public is a non-starter" and ended "STOP — awaiting operator decision").
  **New item 11:** the `packages/core` `process.test.ts` emission-order flake, with its doctrine home added
  to the **P-CI-4 watch-list**.
- **Fixed — the docs package was failing validation and no doc change caused it.** `G-PROGRESS` **32
  findings → 0**; `validate_package.py docs/` = **OK** (all 7 gates). **Root cause:** Keystone **0.1.0 has no
  `G-PROGRESS` gate at all** and printed OK, so every historical "validate = OK" was true *against 0.1.0*;
  the installed **1.0.0 added the gate**, which then choked on the audit's `AC-` cells being markdown links
  (`[AC-001](acceptance-criteria.md)` never `fullmatch`es `ID_TOKEN_RE`, so the whole table was skipped →
  "no Verdict column" → all 31 criteria reported missing). Those links were **our own workaround**, added by
  `ad10384679` to silence 0.1.0's G-IDS duplicate-definition findings; 1.0.0 fixed that root cause properly
  (its `audit_view` carve-out reads audit cells as *references*), making the links obsolete **and harmful**.
  The fix is a **revert to bare ids** — the format the package was generated with at `276c10c0fc` (#22).
  Verified on a throwaway copy before touching the package; **G-IDS stays PASS**.
- **Decisions:** (1) **verdict vocabulary conformed** (operator-directed) — `G-PROGRESS` admits only
  `Met | Partial | Not-met | Pending`, which has no value for *superseded* (AC-007) or
  *accepted-with-deviation* (AC-016), so both rows read **`Not-met`** with the true disposition **leading**
  their Notes. Literally accurate for AC-016 (ADR-0019 says "NOT Met"); it under-describes AC-007, which is
  **void, not failed**. ADR-0019's substance is untouched and now carries a note recording this; widening
  Keystone's `ALLOWED_VERDICTS` (`Superseded`/`Accepted` are already valid `DOCUMENT_STATUSES` in that tool)
  reverts the two cells with no ADR change. (2) **Version floor recorded** — the package now requires
  **Keystone ≥ 1.0.0** (governance / CLAUDE.md / CONTRIBUTING); against 0.1.0 the bare ids report 31 bogus
  duplicate-definitions, so the two versions are **mutually exclusive** and a green 0.1.0 run is not
  evidence. (3) Flake **tracked, not fixed** — no code touched.
- **Deviations:** the flake went to the **P-CI-4 watch-list**, not a new P-CI-3 row: P-CI-3 enumerates
  upstream test edits that *exist*, and we made none. CLAUDE.md's "route new timing flakes through
  `OPENCODE_TIMING_SCALE` (P-CI-4)" **does not apply as written** — `it.effect` is called with no `opts`, so
  there is no per-test budget to scale; only constants inside the child `-e` script. Recorded on the entry.
  Dated snapshots ([mvp-readiness-report](../validation/mvp-readiness-report.md), `handoff-manifest.json`,
  pre-07-16 entries in this log) deliberately **left as history**. The audit's `status: Draft` left alone —
  flipping it is a governance act (INV-005), not bookkeeping.
- **Blockers:** none — docs-only, zero `packages/` changes; `validate_package.py docs/` = OK.
  **Next:** operator review → squash into `develop`; then a `develop → main` docs sync when convenient.
  Open work is unchanged: **PH-7 WhatsApp** (operator-gated, not started).

## 2026-07-16 — PH-8 Phase 7 (WBS-8.7): public v0.3.0 RELEASED — MS-009 MET, PH-8 complete
- **Done:** cut the public **[v0.3.0](https://github.com/A-H-911/marid/releases/tag/v0.3.0)** release, closing MS-009
  and completing PH-8. Sequence (each an operator gate): **GATE 0** RC dry-run — `v0.3.0-rc.1` via
  `workflow_dispatch` built all 7 targets → 21 signed assets + 3-OS install-smoke green, proving the release build
  on current `develop` (then deleted). **GATE 1** PR #64→#65 tracker prep (docs-only) merged to develop. **GATE 2**
  `develop → main` sync PR #66 **merge-commit** (`378ba650`, preserves ancestry) — 17 required checks green.
  **GATE 3** `v0.3.0` tag on `378ba650` via `gh api` refs → `marid-release.yml` green → **21 signed assets** (7
  targets × archive/.sha256/.minisig) published + **3-OS install-smoke green**. **GATE 4** this tracker close.
- **Verified:** pre-tag `git diff f022fbf005 378ba650` = **docs-only** → the tag build is byte-identical to the
  green RC build (the RC was a faithful proxy because the tracker PRs don't touch the binary). Release
  `isDraft:false isPrerelease:false`, 21 assets, now "Latest". All 6 reported v0.2.0 issues map to a Met AC
  (1→AC-027, 2→AC-031, 3→AC-029, 4→AC-028, 5→AC-030, 6→AC-025+026); AC-025..031 all Met.
- **Decisions:** version is tag-driven (`OPENCODE_VERSION`) — `package.json` stays upstream `1.17.18`, no
  version-file edit. Draft-first pipeline (a failed build never publishes). RC-first kept the real `v0.3.0` tag
  pristine.
- **Deviations:** `install-smoke` exercises **3 of 7 targets** (linux-x64/darwin-arm64/windows-x64); arm64/musl
  are build+sign only (matches v0.2.0; WBS-8.7 DoD asks only "3-OS install-smoke"). Real active-session TUI +
  Telegram **screenshots** remain a tracked fast-follow (never a v0.3.0 gate).
- **Blockers:** none. **Next:** PH-8 is complete. Open work: **PH-7 WhatsApp** (operator-gated, not started).

## 2026-07-15 — PH-8 WBS-8.6: docs + diagrams + register reconcile (Phase 6) — MERGED (PR #64 `f022fbf005`)
- **Done:** brought the docs package into line with the deep-rebrand + data isolation now shipped on `develop`.
  **usage.md** — new "Data isolation & coexistence" section: the per-OS data/state/config/cache/managed dirs (the
  XDG layout on **every** OS — `<home>/.local/share/marid` etc., not `~/Library`/`%AppData%`), the `marid.json`
  config-name rule (+ project-`opencode.json` fallback, global reads `~/.config/marid/` only), the five kept
  `OPENCODE_*` data-layer overrides that pierce isolation (boot WARN, value never logged), the one-time v0.2.0
  migration, and the no-auto-update note. **README** — a "Data isolation from co-installed OpenCode" bullet in the
  Security model → usage. **branding.md** — flipped the ADR-0018 note from Proposed/future to Approved/realized
  (agent identity + TUI flame/two-tone/render-gate + web flame assets + lockup), reconciled the "XDG dir names stay
  upstream" boundary. **architecture.md** — P-6/P-7 rows flipped planned→realized with real sites
  (`packages/core/src/global.ts:17`, `config.ts maridConfigNames`) + reconcile recipes. **CLAUDE.md** —
  P-6/P-7/P-8/P-9/P-CI-5 added to the Current-surface list, P-2 XDG note corrected. **CONTRIBUTING.md** — dev
  command fixed to `bun run --cwd packages/opencode src/marid.ts` (`bun dev` runs the un-isolated upstream).
  **NFR-010** Draft→Met. Trackers reconciled; `validate_package.py docs/` = OK.
- **Decisions:** diagrams 01/05/13 **not re-rendered** — reviewed each spec; they are architecture-level and
  already Marid-accurate, and neither the cosmetic rebrand nor the runtime dir-namespacing changes what they
  depict (their `opencode` labels are the kept internal package names, DEC-009). Optional isolation diagram
  skipped (marked optional; no gap demands it). AC-025..031 already Met (folded in as each phase landed) — no
  audit-verdict change this PR.
- **Deviations:** TUI + Telegram **screenshots deferred** — can't be faithfully captured headlessly; the operator
  is the visual gate (README already flags "captures follow in a later pass"). Surfaced at the checkpoint.
- **Blockers:** none — **MERGED as PR #64 (squash `f022fbf005`)** 2026-07-16. **Next:** Phase 7 (WBS-8.7) — release v0.3.0 (RC dry-run → develop→main sync PR → `v0.3.0` tag).

## 2026-07-15 — PH-8 web auth-gate + navigation-safe token (P-9) + brand lockup — MERGED (PR #63 `19ad4279f3`)
- **Done:** the web-phase PR squash-merged to `develop` (`19ad4279f3`, all 20 CI green). Based on the 5b branch, so it
  **superseded #61** (closed) and carried the 5b flame assets + the auth-gate + the brand lockup. **(1) Auth survives
  navigation (P-9):** a secured gateway needs the token on every request; it arrives once via `?auth_token=` and lived
  only in the boot server's in-memory `http.password`, so navigating into a re-resolved local-server connection whose
  URL isn't byte-identical to the boot server's (active `localhost:4096` vs boot `127.0.0.1:4096`) dropped it →
  `/global/health` 401 → false Unauthorized **even with a valid token**. Root-caused live via chrome-devtools
  (reproduced 401→Unauthorized on the pre-fix code, then 200→home after). Fix at the single SDK chokepoint
  (`createSdkForServer`): persist the token to `sessionStorage` at boot (`entry.tsx`) + fall back to it for any
  **loopback** connection missing a password (`isLoopbackUrl` guard keeps it off remote/desktop; `!password` guard
  leaves an explicit-password server untouched). Additive `AuthGate` + `Unauthorized` token-entry screen reacting to
  the already-running global health poll (`ServerHealth.unauthorized`). Upstream `disableHealthCheck` (#29319)
  untouched. Registered **P-9** in `architecture.md`. **(2) Brand lockup:** `marid-logo.png` (old pixel wordmark + grey
  halo box, never touched in the flame rebrand) → shared inline-SVG on `Logo` (home/crash) + `WordmarkV2` (new-session
  hero): gradient flame (favicon paths) + two-tone "Marid" wordmark (`#2F6BFF`/`#F0731F`), **flame height = "M"
  cap-height** (operator-approved). Unit-guarded (`server.test.ts` `isLoopbackUrl`).
- **Decisions:** #63 supersedes #61 (closed, redundant — its 5b commits are in develop via #63). AC-030 stays Met; P-9
  added to the patch surface.
- **Deviations:** `marid-logo.png` now unused by the app (README still references it — out of web scope).
- **Blockers:** none. **Next:** the TUI logo follow-up (PR #62, below) → Phase 6 (docs/diagrams) → Phase 7 (v0.3.0).

## 2026-07-14 — PH-8 TUI logo follow-up: goodbye "OpenCode" residual + flame-height retune — MERGED (PR #62 `7e4157b94c`)
- **Done:** operator local-review of the TUI surfaced two art defects that string-greps + CI could not catch (block-ASCII
  art is invisible to `grep`). **(1) `/exit` goodbye still spelled "OpenCode"** — `packages/tui/src/util/presentation.ts`
  carried its OWN hardcoded block-art logo that 4a/4b never touched. Rewrote it to render the SAME mark as the startup
  logo, imported from `logo.ts` (**single source of truth** — a rebrand or glyph change can't leave a stale goodbye
  again), **in FULL COLOR** (flame gradient + two-tone "MARID", matching the startup banner — operator wanted it not
  monochrome); kept the `marid -s` hint. **(2) startup flame too tall** — the 6-row flame towered over the 3-row
  "MARID" wordmark. Redesigned `logo.ts` to a **3-row teardrop flame** (solid full-height rounded top `▟█▙`, body with
  bright core, tapered base; a tight 1-cell gap), same height as the letters, 3-stop gradient (`#FBD24A→#F5901E→#DC2A16`).
  **Critically: the visual harness was recalibrated to a real terminal's ~0.5 cell aspect** — the first harness rendered
  cells ~square, which hid the vertical stretch and gave false confidence (the operator saw a stretched flame the harness
  didn't show). The flame was then operator-picked + tuned at the faithful aspect, verified in the operator's own terminal.
  Both renderers (`component/logo.tsx`, `cli/ui.ts`) + the goodbye update from the shared data.
- **New dev tool:** `packages/tui/script/render-logo.ts` — a visual harness that renders the logo + goodbye ANSI to an
  HTML preview (screenshot via headless Chrome), so terminal art can be reviewed without a live TTY. This is how the
  above were caught/fixed and how the flame option was chosen; xterm.js/asciinema/etc. are absent so ANSI→HTML→Chrome
  was the zero-dep path.
- **Tests:** `presentation.test.ts` gains a structural guard (ANSI-stripped epilogue must contain `logo.right`'s
  wordmark rows + no `^`/`~` from the old shading font). `logo.test.ts` green (invariants hold at 3 rows). Full-workspace
  typecheck 34/34; no other test asserts logo content. **Blockers:** operator merge (INV-005). AC-029 stays Met (this
  closes a residual + retunes, per operator visual sign-off).

## 2026-07-14 — PH-8 Phase 5b (WBS-8.5): web UI rebrand — visual assets — MERGED via PR #63 `19ad4279f3` (superseded #61)
- **Done:** the visual half of the web rebrand — the flame identity across every web brand surface (`packages/ui`).
  **`Mark` + `Splash`** (`packages/ui/src/components/logo.tsx`) rewritten from the OpenCode square-in-square glyph
  to the **Marid flame silhouette** (a teardrop matching the TUI `logo.ts` DNA), keeping the `--icon-*` fill vars +
  viewBoxes so theme coloring and all call-sites work unchanged (monochrome at those small UI glyphs, matching the
  surrounding icon color). **`favicon-v3.svg`** → a full-color gradient flame (edge `#FBD24A→#F5901E→#DC2A16`, core
  `#FDEFB0→#F8B73C`) on the `#131010` ground. **Raster set regenerated from that master SVG:** `favicon-96x96-v3.png`,
  `favicon-v3.ico` (16/32/48), `apple-touch-icon-v3.png` (180), `web-app-manifest-{192,512}.png` (maskable), and a
  1200×630 **`social-share.png`** OG card (flame + two-tone "Marid" wordmark + tagline). Committed the two SVG
  sources (`favicon-v3.svg`, `images/social-share.svg`) alongside the rasters.
- **Pipeline:** Chrome-headless render of the master SVG → PNG, then a **pure-JS box downscaler** (`node zlib`, no
  deps) for 180/192/96/ico — Windows has no ImageMagick (`convert` is the NTFS tool) and Chrome mis-sizes the
  180/192 headless windows, so downscaling the good 512 render was the reliable path.
- **Local-dev fix (folded in):** operator review found the running web broken locally — favicon + manifest served as
  path-text because `packages/app/public/*` are git symlinks that Windows (`core.symlinks=false`) checks out as text
  stubs. Added a `vite.js` plugin (`marid:resolve-public-symlinks`) that resolves any such stub to its real target —
  dev middleware (registered in the `configureServer` hook body so it beats vite's public serving) + a `writeBundle`
  copy for the build. Generic (no hardcoded list), no-op on POSIX. **Verified via chrome-devtools MCP** against the
  running stack (marid `serve` :4096 + vite :3000, opened with an admin `?auth_token=`): console clean (no 401, no
  manifest error), `/site.webmanifest` + `/favicon-*` return real Marid content, `/global/event` SSE connects, home
  renders branded. (The 401 was operational — the secured gateway needs a token; not a code defect.)
- **Verification:** every flame render **visually inspected** (favicon 96/512, apple-touch 180, social card, Mark +
  Splash silhouettes) — all correct. ui typecheck clean; ui tests 7/7; `bun lint` 0 errors.
- **Decisions:** **AC-030 → Met** (both halves: 5a no-fetch + 5b icons-read-Marid). **Deviations:** legacy non-`-v3`
  favicons + `social-share-{zen,black}.png` **left in place** — the plan assumed they were unreferenced, but they're
  still referenced by `packages/console` (EXCLUDED from the Marid build per CON-004), so deleting them is out of
  scope and would break an excluded package. Maskable PWA icons use the favicon's ~9% top padding — fine for
  rounded-square launchers, retunable if a full-circle mask clips the tip. Flame art is **blind-authored** →
  **operator visual sign-off is the merge gate**; geometry + gradients are data-only, trivially retunable.
  **Blockers:** operator merge (INV-005). **Next:** Phase 6 (docs/diagrams) → Phase 7 (release v0.3.0).
  `validate_package.py docs/` = OK.

## 2026-07-14 — PH-8 Phase 5a (WBS-8.5): web UI rebrand — code half — MERGED (PR #60 `67f56b8edd`)
- **Done:** the CI-verifiable code half of the web rebrand (`packages/app` + `packages/ui` only; `packages/desktop`
  EXCLUDED per CON-004). **Killed the 3 runtime `opencode.ai` fetches** (the mandatory AC-030 half): release-notes
  changelog → committed local `packages/app/public/changelog.json` (same parser shape, real Marid v0.2.0/v0.3.0
  entries — operator chose repoint-with-content over disable); OS-notification icon + hardcoded-project avatar →
  local `-v3` assets. **Web "OpenCode" strings → Marid:** desktop-menu app/docs/support, WSL install/update copy
  (+ its 4 test assertions/titles), `packages/ui` `favicon.tsx` apple-web-app-title, help-button aria + body copy.
  **Web GO-upsell removed at the root:** deleted `usage-exceeded-dialogs.tsx` + `dialog-usage-exceeded.tsx` and the
  `session.tsx` call site — the web has no inline retry-message surface (verified), so this also **closes the
  `retry.ts` `opencode.ai/workspace/.../go` residual** that 4a flagged. **Zen/Go de-marketed in render code**
  (connect-provider Zen block + opencode taglines, unpaid-model dialogs; provider IDs untouched) — mirrors 4a's
  delete-the-render-blocks approach, no 20-locale edit. **apiKey fields masked** (`type="password"`). **opencode.ai
  click-through links → `github.com/A-H-911/marid`** (docs/help/feedback/themes). Neutralized the residual `en.ts`
  brand string ("Free models provided by OpenCode" → "Free models").
- **TEST-WEB (AC-030 guard):** `packages/app/src/marid-no-remote.test.ts` static-source-scans `app/src` + `ui/src`
  `.ts/.tsx` for `opencode.ai` network references and fails on any outside the allowlist (i18n display strings, the
  dev-only hostname heuristic, comments). Runs in CI via turbo `@opencode-ai/app#test`. Verified **both directions**
  (green now; red on a re-added `fetch("opencode.ai")`, naming the file:line).
- **Verification:** app + ui typecheck clean; ui tests 7/7; app unit **577 pass** (1 fail = the pre-existing,
  `skipIf(CI)`-guarded i18n-parity drift from the WBS-8.1 sync — not ours, skipped in CI); `bun lint` 0 errors.
- **Decisions:** AC-030 → **Partial** (fetch/strings/upsell/links done; icons pending 5b). **Deviations:** one
  required typecheck fix — `titlebar.tsx` `ChannelIndicator`: an app-touching change forces a cache-miss rebuild
  that surfaces a latent `VITE_OPENCODE_CHANNEL?` undefined-unsafety (`env.d.ts` types it optional); fixed with a
  1-line undefined guard (behavior-preserving; mirrors 4a's required CI-only fix). No new `P-*` (P-2 branding row).
  **Blockers:** operator merge (INV-005). **Next:** Phase 5b (favicon SVG + `Mark`/`Splash` glyph + raster set via
  claude-design, operator visual review → AC-030 Met) → 6 docs → 7 release v0.3.0. `validate_package.py docs/` = OK.

## 2026-07-14 — PH-8 Phase 4b (WBS-8.4): §94 logo redesign + two-tone render gate + splash — unmerged, at the operator gate
- **Done:** completed the TUI rebrand's visual half. `logo.ts` is now the single source of the mark:
  a **taller 6-row flame** (`left`, keeps the PH-5 flame DNA) + a **`leftCore`** mask marking the inner cells
  that take a brighter core gradient, and the 6-row "MARID" wordmark (`right`, letters centered rows 2-4 so the
  three renderers zip row-for-row). Gradients are data: flame edge `#FBD24A→#F5901E→#DC2A16`, core
  `#FDEFB0→#F8B73C`. **Two-tone split wordmark:** columns `< WORDMARK_SPLIT` (16) render blue `#2F6BFF` ("MAR"),
  the rest orange `#F0731F` ("ID"). **Render gate:** `supportsTrueColor()` (`COLORTERM === truecolor|24bit`, the
  documented theme convention) gates the split — truecolor → blue/orange, else single-tone (`theme.text` in TUI /
  reset in CLI) crisp-mono fallback (AC-029). Both renderers rewritten to color per-cell from the shared data —
  `component/logo.tsx` (opentui `RGBA`) and `cli/ui.ts` `logo()` (raw ANSI, `hexToRgb` helper); the duplicated
  hardcoded non-TTY wordmark array is gone (generated from the glyph now). Splash badge (`cli/cmd/run/splash.ts`)
  → a compact 3-row Marid flame `badge` + its "OpenCode"/`opencode --mini -s` fixed; **`export const go` (and the
  dead `marks`) deleted** — zero importers after 4a's upsell removal + this splash rebrand.
- **Not colored (deliberate):** the `/exit` goodbye (`util/presentation.ts`) still renders the mark in its dim
  understated style — it adapts to the 6-row glyph automatically (`logo.right[i] ?? ""`), no code change.
- **Tests:** `logo.test.ts` (6) — `supportsTrueColor()` true/false, and the structural invariants that de-risk
  the 3-renderer coupling: left/right/leftCore equal height, `leftCore ⊆ left` filled cells, split within the
  letter rows. typecheck clean both packages; presentation green. The help-snapshot suite excludes the banner
  (moving target), so the glyph change is snapshot-safe.
- **Decisions:** **AC-029 → Met** (mechanical 4a + visual 4b). **Deviations:** the flame glyph art + exact split
  are **blind-authored** (headless — cannot screenshot a TUI in truecolor + 256-color); **operator visual
  sign-off is the merge gate** — glyph rows / gradients / split are data-only, trivially retunable on feedback.
  **Blockers:** operator visual review + merge (INV-005). **Next:** Phase 5 (web UI, separate PR) → 6 docs → 7
  release v0.3.0. `validate_package.py docs/` = OK.

## 2026-07-14 — PH-8 Phase 4a (WBS-8.4): TUI/CLI mechanical rebrand + GO-upsell removal — unmerged, at the operator gate
- **Done:** every user-facing "OpenCode" string in the shipped `marid` binary now reads Marid. A repo-wide
  re-enumeration (the earlier surface map was ~50% incomplete — it missed the whole `--mini` mode, `uninstall`,
  `error.ts`, the crash screen) found and fixed: **main TUI** — exit hint `opencode -s`→`marid -s`
  (`util/presentation.ts`), notification title + sound-pack display name (`attention.ts`), update toast +
  docs link → Marid repo (`app.tsx`), both sidebar footers "● Marid {version}"
  (`feature-plugins/sidebar/footer.tsx` + `routes/session/sidebar.tsx`), permission prose (`permission.tsx`),
  ~12 home-screen tips (**wrong-binary** `opencode run/serve/upgrade/…`→`marid …`, a real bug for marid users),
  model-error hints (`util/error.ts`), crash screen (`error-component.tsx` — "marid crashed", bug report →
  Marid repo); the **`--mini` run mode** — permission/prompt prose
  (`cli/cmd/run/{footer.permission,footer.prompt,permission.shared}`); and `cli/cmd/uninstall.ts`.
- **GO-upsell removed at the root:** deleted the TUI upsell subsystem (`component/{dialog-retry-action,bg-pulse,bg-pulse-render}`)
  and the rate-limit handler + consts in `routes/session/index.tsx`; **neutralized the server source**
  `session/retry.ts` (`GO_UPSELL_MESSAGE` "…subscribe to Go" → "Free usage limit reached") — the inline retry
  footer renders `retry.message`, so deleting the dialog alone left the upsell visible. Both providers
  **de-marketed** (`dialog-provider.tsx`: dropped OpenCode-Go from the recommended list + the "(Recommended)"
  tag + both Zen/Go marketing blocks) — provider **IDs kept functional**.
- **Kept (unchanged):** internal ids (`opencode.default` pack id, `opencode.status/debug` commands, `provider.id`
  "opencode"/"opencode-go", `opencode.json`/`.opencode/` filenames+dirs, `$schema` URLs), the GitHub `/opencode`
  trigger keyword, and the `retry.ts` `action` upsell copy (web-only now → PH-8 web phase). The **`go` glyph is
  retained** (splash badge still imports it; deleted in 4b).
- **Gating:** cosmetic → **unconditional** "Marid" (not `__MARID_APP`-gated), per PH-5 P-2. Under the existing
  **P-2** patch row (expanded in `architecture.md`), no new `P-*`.
- **Tests:** updated `presentation.test.ts`, `app-lifecycle.test.tsx`, `permission.shared.test.ts` to the new
  strings; `retry.test.ts` green unchanged (asserts the const symbol). **typecheck clean both packages.**
- **Decisions:** **AC-029 → Partial** (mechanical done; logo + render gate = 4b). **Deviations:** the approved
  plan's GO-removal covered only the TUI dialog; execution found the upsell is **server-sourced** (`retry.ts`)
  and also surfaces in the inline footer, so the root was neutralized too — within the explicit "remove the GO
  upsell" authorization, disclosed here. **Blockers:** operator merge (INV-005). **Next:** PR 4b — §94 logo
  redesign + two-tone render gate + splash rebrand + `go` deletion → AC-029 Met. `validate_package.py docs/` = OK.

## 2026-07-13 — PH-8 Phase 3 (WBS-8.3): agent identity → Marid (P-8) — unmerged, at the operator gate
- **Done:** the agent no longer calls itself OpenCode. New Marid-owned `session/marid-identity.ts`
  `maridizePrompt()` rewrites the **emitted** system prompt at the single choke point — `session/system.ts`
  `provider()` now delegates selection to `selectPrompt()` and maps the result through the transform (**P-8**,
  a 1-line upstream edit → registered as a realized `P-8` row in `architecture.md`). Scope (DEC-026): identity
  "You are OpenCode" → Marid; feedback repo `github.com/anomalyco/opencode` → the Marid repo; self-doc-fetch
  `opencode.ai/docs` → the Marid repo. **App-name-gated** (upstream `opencode` app byte-unchanged — same
  `__MARID_APP` lever as P-6/P-7). Rewriting at the choke point (not per-`.txt`) keeps the patch surface at one
  file and catches sync-added prompts automatically.
- **Tests:** `agent-identity.test.ts` (19) — identity/URL rebrand unit cases, `.opencode/` preserved (DEC-024),
  the opencode-app regression (verbatim), and the **CI guard**: every shipped `prompt/*.txt` (read from disk, so
  a future sync-added prompt is covered) emits no `\bopencode\b` after the transform. typecheck clean.
- **Decisions:** **AC-028 → Met.** **Deviations:** the wrap needed a 1-line upstream edit to `system.ts`, so it
  is a genuine `P-8` patch-surface row (not the "additive, no P-*" case ADR-0018 D6 allowed for). **Blockers:**
  operator merge (INV-005). **Next:** Phase 4 (TUI rebrand). `validate_package.py docs/` = OK.

## 2026-07-13 — PH-8 WBS-8.2 (part 2): config filename (P-7) + env-pierce disclosure (AC-026) — unmerged, at the operator gate
- **Done:** completed WBS-8.2. **P-7 config filename:** `marid.json`/`marid.jsonc` is now the primary config
  name at every level — global (`config/config.ts` `globalConfigFile()` candidates + the merge chain, marid
  loaded last so it wins), project + `.opencode/` (`mcp.ts` writer default), and managed (`config/config.ts`
  managed loop). An existing upstream-named `opencode.json(c)` still works everywhere (backward-compat fallback);
  the created default global config is now `marid.json`. Managed-config dir also isolated to `marid`
  (`managed.ts` — mac/win/linux). DEC-023 "no global `opencode` fallback" was already free from P-6 (the global
  dir moved to `~/.config/marid/`). **AC-026 env-pierce disclosure:** new `src/marid-pierce.ts` `disclosePierce()`
  (boot, from `marid.ts`) warns when `OPENCODE_CONFIG_DIR`/`OPENCODE_CONFIG`/`OPENCODE_CONFIG_CONTENT`/
  `OPENCODE_AUTH_CONTENT`/`OPENCODE_DB` pierce isolation — names the var + what it redirects, keeps it honored
  (disclosure not enforcement), INV-002 never prints the value.
- **Tests:** `config-pierce.test.ts` (4 — naming, no-op, empty-string, INV-002 no-secret-leak); config suite
  regression test flipped to the `marid.json` created-default; opencode typecheck clean.
- **Decisions:** **AC-025 → Met** (the 3-OS `marid-build` binary isolation smoke went green in PR #55) +
  **AC-026 → Met**; WBS-8.2 complete. **Deviations:** P-7 filename additions are additive list-extensions to the
  well-tested config discovery (the one config test encoding the old default was updated). **Blockers:** operator
  merge (INV-005). **Next:** Phase 3 (agent identity). `validate_package.py docs/` = OK.

## 2026-07-13 — PH-8 WBS-8.2 (part 1): total DATA isolation (P-6) + one-time migration + no-update-popup — unmerged, at the operator gate
- **Done:** delivered the **isolation core** of WBS-8.2. **P-6 app-name seam:** `global.ts:10` →
  `const app = process.env.__MARID_APP ?? "opencode"` — the single seam every machine-global dir derives from
  (DB `opencode.db`, `auth.json`, `model.json`, `mcp-auth.json`, global config all route through `Global.Path`),
  so one line isolates them all. Baked into the binary via a `marid-build.ts` define
  (`"process.env.__MARID_APP": JSON.stringify("marid")`, dot-notation rewrite); dev sets it at runtime via a new
  first-position side-effect import `src/marid-env.ts` (bracket notation `process.env["__MARID_APP"] ??= "marid"`
  survives the define). **Migration (DEC-025 / AC-031):** new `src/marid-migrate.ts` — marker-triggered one-time
  copy of the pre-isolation OpenCode `data`+`state` (auth/tokens/DB/model) into the marid dirs, skips regenerable
  `repos`/`log`, INV-002 count-only logging; run early in `marid.ts` before command dispatch. **No update popup
  (AC-027):** `marid-env.ts` also sets `OPENCODE_DISABLE_AUTOUPDATE=1` (guard `cli/upgrade.ts:10`). **Coordinated
  seam:** `marid-instance/paths.ts:51` `opencode`→`marid` (the instance nests `marid` now) + test flips.
- **Tests:** new `data-isolation.test.ts` (5, subprocess-driven — the app-name is read once at module load):
  seam nests `marid`, unset→`opencode` regression, migration copy/skip/idempotency/fresh-machine, INV-002.
  Live `instance-isolation.test.ts` green (marid via `src/marid.ts`, no `~/.local/share/opencode` leak). Added a
  **3-OS `marid-build` isolation smoke** (spawns the compiled binary under a throwaway XDG root, asserts data lands
  under `marid`) — the ONLY check of the binary's baked-define branch. marid-instance 42, contract 38, opencode
  typecheck clean.
- **Decisions/Deviations:** **scope split** — this PR is WBS-8.2 **part 1** (P-6 + migration + autoupdate). Part 2
  (P-7 `marid.json` config filename + AC-026 env-pierce WARN + `managed.ts` Windows `ProgramData`) is a follow-up;
  DEC-023 "no global `opencode` fallback" already falls out of P-6 for free (the global config dir *moves* to
  `~/.config/marid/`). **AC-025 Partial** until the binary smoke goes green in CI (dev-proven now); **AC-027 +
  AC-031 Met**. **Blockers:** operator merge (INV-005). **Next:** on merge → WBS-8.2 part 2, then Phase 3 identity.
  `validate_package.py docs/` = OK.

## 2026-07-13 — PH-8 WBS-8.1: upstream sync merged + ADR-0018/DEC-027 Approved — at the operator merge gate
- **Done:** ran **WBS-8.1 (upstream sync)**, the first PH-8 code phase. Merged `upstream/dev f47684787a` into
  develop as a **merge commit** (`f3e48a6c93`, keeps upstream ancestry — cf PR #31): **79 commits / 242 files**.
  The **only** conflicts were **6 i18n files** (`packages/app/src/i18n/{ar,br,de,fr,ja,pl}.ts`) — Marid's
  `"app.name.desktop": "Marid Desktop"` vs upstream's translation refresh — resolved **Marid-wins** (all 17 langs
  keep "Marid Desktop", zero "OpenCode Desktop"); no workflow leakage, P-2 branding sites intact, `bun.lock`
  auto-merge correct. Fixed the one inherited typecheck blocker: upstream's generated SDK v2 type
  (`sdk/js/src/v2/gen/types.gen.ts`) lagged its own `ProviderReasoningOption` schema
  (`provider.ts:987 Schema.Array(Schema.NullOr(Schema.String))`) — widened the effort `values: Array<string>` →
  `Array<string | null>` (type-only, behavior-neutral; **P-CI-5**). Verified: root `bun turbo typecheck`
  **34/34 packages**, **TEST-CONTRACT** (`test/marid/contract.test.ts`) **38 pass**, **marid-gateway** suite
  **124 pass**. Flipped **ADR-0018 + DEC-027 → Approved** (operator gate ruling) folded into this same PR.
- **Decisions:** **ADR-0018 + DEC-022..027 all Approved** at the PH-8 Phase-0 operator gate (2026-07-13);
  DEC-027 = **KEEP `opencode.db`** (no rename). **Corrected sync numbers:** real delta is **79 commits / 242
  files** to upstream tip `f47684787a`, not the plan's 167/458 — the plan measured from the immutable baseline
  tag, but PR #31 already advanced develop's merge-base to `14a5529793`.
- **Deviations:** used the hand-widen of the generated type (the operator's stated *fallback*) instead of a
  full `./script/generate.ts` regen — regen needs `bun dev generate` (server boot → Windows native-toolchain
  risk) for a larger diff, while the 1-line widen is type-only, matches the schema truth, and is CI-safe (no CI
  job regenerates or freshness-checks the SDK). Registered as **P-CI-5** in `upstream-sync-strategy.md` so a
  future sync that reverts it re-applies the one-line widen. **Blockers:** **operator merge of this sync PR**
  (INV-005 — merge-commit into develop, never squash). **Next:** on merge → **WBS-8.2** data isolation
  (build-time `__MARID_APP` app-name P-6 + config `marid.json`/project-fallback P-7 + one-time-copy migration).
  `validate_package.py docs/` = OK.

## 2026-07-13 — PH-8 opened: Keystone scoping + ADR-0018 (docs-only) — unmerged, at the operator gate
- **Done:** opened **PH-8 "Isolation & deep rebrand"** (total DATA isolation from a co-installed OpenCode + deep
  rebrand + upstream-sync-first), the post-`v0.2.0` mission from the twice-reviewed plan. Docs-only scoping: authored
  **[ADR-0018](../adrs/adr-0018-data-isolation-deep-rebrand.md)** (Proposed) — data-dir isolation via a build-time
  `__MARID_APP` app-name (P-6), KEEP `OPENCODE_*` env + pierce disclosure (DEC-022), config `marid.json` + project
  `opencode.json` fallback / no global fallback (DEC-023, P-7), `.opencode/` kept upstream-named (DEC-024), one-time-copy
  migration (DEC-025), full agent-identity transform (DEC-026, P-8), no DB rename (DEC-027, Proposed), `autoupdate:false`,
  two-tone wordmark + web scope (P-2 expansion). Opened **MS-009** + **AC-025..031** (one per reported v0.2.0 issue,
  issue→AC→test table in the ADR) + **WBS-8.0..8.7** (mirror plan Phase 0..7). Recorded **DEC-022..027** (022..026
  Approved as operator-locked plan §2 inputs, 027 Proposed). Amended `branding.md` "Rebrand boundary" (pointer) +
  pre-registered P-6/P-7/P-8 + P-2 expansion in `architecture.md`.
- **Decisions:** DEC-022..026 are Approved operator inputs (plan §2, 2026-07-13); ADR-0018 (the realization) stays
  **Proposed** until the Phase-0 operator gate — no code phase starts until it is Approved (INV-005). DEC-027 (no DB
  rename) Proposed. **Deviations:** none. **Blockers:** **operator approval of ADR-0018 + merge of this docs PR** — the
  Phase-0 gate; PH-8 Phase 1 (upstream sync) does not start until then. **Next:** on approval → WBS-8.1 upstream sync
  (`upstream/dev cf7503687a`, 167 commits / 458 files). `validate_package.py docs/` = OK.

## 2026-07-12 — PR #48 merged (squash `4409d92f`) → **MS-007 MET**; PH-6 (Telegram-first) complete
- **Done:** the operator merged the PH-6 stack into `develop` (squash `4409d92f`, all 20 CI checks green) — WBS-6.6
  live test tiers (AC-017/019/020/021/024 all Met), the INV-001 firehose isolation fix (ADR-0016/0017), and the
  WBS-6.7 docs + `20-gateway-mirroring` diagram + `docs/usage.md` user guide. This **exits MS-007**: PH-6 is
  complete. Trackers flipped in this change (status-report / acceptance-audit evidence / work-breakdown 6.1–6.7 /
  milestones MS-007 / roadmap / keystone-state) from the pre-merge "unmerged, exit gated on operator merge"
  language to **Met / merged**.
- **Decisions:** none new — realizes the already-accepted MS-007 exit (INV-005 operator merge). **Deviations:** the
  flip also drops the residual "unmerged (INV-003/005)" tails on WBS-6.1–6.5 (they landed on develop via earlier
  PRs #44/#46/#47, not #48) — a MET milestone cannot coexist with work items asserting "unmerged". **Blockers:**
  none. **Next:** PH-7 (WhatsApp) is operator-gated and not started; optional `develop → main` sync PR to cut a
  release. `validate_package.py docs/` = OK.

## 2026-07-12 — WBS-6.7 PH-6 docs + diagrams close (MS-007 exit pending operator merge) — unmerged, gated
- **Done:** documented the PH-6 channel platform. `architecture/api-event-contract.md` → **v1.2**: the four Marid
  gateway routes (`/marid/attach`·`detach`·`bindings` admin, `/marid/self-bindings` non-admin), binding-aware
  **`owns ∪ bound`** visibility on `/event`+`/global/event` (mirroring; view-via-binding, act-via-ownership), the
  route-not-header SSE isolation fix (ADR-0016/0017), and the two behaviours on already-committed routes — channel
  **tool calling** (sync `/session/{id}/message` detached) + **outbound multipart files**. **No new replay path**
  (re-fetch, not seq/id — consistent with the v1.1 correction). `architecture/architecture.md` → **v1.1**: new
  *Marid Gateway & cross-surface mirroring* section (gateway, `@marid/channel-client`, mirroring; **zero new P-\***),
  and the stale seq-replay line in the §7 sequence corrected to re-fetch. New Tarseem diagram
  **20-gateway-mirroring** (spec + PNG/SVG + README row). Stale `ci.yml` comment ("pump has no reconnect")
  corrected — the firehose pump reconnects (channel-client, WBS-6.5). Stale "PH-4 next" pointers in
  CLAUDE.md/AGENTS.md corrected to PH-6.
- **Pinned:** `/marid/self-bindings` now asserted in the merged-`/doc` contract test
  (`marid-auth/test/gateway.test.ts`, 10 pass) so the newly-documented route is contract-backed.
- **Decisions:** documented shipped reality over the stale WBS DoD ("fan-out seq→id" was superseded by re-fetch at
  WBS-6.5). Root docs (README/CODEMAPS) flagged to operator, not expanded (checkpoint stop). **Deviations:** none.
  **Blockers:** none. **Next:** operator merge of the PH-6 stack → MS-007 exit (INV-005). `validate_package.py docs/` = OK.

## 2026-07-12 — Telegram tool calling + MCP + file sending; AC-017 Met — unmerged, gated
- **Done:** the Telegram bot now has full TUI/Web tool parity (built-in + MCP), gated by the channel agent's
  allow/ask/deny ruleset, plus outbound file sending. **Root cause found + fixed:** the gateway drove turns via
  `sdk.session.promptAsync`, whose opencode handler forks the turn off its request (`Effect.forkIn`) and returns
  immediately — the forked turn outlives the request-scoped tool/agent/MCP context and resolved a **ZERO
  toolset**, so the bot could never use tools (this was the long-standing "served run has no tools" observation;
  isolated deterministically by `scripts`→`test/marid/step0-tools-probe.test.ts`: channel+sync = full toolset,
  channel+promptAsync = 0). **Fix (`marid-telegram/src/gateway.ts` onMessage, additive, no upstream edit):** drive
  the sync `session.prompt` route **detached** — the SDK drains the response stream in the background so the
  request stays alive for the whole turn (tools resolve) while the poll loop is never blocked; the reply renders
  via the SSE firehose as before. **File sending:** assistant/tool `data:` file parts are decoded + uploaded as
  **multipart bytes** (`bot-api` `sendPhotoBytes`/`sendDocumentBytes` + `media.resolveOutboundBytes` + `onFile`).
  **Config recipe:** `docs/execution/telegram-channel-tools.md` — default `{"*":"ask", read/glob/grep/list:"allow",
  task:"deny"}` (task denied to close a subagent-escalation hole: subagents inherit only parent *deny* rules).
- **Proof — deterministic + LIVE:** `telegram.test.ts` drives a real bash tool call through the real gateway and
  asserts the Approve/Deny inline keyboard reaches the operator (3 pass); `gateway-integration` multipart outbound
  file; `bot-api`/`media` units; marid-telegram **99 green**, typecheck 0, lint clean. **LIVE** (`scripts/tg-tool-e2e.ts`,
  real GLM over real MTProto): a live text turn round-trips (sync-route regression is live-safe) **and** a real
  model bash call surfaces `[✅ Approve \| 🚫 Deny]` in Telegram → Approve tapped → tool runs → turn completes.
- **AC-017 → Met (2026-07-12, operator-accepted, INV-005):** the two prior "live-impossible" parts (inline keyboard
  + outbound file) are resolved. All MS-007 acceptance criteria (AC-017/019/020/021/024) now Met.
- **Decisions:** permissions come from the **agent config**, not the channel (verified — channel scope does NOT
  strip tools); the fix is **Marid-side** (route switch), not an upstream `promptAsync` patch. **Deviations:** none.
  **Blockers:** none. **Next for MS-007 exit:** WBS-6.7 docs + operator merge (INV-005). Native-mobile EXP-010 deferred.

## 2026-07-12 — AC-021 TEST-TG-UI (Telegram-Web render tier) Met — unmerged, gated
- **Done:** built the AC-021 Telegram-Web-Playwright render tier and closed it live vs **production**
  web.telegram.org. `scripts/tg-web-e2e.ts` (Bun) boots a real `marid serve` + a channel token + `runGateway`
  driven by an **inline fake LLM** emitting fixed markdown (bold/inline-code/fenced, per-run nonce) through the
  **real** `telegramify-markdown` formatter + **real** Bot API; `scripts/tg-web-driver.mjs` (Node) drives a
  logged-in Telegram Web account and asserts the **rendered DOM**: `<strong>` + `<code>` + `<pre>` + **no literal
  `**…**`** (the direct guard on the ADR-0008 defect-1 regression) + `<img>` media (`bot.sendPhoto` public URL).
  **4/4 stable runs.** One-time headed login (`scripts/tg-web-login.mjs`, QR) persists `.pw-telegram/`; operator
  id captured via a getUpdates probe. **[EXP-009](../experiments/exp-009-report.md) PASS** → **AC-021 Met**.
  Playwright + chromium added as an opencode devDep (bun.lock: single clean add). typecheck 0, lint clean, INV-002
  clean (no token/session/key printed). Zero upstream edit, no `P-*` (three additive scripts).
- **Decisions (operator-confirmed 2026-07-12, INV-005 — evidence notes, not ADRs):** run on **production** Telegram
  not the test-DC/`?test=1` (as [EXP-007](../experiments/exp-007-report.md) already superseded the test-DC premise);
  **dedicated Playwright userDataDir + one-time headed login** (Telegram Web keeps its session in IndexedDB, which
  `storageState` does NOT capture → `launchPersistentContext`); **native-mobile EXP-010 deferred** (no Android
  tooling here; ADR-0013 keeps it manual/never-a-gate, not in the MS-007 exit).
- **Deviations:** Playwright's browser launch **hangs under Bun** → the browser half is a **Node** child (the
  `@marid/*` half stays Bun), coordinated over a spawned-process JSON handshake. The meaningful **outbound-file
  `onFile`** render is NOT exercised (zero-tools served run + instance-local URL Telegram can't fetch,
  `gateway.ts:111`) — the media assertion uses the Bot API public-URL path; `onFile` stays deferred future work.
  TEST-TG-UI runs **local pre-PR** only (like the userbot/model live tiers) — **not** wired into `ci.yml`; GitHub
  on-demand deferred (ephemeral runner lacks the logged-in IndexedDB profile).
- **Blockers:** none for AC-021. **Next (gate → operator, INV-005):** MS-007's exit lists AC-017 green but **AC-017
  stays Partial** — render fidelity is now proven by AC-021, but inline-kbd/outbound-file parts remain
  live-impossible (zero-tools ceiling; faked-SDK `gateway-integration` tier). The open decision is whether that
  faked-SDK tier suffices to accept AC-017 Partial → then MS-007. Also: operator merge of the PH-6 stack.

## 2026-07-11 — WBS-6.6 test tiers + live E2E; INV-001 firehose leak found & fixed (ADR-0016/0017) — unmerged, gated
- **Done:** WBS-6.6 agent-ownable + live tiers. **Deterministic:** SSE-drop E2E (drives the 6.5 reconnect+refetch
  through the real `@marid/channel-client` vs a live `marid serve`); outbound-file feature (WBS-6.2 residual DoD
  gap — `onFile` in channel-client + gateway); inbound-file E2E. **Live (operator-run, creds in git-ignored `.env`):**
  `scripts/tg-userbot-e2e.ts` — real GramJS userbot ↔ REAL gateway slash round-trip (`/help`, deny-by-default
  refusal, `/new`) → **AC-020 Met**; DEP-014 (GramJS-on-Bun) resolved. `scripts/tg-model-e2e.ts` — real GLM
  (OpenRouter) over the real gateway + real MTProto: text round-trip (AC-017 evidence) + **bidirectional mirror +
  unattached-invisible + attach re-subscribe → AC-019 Met**.
- **🔒 Security (INV-001):** the live model tier surfaced a **realized firehose isolation leak** — `/event`+
  `/global/event` served UNFILTERED to any non-admin token (channel AND client scope) because the SDK's SSE client
  omits `Accept: text/event-stream` and marid-auth gated the owns∪bound filter on that header (`isStream`).
  Defeated AC-004/019/024 isolation on the live path; the unit suite missed it (function/header-ful frames only).
  [EXP-015](../experiments/exp-015-report.md) REFUTED HYP-015; [RISK-025](../risks/risk-register.md). **Fixed:**
  [ADR-0016](../adrs/adr-0016-sse-isolation-route-not-header.md) — `isStream` recognises firehose routes by
  **pathname** (header-independent). That exposed a companion defect (own-session visibility had depended on the
  leak): [ADR-0017](../adrs/adr-0017-firehose-own-session-lazy-visibility.md) — the filter resolves a token's own
  mid-stream sessions **lazily** (first-sight, positive-cache only). Both proven deterministically (real-request
  regression test + isolation repro + `telegram.test.ts` + the live re-run); marid-auth **123** green. Zero
  upstream edit, no `P-*`.
- **Decisions:** ADR-0016 + ADR-0017 Approved; Option B (server lazy re-read) chosen over channel-client
  re-subscribe (advisor-evaluated — A insufficient for web/TUI on the same client scope + a multi-session teardown
  defect). **Deviations:** `own-session-visibility-repro.ts` confirms the CAUSE only, not the fix (a channel can't
  emit a post-ownership frame model-free). **Blockers:** none for the delivered tiers. **Next (WBS-6.6 residual):**
  AC-021 TEST-TG-UI (EXP-009 Telegram-Web/Playwright — NOT yet built) + native-mobile manual → then MS-007.

## 2026-07-11 — WBS-6.5 SSE reconnect + re-fetch recovery DONE (unmerged, gated)
- **Done:** all recovery in **`@marid/channel-client`** (shared → PH-7 inherits) + one non-admin route in
  marid-auth; additive, **zero upstream edit, no `P-*`**. **(a) reconnect** — the firehose pump reconnects on
  drop with capped exponential backoff (500ms–30s), first subscribe retried (server-not-up recoverable); a
  per-connection controller ends the pump on shutdown OR a deliberate re-subscribe (pump races `next()` against
  the abort → never hangs on a stream that ignores the signal); `done` resolves ONLY on shutdown. **(b) re-fetch
  recovery** — on reconnect the OWNED tracked sessions re-read the durable store (`session.messages`, no limit →
  full history) and flush the latest assistant text **edit-in-place** (same `part.id` → same message; identical
  text skipped). `part.id`-keyed = exactly what Marid's live `message.part.updated` renders on (v2/next
  `session.next.text.*` not built) → a turn finished during the gap renders **once, no duplicate**. **BOUND
  (non-owned) sessions are NEVER re-fetched** — `session.messages` is owns-gated (403, INV-001/EXP-008) → resume
  live only, gap frames lost (documented; gate **not** widened). **(c) attach-triggered mid-stream reconnect
  (cross-process)** — admin `/marid/bindings` is off-limits to a channel token, so a new **non-admin
  `GET /marid/self-bindings`** returns the AUTHENTICATED token's own bound sessions (keyed on the token, not a
  `?token=` param → spoof-proof; INV-001-safe — leaks nothing the owns∪bound firehose already grants; WRITE stays
  admin-only). The channel-client polls it (default 45s; an intentional re-subscribe skips backoff+refetch → the
  attach mirrors instantly) and re-subscribes on any set change (attach OR detach) → server re-applies owns∪bound
  fresh. channel-client **11→16**, marid-auth **119→121**, marid-telegram **90→91** green; typecheck+lint clean.
- **Decisions:** operator chose (b) = flush-latest edit-in-place (not full-history replay); (c) in-scope this WBS
  (self-bindings poll route). Verified at source (META-LESSON): Marid live text is `message.part.updated`
  (`part.id`-keyed) — v2/next delta family not built — so recovery aligns with the live render.
- **Deviations:** **advisor-caught & fixed** — (1) a poll-abort *mid-subscribe* now retries instead of exiting
  (else the reconnect loop died and mirroring stopped); (2) the gateway injects a non-abort-aware `sleep`, so the
  internal sleep ALWAYS races shutdown (else `done` hangs up to `bindingPollMs` on SIGINT) — biting test added.
- **Blockers:** none. **AC verdicts unchanged** — AC-019 Partial / AC-024 Met (6.5 traces FR-036/043 + RISK-006,
  not an AC flip; the live real-account E2E that flips AC-019 → Met is WBS-6.6). **Also fixed a pre-existing
  G-IDS validator failure** (operator-directed): PR #42 had reverted `acceptance-audit.md`'s ID column from the
  WBS-5.5 reference form `[AC-NNN](acceptance-criteria.md)` back to bare `AC-NNN`, so both audit and criteria
  strong-defined every AC (24 duplicates) — restored the reference-link form (criteria.md is again the sole
  definer). `validate_package.py docs/` = **RESULT: OK**. On `feat/ph6-reconnect`, unmerged (INV-003/005).
  **Next:** WBS-6.6 (live 4-tier E2E) / 6.7 (docs), or an operator merge.

## 2026-07-11 — WBS-6.1 slice b parts 2/3 + owed: mirroring mechanism live (AC-024 Met; AC-019 Partial, blockers cleared) (unmerged, gated)
- **Done:** **Part 2 (the linchpin)** — the binding-aware `isVisible = owns ∪ bound` filter (WBS-6.3) now also
  narrows the **routing-wrapped `/global/event`** firehose, not just `/event`. web + TUI + channel all subscribe
  `/global/event`, so this ONE change **(a)** closes the pre-existing **INV-001 gap** (`/global/event` was
  UNFILTERED for every non-admin token — broader than "just Telegram") and **(b)** delivers mirroring (bound
  sessions reach the channel). `filterSseStream` gains a pluggable session-extractor; `/event` byte-unchanged.
  **Part 3** — the channel-client lazily creates a streamer for any untracked session (post-filter = an
  operator-bound, non-owned one), not only on `beginTurn`; the Telegram gateway renders bound sessions into the
  single operator's `defaultChatId` (CLI derives it from a single-operator allowlist; no chat → no-op sink).
  **Owed** — a live `/doc` merge assertion in the `marid-sync` job (real gzip→strip→merge). marid-auth
  **109→119**, channel-client **10→11**, marid-telegram **89→90**, all green; typecheck+lint clean; **zero
  upstream edit, no `P-*`**. On `feat/ph6-gateway`, unmerged (INV-003/005).
- **Decisions:** kept the channel on `/global/event` and fine-filtered it (the old "switch channel to `/event`"
  idea is DROPPED); `SyncEvent.*` is **not** a blanket-pass (see the security correction below).
- **Deviations / SECURITY CORRECTION to the slice-b plan:** the plan listed `SyncEvent.*` among the "no-`sessionID`
  families that pass." Grepping the sync publish path (`event-v2-bridge.ts`) showed `/global/event` carries a
  durable **sync TWIN** of every session event — `payload.syncEvent.{aggregateID, data}` with the SAME data as the
  regular frame. Every session-durable event uses `durable.aggregate: "sessionID"`, so `aggregateID` IS the
  owning session (`ses`-prefixed). A picker reading only `payload.properties.sessionID` would have treated every
  sync twin as session-less → **PASS**, leaking the durable copy of a non-owned session's content. `owningSessionGlobal`
  reads BOTH shapes; `global-event-filter.test.ts` pins the drop. This corrected the plan file, not an
  operator-gated register. **Blockers:** operator gate (push/PR/merge — INV-005). Attach-triggered mid-stream
  reconnect = WBS-6.5 (hook noted, not built). **Next:** operator review of `feat/ph6-gateway` (6 + 3 commits);
  then WBS-6.5/6.6 or a merge.

## 2026-07-11 — WBS-6.1 slice b part 1: admin-gated attach endpoint + /doc OpenAPI merge (unmerged, gated)
- **Done:** the **operator-reachable attach surface** (ADR-0012), served entirely by the marid-auth wrapper
  (never reaches upstream): `POST /marid/attach`, `POST /marid/detach`, `GET /marid/bindings`, writing the
  durable `BindingStore` (WBS-6.3). **Admin-scope ONLY** — a `channel:` token self-attaching is the INV-001
  self-attach landmine, so attach is an admin-surface action (401 unauth, 403 non-admin, 400 bad body).
  **OpenAPI-documented (AC-024) additively per EXP-014:** marid-auth intercepts `GET /doc`, strips
  `accept-encoding` (the >1KB spec is gzipped → opaque to the merge, like the list routes), and merges a
  hand-authored Marid fragment (inline schemas → no component collision; **no effect dep** — marid-auth stays
  dependency-free). Health-covered by existing `/global/health`. New `gateway.ts` + shared `http.ts`
  (`errorResponse` extracted from middleware + `jsonResponse`); middleware gains a `/marid/*` short-circuit
  (before ownership/authorize) + the `/doc` augment. **Zero upstream edit, no `P-*`.** marid-auth **101→109**
  (8 new gateway/TEST-CONTRACT tests), typecheck+lint clean, `index.ts` public API unchanged (consumer
  unaffected). On `feat/ph6-gateway`, unmerged (INV-003/005).
- **Decisions:** hand-authored static OpenAPI fragment (not `OpenApi.fromApi` at runtime) — keeps marid-auth
  dependency-free; EXP-014 already de-risked the merge mechanics, and TEST-CONTRACT pins the fragment against
  the served handlers. Attach body = `{token, session}` (channel-token NAME + session id).
- **Deviations:** none. **Blockers:** operator gate (push/PR/merge). AC-024 endpoints delivered; formal AC-024
  verdict flip held until the full slice b lands (with the blast-radius/degradation coverage). **Next:** 6.1b
  part 2 (fine-filter `/global/event` → INV-001 + mirroring, AC-019) then part 3 (channel-client consumes
  bound sessions).

## 2026-07-11 — EXP-014 PASS: attach-endpoint OpenAPI is additive (no P-*); WBS-6.1 slice b scoped
- **Done:** **EXP-014 (HYP-014) — PASS.** De-risked the AC-024 endpoint-location `P-*` question for WBS-6.1
  slice b. `/doc` is served from `OpenApi.fromApi(PublicApi)` (`server httpapi/server.ts:188`), wired in
  **upstream** files — so composing a group into `PublicApi` would edit `api.ts` (= a `P-*`). The **additive
  path** proven by a 3/3 spike: `marid-auth` intercepts `GET /doc`, calls `next`, and **merges a Marid-owned
  `OpenApi.fromApi` fragment** (a standalone `HttpApiGroup` for `POST /marid/attach`) into the upstream spec —
  no path/schema collision (Marid identifiers prefixed), serializable, **zero upstream edit → NO `P-*`**. The
  endpoint is *served* by the wrapper (manual handler before `next`, like existing marid routes); the group
  exists only to generate the fragment + drive TEST-CONTRACT. Report: `experiments/exp-014-report.md`;
  registers HYP-014/EXP-014 added. **Slice b scope** locked (see work-breakdown WBS-6.1 row + the slice-b plan).
- **Decisions:** attach endpoint lives in the `marid-auth` wrapper (serve) + `/doc`-merge (document), **not** an
  upstream HttpApi group — so slice b needs **no operator `P-*` gate**. Health-covered = existing
  `/global/health` (process/surface health, not per-route). The rejected compose-into-`PublicApi` path is
  characterized in the report for the record.
- **Deviations:** none. **Blockers:** none for slice b's endpoint (P-* cleared); the `/global/event` boundary
  fix still needs the wrapped-frame `sessionID`-extraction verification before it's assumed cheap. **Next:**
  build slice b acceptance-criteria-first (attach endpoint + `/doc`-merge + TEST-CONTRACT → then `/event`
  switch + bound-consume → then close the `/global/event` INV-001 gap).

## 2026-07-11 — WBS-6.1 slice a `@marid/channel-client` extracted (slice; unmerged, gated)
- **Done:** **First slice of WBS-6.1 (ADR-0011): a new additive package `@marid/channel-client`** holding the
  channel-agnostic half of the Telegram gateway — firehose subscribe/pump, cross-generation event interpretation
  (`TEXT/DONE/ASK` families + `parseAskEvent`), and per-part streamer coordination. `marid-telegram/gateway.ts`
  now consumes it (`createChannelClient` + `beginTurn` + `start()`), keeping only Telegram specifics (chat↔session
  binding, the Telegram rendering sink, inline-keyboard permission surfacing); `parseAskEvent` re-exported so the
  committed public API is unchanged. gateway.ts nets **−87 lines**. New package: 10 tests (parseAskEvent + pump
  coordination), typecheck+lint clean. **Behavior-preserving (RISK-017):** subscription stays on `global.event`,
  no server/auth path touched — **marid-auth 101 / marid-telegram 89 both unchanged & green** (TEST-AUTH/TEST-SEC/
  channel-binding intact). Additive envelope intact (NFR-001): new package + one Marid-owned CI step; **zero
  upstream edit, no P-\***. On `feat/ph6-gateway`, unmerged (INV-003/005).
- **Decisions:** slice WBS-6.1 into **6.1a** (this — the safe channel-client extraction) and **6.1b** (the
  decision-gated AC-019/AC-024 trio), advisor-confirmed. Reconnect/backoff/SSE-resume deliberately **not** built
  (WBS-6.5 owns it); the pump *structure* is extracted so recovery slots in later (YAGNI).
- **Findings (for 6.1b, not fixed here):** (1) **INV-001 boundary gap** — `middleware.ts` filters only
  `url.pathname === "/event"`, so `/global/event` hands the *unfiltered* firehose to any channel token that
  requests it (Telegram currently suppresses non-owned frames client-side via `if (!state) return`, so nothing is
  *surfaced*, but the data reaches the process). The real fix is at the boundary (filter `/global/event`), and it
  is **not** a one-liner: `/global/event` frames are `{payload:{…}}`-wrapped, so `filterSseStream`/`pickSessionId`
  likely won't extract `sessionID` from the wrapped shape — verify before assuming cheap. (2) **Mirroring can't
  reach Telegram** until the channel-client subscribes via the filtered `/event` (or `isVisible` is extended to
  `/global/event`) **and** consumes operator-attached bound sessions — both are 6.1b. (3) **AC-024 P-\* question:**
  the attach endpoint's OpenAPI/health/contract coverage may force an upstream `api.ts` edit (a `P-*`) unless a
  group composes additively into `PublicApi` from a Marid-owned file — **verify additivity first; if it forces an
  upstream edit, STOP for operator approval** (patch-surface + INV-005). De-risk with an EXP.
- **Deviations:** none. **Blockers:** operator gate — push/PR/merge are operator-only (INV-005); 6.1b scope
  (fold the `/event` switch + bound-consume + attach endpoint, or split further / EXP the additive-group path)
  is an operator decision. **Next:** operator reviews/merges 6.1a; then scope 6.1b (the two verifications above
  gate any subscription switch or boundary fix).

## 2026-07-10 — WBS-6.4 cross-surface permission + concurrency (verification; unmerged, gated)
- **Done:** **WBS-6.4 — cross-surface permission surfacing + concurrency, verified.** Code-light by design (the DoD is
  "tests green"; the properties already hold — this WBS proves them). (1) **first-responder-wins / no-double-approve** is a
  server invariant: `Permission.reply` (`packages/opencode/src/permission/index.ts:110-114`) does get-check-`pending.delete`
  with **no `yield*` between the get and the delete**, so on one instance it is atomic (Effect fibers can't interleave at a
  non-suspension point) — the first reply consumes the permission, a second reply from any other surface fails
  `NotFoundError`. New `permission/next.test.ts` test (+ the pre-existing "reply - fails for unknown requestID") pins it.
  (2) **view-via-binding of the ask** — a `permission.asked` frame on a bound session mirrors to the attached surface (new
  `mirroring.test.ts` test), so a bound surface's inline keyboard can render. (3) **act-via-ownership** — a bound-but-not-
  owner surface is DENIED replying/prompting: already proven in `mirroring.test.ts` (WBS-6.3). (4) **Concurrency (FR-040/041)**
  — the one-Runner join/steer is **EXP-001 (PASS)**; a channel can only *act* on sessions it owns, so cross-surface acting is
  same-owner multi-connection, covered by EXP-001 — not rebuilt. marid-auth **100→101 green**, opencode permission
  **79→80 green**, typecheck clean, **zero upstream edit**.
- **Decisions:** **The admin-gated `/attach` HTTP endpoint moved to WBS-6.1** (AC-024 constraint, advisor-caught): OpenAPI
  derives from the Effect HttpApi (`OpenApi.fromApi(PublicApi)`, `server.ts:68`), so a marid-auth-wrapper-intercepted route
  gets **no** OpenAPI/health/contract coverage AC-024 requires — the endpoint belongs inside the HttpApi hook (6.1). Bindings
  written in-test via `BindingStore` directly (same altitude as `mirroring.test`). **Reconciliation** (state now, don't
  surprise 6.1): a `channel:` token can't call an admin-gated attach (INV-001 self-attach landmine), so ADR-0012's "operator
  explicitly attaches" is an **admin-surface** action (TUI/CLI/web), not a Telegram `/attach` typed by the channel token.
- **Deviations:** **AC-019 stays Partial** (not Met) — the *properties* (mirror both ways, first-responder-wins,
  act-via-ownership, ask-mirror) are proven at integration altitude, but operator-reachable attach (WBS-6.1) and the live
  Telegram path (`/global/event` routing = 6.1; reconnect = 6.5) are not yet built. My earlier "6.4 flips AC-019 → Met" note
  was corrected. **Blockers:** none. **Next:** operator gate for PR into `develop`; then **WBS-6.1** (gateway + `@marid/channel-client`
  + the admin-gated attach endpoint + `/global/event` routing — the item that makes mirroring operator-reachable and flips AC-019).

## 2026-07-10 — WBS-6.3 bidirectional mirroring mechanism (unmerged, gated)
- **Done:** **WBS-6.3 — the additive mirroring core (ADR-0012), the production successor to the EXP-008 spike.**
  New durable `@marid/auth/binding.ts` — a session↔surface `BindingStore` (`binding.json`, 0600 sidecar;
  `attach`/`detach`/`list`; mutable per ADR-0012 rebinding; mirrors `ownership.ts`). `middleware.ts` swaps the
  `/event` filter predicate `owns` → binding-aware **`isVisible` = `owns(id) ∪ bound.has(id)`** — **VIEW-via-binding**
  on the firehose only; the acting gate (`authorize`/`scope.ts`) and the `GET /session`+`GET /permission` list
  routes stay on `owns` alone → **ACT-via-ownership** (a bound surface sees a mirrored session but cannot
  approve/prompt one it does not own, INV-001, by construction). Binding I/O confined to the `/event` subscribe;
  degrade-safe `.catch` (a throwing registry collapses to owns-only — RISK-024/AC-024). Wired `createBindingStore(dir)`
  into `serve.ts` (Marid-owned `src/marid/`). **`event-filter.ts` UNTOUCHED** — `filterSseStream` already accepts an
  arbitrary predicate, so the change is a one-site call swap (the WBS "(edit event-filter.ts)" text was stale; EXP-008
  governs). New `binding.test.ts` (durable round-trip, detach, 0600) + `mirroring.test.ts` (mirror-in/out, explicit-attach
  invisibility, act-via-ownership deny, blast-radius no-op, registry-fault degradation) drive the **real** middleware +
  store + filter. marid-auth **87→100 pass / 0 fail**; typecheck + lint clean; **zero upstream edit**.
- **Decisions:** Scope cut to the mirroring **mechanism** (advisor-confirmed). Deliberately NOT built here — and
  documented as carried, not dropped: the operator/admin-gated `/attach` HTTP endpoint + cross-surface permission
  first-responder-wins → **WBS-6.4**; channel-client-consume of bound sessions → **WBS-6.1** (`@marid/channel-client`);
  seq→id SSE fan-out + attach-triggers-reconnect → **WBS-6.5**. **INV-001 landmine avoided:** an HTTP attach route was
  NOT added — a `channel:` token self-attaching to an arbitrary session would defeat explicit-attach (self-observe a
  privileged session); attach-auth is WBS-6.4's admin-gated design. End-to-end Telegram mirror-in is blocked on the
  WBS-6.5 reconnect trigger anyway (`owns`/`isVisible` snapshotted at subscribe time), so the marid-auth altitude is the
  highest-fidelity test that exists until 6.5. **Flag for WBS-6.1:** `isVisible` guards `url.pathname === "/event"`, so it
  bites web/TUI/SDK subscribers now, but the live Telegram gateway subscribes via **`/global/event`** (`gateway.ts:218`) —
  6.1 must route the channel-client's mirror subscription through `/event` (or extend the predicate to `/global/event`,
  confirming that route's own isolation) or mirroring will silently not reach Telegram. **Production no-op until then:** with
  no attach endpoint (deferred to 6.4), no binding is ever written → `bound` is always empty → `isVisible ≡ owns` for every
  live client, so this change alters nothing until 6.4 adds the admin-gated attach path.
- **Deviations:** AC-019 → **Partial** (mechanism proven; cross-surface permission slice is WBS-6.4), not Met. WBS-6.3
  marked done for its own DoD (mirror both ways / unattached invisible / additive). **Blockers:** none. **Next:** operator
  gate for PR into `develop`; then WBS-6.4 (cross-surface permission + attach endpoint) / WBS-6.1 (channel-client).

## 2026-07-10 — PH-6 execution begins: EXP-005/007/008 PASS + WBS-6.2 Telegram fix-in-place implemented (unmerged, gated)
- **Done:** First PH-6 **product code** (operator go-ahead). **WBS-6.2 — full Telegram experience, fix-in-place (ADR-0009),
  all 4 UX defects fixed:** (1) **Markdown → MarkdownV2** via `telegramify-markdown` (split-plain-then-render per chunk so
  a fence never straddles a boundary; 400→clean-plain fallback; `bot-api` `parse_mode` widened); (2) **inbound files land**
  — `resolveDownloadUrl`→SDK `FilePartInput` wired into the prompt (`media.inboundFileParts`, `policy` parts widened),
  filename **path-separator traversal guard** (INV-004), token URL **never logged** (INV-002, count only); (3) **slash
  whitelist** — new `slash.routeSlash` deny-by-default (`/new` resets the chat→session binding, `/help`; any other
  `/command` refused, **never prompted**, creates no session); (4) **multi-part separation** — `gateway` SessionState
  `streamer`→`streamers: Map<partID,Streamer>`, each assistant text part streams into its **own** message (single-part
  turns unchanged). Inline keyboards pre-existed (`permission.ts`). marid-telegram suite **68→89 pass / 0 fail**, typecheck
  clean. **Experiments de-risking the tier: EXP-005 PASS** (fix-in-place is 1 dep + wiring), **EXP-008 PASS** (mirroring is
  additive, zero src edit), **EXP-007 PASS** (GramJS userbot ↔ real bot round-trip: reply+inline-keyboard, callback, file
  both ways — harness proven; report `experiments/exp-007-report.md` + harness `scripts/exp-007-userbot-e2e.mjs`).
- **Key resolution — Telegram test DC is server-side blocked** (SMS-code login restricted to official apps; verified with
  GramJS **and** mtcute → identical `PHONE_CODE_INVALID`, not a library bug). **Resolved via a real dedicated throwaway
  account** (login code arrives in-app), production DC; runbook renamed `execution/telegram-userbot-e2e-setup.md` (test-DC
  analysis → Appendix A). All four creds provisioned + verified in git-ignored `.env`. Bun-compat answered: run the userbot
  tier on **Node**.
- **Decisions:** WBS-6.2 sequenced **before** WBS-6.1 (operator) — lower-risk, EXP-005-proven, doesn't touch the proven
  auth path (RISK-017 avoided for now). Filename sanitized channel-side (defense-in-depth at the untrusted boundary).
  **Deviations:** EXP-007 bot side is a **stub** (the real gateway behavior is WBS-6.2/6.6, not yet integration-run) — this
  proves the userbot harness mechanism, not product E2E; test-DC premise formally superseded, not deferred.
- **Blockers:** none technical. **Gated:** code is on `feat/ph6-marid-gateway`, **not merged/PR'd** (INV-003/005 — merge on
  operator instruction only). **Next:** live wiring + CI in **WBS-6.6** (EXP-007 harness vs a real `marid serve` + the 6.2
  fixes; 3-OS `marid-telegram`), or **WBS-6.1** (Marid Gateway extraction + `@marid/channel-client`), then WBS-6.3/6.4/6.5.

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
