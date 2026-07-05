---
status: Proposed (name Approved at gate 3; plan approved with gate 13)
version: v0.1
updated: 2026-07-03
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

## Logo brief (editable vector, SVG source committed)

- Concept: a minimal geometric mark evoking a rising smoke/flame spiral resolving into a sharp
  chevron/arrow — "summoned power, directed". Must read at 16 px (favicon/TUI glyph) and 512 px.
- Style: flat, 2-color; primary deep indigo `#3B2E8C` + ember accent `#F2A03D`; dark-mode variant with
  light mark on transparent. No gradients required; no third-party mascots/jinn imagery clichés (lamps).
- Deliverables: `logo.svg`, `logo-dark.svg`, `mark-only.svg`, favicon PNGs (16/32/180), all editable
  (Inkscape-clean paths, no embedded rasters).
- Typography (wordmark): open-license geometric sans (e.g., Inter/Space Grotesk — pick at design time),
  lowercase "marid" with slightly tightened tracking.

## Rebrand boundary (per ADR-0001/Shaheen reject #3)

User-visible surfaces only: CLI bin name, TUI title, user-agent, README, release names (patch-surface
P-2). Internal identifiers, env prefixes (`OPENCODE_*`), XDG dir names, and DB names stay upstream to
keep the sync surface small — revisit only if a conflict with genuine OpenCode installs on the same
machine emerges (instance dirs already prevent it).
