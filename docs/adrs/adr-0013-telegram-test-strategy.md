---
id: ADR-0013
status: Approved
version: 1.1.0
updated: 2026-07-10
supersedes: none
superseded_by: none
owner: operator (STK-001)
---

# ADR-0013 — Telegram real-client test strategy (four tiers)

**Status:** **Approved (2026-07-10 operator PH-6 gate; EXP-007/009/010 validate feasibility at build)** · relates to FR-046/048/049, FR-063, NFR-011,
AC-020/021, DEC-019, RISK-016/018/020, [C-10](../architecture/technology-comparison.md),
[R-11 findings](../research/findings/telegram-options.md).

**Context.** All current Telegram coverage is a **fake Bot-API server** (`telegram.test.ts`) or a faked SDK; **no
test drives a real Telegram client**, and the only real touchpoint is a manual per-release probe — exactly what
missed the ADR-0008 defect cluster (Markdown/media/slash/multipart). The operator requires **real automated
testing of an actual Telegram client**, including the native mobile app. Research (2026-07-10): the strongest
automatable real-protocol option is a **GramJS userbot** (`telegram` npm, MIT) against **Telegram's test DC**
(synthetic `+99966XYYYY` numbers, fixed login code, no SMS) — verified `testServers` support, but the repo is
~18 months stale and test-DC login has documented `PHONE_CODE_INVALID` issues; a BotFather bot lives on
production, so this needs a **test-DC bot** + a **`/test` Bot-API mode** in `marid-telegram`, and GramJS Bun-compat
is unverified (Node-fallback allowed).

**Decision.** Four tiers, matched to determinism:

1. **Fake-server E2E — the blocking GitHub PR gate.** Deterministic, existing; extended to cover the full PH-6
   feature set (files both ways, whitelisted slash, inline keyboards, mirroring).
2. **GramJS userbot on the test DC (TEST-TG-E2E)** — automated real-MTProto protocol E2E: send/receive text +
   files, run slash commands, tap inline keyboards via `MessageButton.click()`. De-risked first by **EXP-007**.
3. **Telegram Web + Playwright (TEST-TG-UI)** — real-app **rendered-UX** check (Markdown/media rendering) via a
   headless browser on `?test=1`. De-risked by **EXP-009**.
4. **Native mobile app (TEST-TG-MOBILE)** — mobilewright/mobile-mcp driving the real **Telegram Android app** in
   an emulator (or wired device) for true native rendering/UX. De-risked by **EXP-010**. **Operator-requested.**

**Testing model (operator-resolved).** The **fake-server E2E is the blocking GitHub PR gate**. Tiers 2 and 3
(userbot + Web-Playwright) run on the **local pre-PR run every time** (always executed, developer/agent-side) and
are wired on GitHub as **on-demand-per-PR** (`workflow_dispatch`/label, **non-gating**) — honoring "always
executed" without letting live-Telegram flakiness block merges. Tier 4 (native mobile) is a **manual/occasional**
check, **never a gate** (emulator/device flakiness + Telegram-app-version drift make it impractical to gate CI on
— RISK-020). All real-client failures alert loudly.

**Consequences.** Real protocol + rendered-UX + native-app regressions are caught pre-PR (locally) and on-demand
(remotely), while PRs stay gated only on the deterministic fake-server tier — fast, reliable merges plus genuine
real-client coverage. Costs: a throwaway/test-DC Telegram account, a test-DC bot + `/test` Bot-API mode, a
Playwright browser, and an Android emulator/device for tier 4; GramJS may run on Node even if Marid core is Bun.
Realized in PH-6 (WBS-6.6); the experiments gate feasibility before the tier is relied upon.

**Rejected.** (1) **Fake-server only** — missed the real defects once already. (2) **Real-app GUI as a required PR
gate** — flaky live-Telegram checks would block legitimate merges (anti-pattern). (3) **mobilewright as the primary
automated tier** — for testing one's own app, brittle on a third-party app's a11y tree, heavy emulator; kept as a
manual/occasional real-device check only. (4) **Telegram Desktop + computer-use** — least deterministic, worst
CI fit.
