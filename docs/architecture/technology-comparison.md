---
status: Proposed (feeds gates 5–9)
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# Option Comparisons (Stage 11)

Criteria are stated **before** scoring. Scores: 3 strong · 2 partial · 1 weak · 0 unsuitable · ? unknown.
Weights reflect the approved charter: reuse-first (DEC-009), small patch surface (NFR-001), simplicity
(NFR-002), single operator, private network, solo maintainer (ASM-004). Evidence: current-state docs
(`current-state/0X-*.md`), research findings (`../research/findings/`). Losers are kept — they are
evidence, not clutter.

## C-1 · Upstream synchronization model (→ DEC-003, gate 9)

Weights: sync effort for a solo maintainer ×3 · conflict surface ×3 · security-patch speed ×2 ·
history/provenance clarity ×2 · tooling simplicity ×2.

| Option | Effort | Conflict | Sec-patch | History | Tooling | Weighted | Notes |
|---|---|---|---|---|---|---|---|
| **A. Tracking fork + periodic upstream MERGE + minimal patch surface** | 3 | 3 | 3 | 3 | 3 | **36** | Downstream delta lives in NEW packages (see C-2/C-4), so merges rarely conflict; git-native; delta report = `git diff upstream/dev...HEAD --stat` |
| B. Periodic REBASE onto upstream | 2 | 2 | 3 | 1 | 2 | 24 | Clean linear history but rewrites published branches; painful with Git Flow's long-lived branches |
| C. Patch-stack (quilt/stgit-style curated patches) | 1 | 3 | 2 | 3 | 1 | 24 | Best when you must enumerate every diff; overkill when the delta is additive packages (R-10: VSCodium uses this because it *edits* upstream files — we mostly don't) |
| D. Vendored hard fork (freeze, no sync) — Shaheen's model | 3 | 3 | 0 | 1 | 3 | 26* | *Fails the charter directly (G-7, NFR-001); Rejected on requirements, not score |
| E. Adapter layer fully outside the fork (wrap released binaries) | 2 | 3 | 2 | 2 | 2 | 26 | Viable fallback if the fork ever becomes too costly; blocks TUI/branding changes and distribution-profile builds |

**Front-runner: A**, with C-2's exclusion strategy keeping the patch surface enumerable, weekly-to-monthly
cadence + CI conflict-detector branch + security fast-path (R-10 citations).

## C-2 · Component reduction strategy (→ DEC-001, gate 6)

Weights: merge-conflict avoidance ×3 · build/distribution cleanliness ×2 · reversibility ×2 · effort ×2.

| Option | Merge | Clean | Reversible | Effort | Weighted | Notes |
|---|---|---|---|---|---|---|
| **A. Distribution profile: keep all files; exclude packages from build/release; config-off features (e.g. `lsp:false`)** | 3 | 2 | 3 | 3 | **25** | Exclusion candidates have zero dangling edges (R-01); turbo/workspace scoping + own publish workflow make exclusion natural |
| B. Delete excluded packages from the repo | 0 | 3 | 1 | 2 | 12 | Every upstream change to a deleted path = recurring conflict; contradicts §2's warning |
| C. Feature-flag everything at runtime | 2 | 1 | 3 | 1 | 16 | Invasive in-file edits = patch surface where we least want it |

**Front-runner: A.** Deletion is reserved for justified cases recorded per-package in the keep/remove matrix.

## C-3 · Remote streaming protocol (→ DEC-002, gate 7)

Weights: reuse of existing code ×3 · fit to FR-024/036 ×3 · client simplicity ×2.

| Option | Reuse | Fit | Simplicity | Weighted | Notes |
|---|---|---|---|---|---|
| **A. SSE (existing: global `/event` + v2 per-session `?after=<seq>` replay)** | 3 | 3 | 3 | **24** | Already implemented and consumed by app + slack prototype (R-02, R-06); brief prefers SSE |
| B. WebSocket | 0 | 3 | 2 | 13 | Nothing to reuse; bidirectionality not needed — commands go over plain HTTP POST |
| C. Polling only | 2 | 1 | 3 | 15 | Fallback pattern for constrained clients; not primary |

**Front-runner: A.** WebSocket is added only if a concrete FR-036 gap survives EXP-001 (per §6's own rule).

## C-4 · API generation to build on (→ DEC-004, gate 7)

Weights: stability ×3 · SDK availability ×2 · future-proofing ×2 · patch surface ×2.

| Option | Stable | SDK | Future | Patch | Weighted | Notes |
|---|---|---|---|---|---|---|
| **A. v1 API + published `@opencode-ai/sdk`, behind a thin Marid gateway layer (auth/rate/audit added there)** | 3 | 3 | 2 | 3 | **25** | v1 is what app/slack/SDK use today (R-02); Marid-specific concerns live in a NEW package = zero core diff |
| B. v2 `/api/*` + sdk-next now | 1 | 1 | 3 | 3 | 17 | Every v2 group is annotated Experimental; migration churn lands on us |
| C. Design a brand-new Marid public API | 1 | 0 | 3 | 1 | 11 | Violates DEC-009 (reuse-first) and INV-007 |

**Front-runner: A**, with an explicit re-evaluation trigger: when upstream marks v2/sdk-next stable,
raise a decision to migrate (recorded as a standing item in the sync checklist).

## C-5 · Cross-interface sync & concurrency model (→ DEC-005, gate 7)

Weights: correctness ×3 · reuse ×3 · MVP simplicity ×2.

| Option | Correct | Reuse | Simple | Weighted | Notes |
|---|---|---|---|---|---|
| **A. One server process per instance; ALL clients (TUI, API, web, gateway) attach over HTTP+SSE; reuse the v2 single-writer/queue/steering design (verify via EXP-001)** | 3 | 3 | 3 | **24** | Live events already reach all clients of one server (R-03); removes the two-process shared-DB blind spot by construction |
| B. Multi-process shared SQLite + event propagation layer | 2 | 1 | 1 | 11 | Builds a distributed problem the charter excludes (§7) |
| C. Pessimistic global session lock | 3 | 2 | 2 | 19 | Simpler but kills the §7 simultaneous-prompt/steering requirements; fallback if EXP-001 fails |

**Front-runner: A.** The authoritative store stays upstream's SQLite (one DB per instance).

## C-6 · MVP distribution method (→ DEC-006, gate 10)

Weights: reuse of upstream release machinery ×3 · single-operator install/update ergonomics ×3 ·
private-distribution fit ×2 · 3-OS coverage ×2.

| Option | Reuse | Ergonomics | Private | 3-OS | Weighted | Notes |
|---|---|---|---|---|---|---|
| **A. Bun-compiled standalone binaries → private GitHub Releases (adapted publish.yml; checksums; install via gh-authenticated script)** | 3 | 3 | 3 | 3 | **30** | Upstream already builds 12 binary targets (R-05); strip public npm/AUR/brew publishing |
| B. Docker/Compose first | 2 | 2 | 3 | 1 | 20 | Poor fit for TUI-first use on Windows; strong later addition for server-style deployment |
| C. Private npm registry | 2 | 2 | 2 | 3 | 22 | Adds registry infrastructure the MVP doesn't need |

**Front-runner: A**; expansion path: Docker image (upstream ghcr job exists) in a later phase.

## C-7 · Channel gateway placement (→ FR-045 contract, gate 5)

Weights: core patch surface ×3 · security containment ×3 · reuse of proven pattern ×2.

| Option | Patch | Contain | Proven | Weighted | Notes |
|---|---|---|---|---|---|
| **A. Separate gateway process speaking only the public HTTP+SSE API (long-polling Telegram ingress)** | 3 | 3 | 3 | **24** | Proven twice (slack prototype, Shaheen WhatsApp gateway); crash/compromise of gateway ≠ crash of core; policy enforced at the API boundary |
| B. In-core channel plugin | 1 | 1 | 2 | 10 | In-process plugins have zero isolation (R-04) — wrong place for untrusted ingress |

**Front-runner: A.**

## C-8 · Telegram remediation approach (→ DEC-014, ADR-0009, PH-6)

Weights: fewest changes / minimal diff ×3 · smallest sync surface (NFR-001) ×3 · INV-001 fit ×3 · feature
parity for the 5 defects ×2 · maintenance burden (solo, RISK-005) ×2 · license ×1. Evidence:
[R-11 findings](../research/findings/telegram-options.md).

| Option | MinChange | SyncSurf | INV-001 | Parity | Maint | License | Weighted | Notes |
|---|---|---|---|---|---|---|---|---|
| **A. Fix-in-place (`telegramify-markdown` + wire existing seams)** | 3 | 3 | 3 | 3 | 3 | 3 | **42** | 1 dep + ~55-120 LOC across 3-4 Marid-owned files; the gateway is zero-dep hand-rolled and already has streaming/coalescing/429/400-fallback |
| B. Port grinev's `render/` modules | 2 | 2 | 3 | 3 | 2 | 3 | 34 | Only wins for entity-based rendering (no `parse_mode`); drags unified+remark+grammy types in for a result telegramify already gives |
| C. Fork grinev wholesale (ADR-0008) | 1 | 1 | 1 | 3 | 1 | 3 | 20 | Basic auth (not bearer); most features hit `channel:`-denied routes (403); SDK v1 vs Marid v2; new fork to maintain |
| D. Adopt another bridge | 1 | 1 | 0 | 2 | 1 | 1 | 13 | Every surveyed bridge embeds/spawns the agent or uses Basic auth — none speaks the channel-token contract |

**Front-runner: A** (fix-in-place) — directly rebuts ADR-0008's "re-implements grammy/remark" premise; confirmed
by EXP-005. On approval ADR-0009 supersedes ADR-0008.

## C-9 · WhatsApp unofficial-client approach (→ DEC-015, ADR-0010, PH-7)

Weights: supply-chain isolation (RISK-014) ×3 · private-network fit / outbound-only (OQ-004) ×3 · stack fit
(Bun/TS, dep weight) ×2 · streaming+media capability ×2 · license/attribution ×2 · maintenance/activity ×1.
Evidence: [R-12 findings](../research/findings/whatsapp-options.md). (Official Cloud API kept as rejected —
INV-006 — but unsuitable on OQ-004: it needs a public inbound webhook.)

| Option | Supply | OQ-004 | Stack | Feature | License | Maint | Weighted | Notes |
|---|---|---|---|---|---|---|---|---|
| **A. Baileys behind WAHA (NOWEB) over WebSocket** | 3 | 3 | 3 | 3 | 3 | 3 | **39** | Marid pulls no WhatsApp dep (lotusbail-class stays in the WAHA container); WAHA Core free Apache-2.0; NOWEB = no Chromium; outbound-only via WS event mode |
| B. Baileys-direct (pinned, hardened) | 1 | 3 | 3 | 3 | 3 | 3 | 33 | Best OQ-004 + streaming/edit fit, MIT, native TS/Bun; but Baileys in Marid's tree ⇒ strict hardening (RISK-014) |
| C. Evolution API (wrapper) | 3 | 2 | 3 | 2 | 2 | 2 | 31 | Sidecar isolation, but webhook-first event model = weaker OQ-004 fit; wraps Baileys anyway; Apache-2.0 + brand addendum |
| D. Puppeteer libs (whatsapp-web.js / wppconnect / venom) | 1 | 3 | 0 | 2 | 2 | 1 | 21 | Chromium footprint wrong for lean Bun server; buggy edits / stale release / LGPL |
| E. Official WhatsApp Cloud API | 3 | 0 | 2 | 3 | 3 | 3 | 28* | *Rejected on requirements (OQ-004: public webhook ingress), not on score; kept per INV-006 |

**Front-runner: A** (Baileys-behind-WAHA-WS), with **B** (hardened Baileys-direct) the documented alternative if
the operator prefers zero sidecars over zero WhatsApp-deps. Confirmed by EXP-006. **Note (2026-07-10):** OpenClaw's
MIT Baileys adapter is a **design/pattern reference only** (no code port; ADR-0010 amendment) — not a scored
option here.

## C-10 · Telegram real-client E2E (→ DEC-019, ADR-0013)

Weights: determinism / CI-fit ×3 · real-protocol fidelity ×2 · rendered-UX fidelity ×2 · setup+maintenance ×2 ·
in-language (Bun/TS) ×1. Evidence: [R-11 findings](../research/findings/telegram-options.md).

| Option | Determ | Protocol | RenderUX | Setup | Lang | Weighted | Notes |
|---|---|---|---|---|---|---|---|
| **A. GramJS userbot on test DC** | 3 | 3 | 0 | 2 | 3 | **22** | Real MTProto, no phone/SMS; but no rendering check; `PHONE_CODE_INVALID`/`/test`-bot setup (EXP-007) |
| **B. Telegram Web + Playwright** | 2 | 2 | 3 | 2 | 2 | **22** | Real rendered UX headless; selector-brittle; complements A (EXP-009) |
| C. Native mobile (mobilewright) | 1 | 2 | 3 | 1 | 2 | 17 | True native UX but emulator-heavy + brittle → manual/occasional only (EXP-010) |
| D. Telegram Desktop + computer-use | 0 | 2 | 2 | 1 | 1 | 11 | Least deterministic, worst CI |
| E. GramJS userbot on production | 2 | 3 | 0 | 1 | 3 | 17 | Real DC but ban risk + real account; test DC preferred |

**Front-runner: A + B (complementary)** — A proves protocol, B proves rendering; neither alone covers both. Fake-
server E2E remains the deterministic PR gate; C is the operator-requested manual native tier. (ADR-0013 four tiers.)

## C-11 · Gateway shape (→ DEC-017, ADR-0011)

Weights: fits operator intent (marid-auth = a component in the gateway) ×3 · additive / NFR-001 ×3 · DRYs channel
plumbing ×2 · enables server-side mirroring coordination ×2 · simplicity ×1.

| Option | Intent | Additive | DRY | Coord | Simpl | Weighted | Notes |
|---|---|---|---|---|---|---|---|
| **A. Server-side Marid Gateway (marid-auth module) + `@marid/channel-client`** | 3 | 3 | 3 | 3 | 2 | **32** | Chosen; marid-auth stays the additive wrapper, grows the fan-out/registry behind one hook |
| B. Client-side `@marid/channel-client` only | 1 | 3 | 3 | 1 | 3 | 23 | DRYs channels but no server-side mirroring coordination; doesn't match "marid-auth is a component in the gateway" |
| C. Standalone proxy process | 2 | 1 | 2 | 3 | 1 | 20 | New process = more surface; buys nothing the wrapper+firehose can't do additively |
| D. Proxy + client + server (heavy) | 2 | 1 | 3 | 3 | 0 | 21 | Most moving parts |

**Front-runner: A.**

## C-12 · Cross-client delivery / recovery (→ DEC-018, ADR-0012)

Weights: additive / NFR-001 ×3 · no lost final state (NFR-007) ×3 · gap-free intermediate events ×2 · complexity
(lower = better) ×2.

| Option | Additive | FinalState | GapFree | Simpl | Weighted | Notes |
|---|---|---|---|---|---|---|
| **A. Re-fetch authoritative state on reconnect** | 3 | 3 | 1 | 3 | **26** | Chosen; durable store → no final-state loss; misses only intermediate stream during a gap; zero upstream edit |
| B. Gap-free durable event replay (cursors) | 1 | 3 | 3 | 1 | 20 | Best fidelity but needs cursors upstream firehose lacks → upstream edit (leaves additive envelope); escape hatch |
| C. Cross-process propagation | 0 | 3 | 2 | 0 | 13 | ADR-0004 rejected option B — architecture change, not additive |

**Front-runner: A** (re-fetch-on-reconnect), with B reserved as a flagged escape hatch.

## C-13 · WhatsApp real-client test strategy (→ DEC-020, ADR-0014)

Weights: determinism / CI-fit ×3 · ban-risk avoidance ×3 · real-protocol fidelity ×2 · setup+maintenance ×2.
Evidence: [R-12 + WhatsApp-testing research](../research/findings/whatsapp-options.md). (No WhatsApp test DC exists;
Baileys' "bartender" mock is private/unavailable.)

| Option | Determ | Ban-avoid | Protocol | Setup | Weighted | Notes |
|---|---|---|---|---|---|---|
| **A. Fake-WA at the WAHA WebSocket boundary** | 3 | 3 | 1 | 2 | **24** | The deterministic **PR gate**; hermetic, no accounts, no ban; needs a narrow WAHA interface to keep the fake small |
| B. Second-account driver (burner) | 1 | 0 | 3 | 1 | 11 | Real protocol but ban-exposed + flaky → **manual/nightly probe only** |
| C. Native mobile (mobilewright) | 1 | 1 | 3 | 1 | 14 | Real rendering → **manual/occasional** |
| D. Official Cloud API sandbox | 2 | 3 | 1 | 2 | 21* | *Wrong protocol (official, not the chosen unofficial); rejected-for-parity, optional manual probe |

**Front-runner: A** as the gate; B + C are the (non-gating, manual) real-protocol/rendering probes. **Honest:
WhatsApp has no deterministic automated real-protocol tier** (unlike Telegram's test-DC userbot).

## C-14 · WhatsApp permission-approval UX (→ DEC-021, ADR-0015)

Weights: reliability (renders on the approver's client) ×3 · security / injection-resistance ×3 · INV-001 fit ×2 ·
UX ×1. (Interactive buttons are deprecated/broken on unofficial WhatsApp; lists are WAHA-Plus + fragile.)

| Option | Reliab | Security | INV-001 | UX | Weighted | Notes |
|---|---|---|---|---|---|---|
| **A. Token-bound text reply (`APPROVE <token>`)** | 3 | 3 | 3 | 1 | **25** | Renders everywhere; strict exact-match parse (no NLP) + server-side scope re-check; single-use/JID-bound/TTL |
| B. Interactive buttons | 0 | 2 | 2 | 3 | 13 | Dead/deprecated; would need risky forks |
| C. WAHA-Plus list message | 2 | 2 | 2 | 3 | 19 | Paid + engine-restricted + only "relatively" stable → optional convenience, not the primary |
| D. Polls | 2 | 1 | 1 | 2 | 13 | No per-option token binding; hard to make single-use |

**Front-runner: A** (token-bound text reply), with C as an optional convenience layer that must never be the sole
path.
