---
status: Proposed (approved with gate 13 handoff)
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# Test & Validation Strategy (§17, risk-based)

Principles: reuse upstream's Bun test suites untouched (they keep validating kept packages at every
sync); new Marid code is TDD'd; **no mocks of the runtime — tests run against real `marid serve`
processes** (matches upstream's testing philosophy). Coverage threshold for new `marid-*` packages is set
after measuring the upstream baseline (NFR-011) — do not invent a number first.

## Test families

| Family | Scope | Kind | Runs |
|---|---|---|---|
| TEST-UP | Upstream suites for all kept packages | unit/integration (existing) | every PR |
| TEST-AUTH | marid-auth: tokens, scopes, 401/403/429, audit lines, redaction | unit + integration vs real server | every PR |
| TEST-CONTRACT | Pinned v1 routes/events (the gate-7 contract): route shapes, event taxonomy, seq/replay semantics | contract suite vs real server | every PR + **blocking on sync PRs** |
| TEST-INST | marid-instance: lifecycle commands, port/PID, isolation suite (full R-05 conflict inventory) | integration, 2+ real instances | PR (fast subset) + nightly full |
| TEST-SYNC | Cross-interface: §7 flow, reconnect/replay, restart recovery, concurrency semantics; **+ cross-client channel mirroring (attach, bidirectional, view-via-binding/act-via-ownership, cross-surface permission/concurrency)** (PH-6) | integration/E2E, SDK+TUI headless | PR subset + nightly |
| TEST-TG | Telegram gateway: dedup, allowlist, formatting/split, cadence, inline-keyboard permissions; Bot API faked locally via recorded fixtures (http-recorder) — **the deterministic blocking PR gate** | unit + integration (fixtures) | **every PR (blocking gate)** |
| TEST-TG-E2E | Telegram **real-protocol** E2E — GramJS userbot on the **test DC** (text/files/slash/inline-keyboard) (PH-6, ADR-0013) | E2E vs real MTProto (test DC) | **local pre-PR (always) + GitHub on-demand (non-gating)** |
| TEST-TG-UI | Telegram **Web** rendered-UX via Playwright (Markdown/media rendering, `?test=1`) (PH-6, ADR-0013) | E2E headless browser | **local pre-PR (always) + GitHub on-demand (non-gating)** |
| TEST-TG-MOBILE | Native **Telegram Android app** via mobilewright/mobile-mcp (emulator/device) (PH-6, ADR-0013) | E2E native app | **manual/occasional (never a gate)** |
| TEST-WA | WhatsApp gateway: allowlist, dedup, streaming-sim, media, INV-001, token-permission; fake-WA at the WAHA WebSocket+HTTP boundary (validated against the pinned GATE-0 OpenAPI fixture) driving a real `marid serve` — **the deterministic blocking PR gate** (AC-023, EXP-011, ADR-0014 tier 2) | unit + integration (fake-WA) | **every PR (blocking gate)**; live burner/native = manual, never a gate |
| TEST-BUILD | Profile build, binary smoke (`--version`, serve+health), hygiene grep, install-script smoke | build/E2E | release + nightly |
| TEST-SYNCUP | Sync workflow: delta report generation, migration flagging | workflow test | on sync PRs |
| TEST-SEC | Secret redaction, permission policy denial paths, injection containment probes (channel content attempting tool abuse) | integration | PR subset + release |

## Tiers (§17/§18 mapping)

- **PR:** TEST-UP + TEST-AUTH + TEST-CONTRACT + fast subsets — target < 15 min.
- **Telegram real-client (PH-6, ADR-0013):** TEST-TG (fake-server) is the **blocking PR gate**; TEST-TG-E2E (userbot) + TEST-TG-UI (Web-Playwright) run **local-pre-PR (always) + GitHub on-demand (non-gating)**; TEST-TG-MOBILE is **manual/occasional (never a gate)**.
- **WhatsApp real-client (PH-7, ADR-0014):** TEST-WA (fake-WA at the WAHA WS+HTTP boundary) is the **blocking PR gate** (3-OS `marid-whatsapp` job, `MARID_WHATSAPP=1`); the burner real-protocol probe ([EXP-012](../experiments/exp-012-runbook.md)) and native-app render check ([EXP-013](../experiments/exp-013-runbook.md)) are **manual, off-CI, never a gate** (ban-exposed). MS-008 exits on the deterministic tier alone.
- **Nightly:** full TEST-INST + TEST-SYNC + TEST-BUILD on Linux; 3-OS weekly.
- **Release:** everything on 3 OSes (x64), plus live Telegram probe and install smoke.
- **Post-sync:** PR tier + TEST-SYNCUP + full TEST-CONTRACT (blocking).

## Policies

Deterministic modes: provider calls in tests use recorded fixtures (http-recorder package — kept as dev
tooling) or a local fake provider; no live LLM calls in CI. Flaky policy: a flaky test is quarantined
with an issue within one day and fixed or deleted within a week — never retried-until-green silently.
Every gate/milestone lists which families must be green (see roadmap DoD column). Evidence (reports,
coverage) attaches to the PR/release as CI artifacts with retention per §18.
