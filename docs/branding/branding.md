---
status: Approved (name Approved at gate 3; logo realized WBS-5.4; deep rebrand realized PH-8 / ADR-0018)
version: v0.3
updated: 2026-07-15
owner: operator (STK-001)
---

# Marid — Branding, README Plan, Logo Brief (FR-065)

Name **Marid** (مارد) approved at gate 3 (DEC-008): the most powerful class of jinn — a summoned,
powerful helper. Pronounced MAA-rid. Availability at check time (2026-07-03): npm `marid` free (404);
no major GitHub collision. Naming surfaces: product **Marid** · repo `marid` · CLI `marid` · daemon mode
`marid serve` · instances via `marid instance …` · packages `@marid/<name>` (registry-private).

## README plan (structure, to be written at WBS-5.4)

1. Logo + one-liner: *"Marid — your agents, summoned anywhere."*
2. What it is: private agent platform — TUI, HTTP+SSE API, web UI, Telegram — one runtime, isolated instances.
3. Quick start: install (private release), `marid instance add`, first session, first token, Telegram setup.
4. Interfaces table: TUI / API+SDK / Web / Telegram with links to docs.
5. Security model summary + private-network stance.
6. **Attribution + non-affiliation** (MIT obligation + §19): "Marid is a private downstream distribution
   of [OpenCode](https://github.com/anomalyco/opencode) (MIT). Not affiliated with or endorsed by the
   OpenCode project. Upstream copyright and permission notices are preserved."
7. Upstream sync policy (baseline SHA per release), license, changelog link.

## Logo brief — REALIZED at WBS-5.4 (2026-07-08; supersedes the original 2-color chevron brief)

The original brief proposed a flat 2-color indigo+ember chevron. The operator revised the direction during
WBS-5.4 (design iterated in a Claude Design project); the **realized** identity is:

- Concept: a **flame mark** (jinn = *smokeless fire*, مارج من نار) to the left of a **"Marid" wordmark**
  drawn in OpenCode's own chunky block/pixel logo style — two-tone extruded, recolored.
- Wordmark: **Pixelify Sans 700** (operator-selected), capital "Marid". Two-tone extrude like OpenCode's
  white/gray mark, but **blue face `#2F6BFF` + orange offset `#F0731F`** (`text-shadow` offset).
- Flame: vertical **yellow → orange → red** gradient — `#FBD24A → #F5901E → #DC2A16`, with a brighter core
  (`#FDEFB0 → #F8B73C`) and a warm glow. Reads from 512 px down to a 16 px favicon.
- Deliverables (committed under `docs/branding/`): `mark.svg` (the flame, portable vector); `logo-light.png`
  + `logo-dark.png` (the full flame+wordmark lockup, Pixelify baked in — **PNG, because GitHub does not load
  web fonts in SVG `<text>`**, so a portable wordmark SVG would not render). The terminal glyph lives in
  `packages/tui/src/logo.ts` (+ `packages/opencode/src/cli/ui.ts`), flame in ember orange.

## Rebrand boundary (per ADR-0001/Shaheen reject #3)

User-visible surfaces only: CLI bin name, TUI title + startup logo, README, release names (patch-surface
P-2). Internal identifiers and env prefixes (`OPENCODE_*`) stay upstream to keep the sync surface small.
XDG dir names originally stayed upstream too, "revisit only if a conflict with genuine OpenCode installs on
the same machine emerges" — **that condition emerged at v0.2.0 and PH-8 moved them** (see the ADR-0018 note
below); DB names stay upstream (now inside the isolated dir).

> **PH-8 revisited this boundary and moved it (that "revisit only if" condition emerged).** Running the public
> v0.2.0 binary *plain* (not via `marid instance`) beside a co-installed OpenCode shared machine-global
> dirs/auth/model/sessions/DB. **[ADR-0018](../adrs/adr-0018-data-isolation-deep-rebrand.md)** (Approved
> 2026-07-13) and [DEC-022..027](../decisions/open-decision-register.md) resolved it, now **realized**: the
> **XDG dir names isolate to `marid`** (data isolation via a build-time app-name — P-6), the config filename is
> **`marid.json`** (P-7, project-`opencode.json` fallback), **`OPENCODE_*` env stays** (ecosystem compat, with
> boot-time disclosure of the five data-layer overrides that still pierce isolation), and the **DB file name
> stays** `opencode.db` (internal, now inside the isolated dir — DEC-027). PH-8 also extended the rebrand past
> this "user-visible surfaces only" line, all **shipped on `develop`**:
> - **Agent self-identity** → Marid at the single system-prompt choke point, with a CI guard forbidding
>   `\bopencode\b` in emitted prompts (P-8, DEC-026, AC-028).
> - **TUI surfaces** — startup logo redrawn to a **flame teardrop + two-tone wordmark** behind a truecolor
>   **render gate** (crisp-mono fallback on 256-color terminals), `/exit` goodbye, sidebar footer "● Marid",
>   notification title, and the removal of the OpenCode-GO upsell (P-2, AC-029).
> - **Web UI** — favicon / PWA icons / social-share / `Mark`+`Splash` glyphs / notification icon regenerated
>   from the flame, all `opencode.ai` remotes dropped, and the home/crash brand lockup reshaped to a shared
>   inline-SVG flame + two-tone "Marid" (P-2 expansion + P-9 auth-gate, AC-030).
>
> The two-tone wordmark spec below (blue `#2F6BFF` / orange `#F0731F`) is what those surfaces apply.

**User-Agent dropped from P-2 (WBS-5.4):** the brief originally listed the user-agent, but the real request
UAs are hardcoded `opencode/${version}` across ~15 provider/plugin source sites (`session/llm/request.ts`,
`provider.ts`, the copilot/codex/digitalocean/xai/snowflake plugins…). Rebranding all of them is a large
upstream patch surface (violates NFR-001) and breaks upstream provider tests that pin `/^opencode\//`; the
lone `installation/index.ts` `userAgent()` choke point has ~no consumers, so changing it alone would alter
nothing providers see. The UA is provider-facing, not operator-facing — kept upstream, same rationale as
leaving the internal `OPENCODE_*` identifiers. (The `package.json` bin was likewise not touched: the marid
binary is named `marid-<target>` by `script/marid-build.ts`, independent of the upstream package bin.)
