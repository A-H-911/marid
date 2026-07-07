---
status: Approved (gate 3, 2026-07-03 — selected: Marid)
version: v1.0
updated: 2026-07-03
owner: operator (STK-001)
---

# Naming Proposal (DEC-008, gate 3)

Availability checked 2026-07-03: npm registry (404 = free) and GitHub top-starred collisions
(`gh search repos`). No candidate collides with a major product or implies OpenCode affiliation.
Dropped for npm collision: `falak` (taken), `nawa` (taken).

| Candidate | Meaning | Pronounce | Repo/CLI | Daemon | Tagline | npm | Risks |
|---|---|---|---|---|---|---|---|
| **Wakil** ⭐ recommended | وكيل — "agent / trusted representative" | wah-KEEL | `wakil` | `wakild` | "Your agent, everywhere." | free | Common word in Arabic/Urdu/Indonesian (lawyer/representative); low trademark risk, slight genericness |
| Sanad | سند — "support / reliable backing"; also chain-of-transmission (provenance/trust) | SA-nad | `sanad` | `sanadd`/`sanad-server` | "A backend you can lean on." | free | Small unrelated repos (GNOME DNS tool, hadith DBs) share the name |
| Rafiq | رفيق — "companion" | ra-FEEK | `rafiq` | `rafiqd` | "A companion for every app." | free | Trailing q slightly awkward; common personal name |
| Marid | مارد — most powerful class of jinn; a summoned, powerful helper | MAA-rid | `marid` | `maridd`/`marid-server` | "Summon serious power." | free | Jinn connotation may read negative to some; strongest visual identity |

**DECISION (gate 3, 2026-07-03): Marid** — مارد. Product: **Marid** · repo slug: `marid` · CLI: `marid` ·
TUI title: Marid · daemon/server: `marid serve` (process name `marid-server` where a distinct name is
needed). Tagline: "Summon serious power." The README, logo brief, and repository bootstrap derive from
this choice. Wakil, Sanad, and Rafiq are Rejected (kept here as evidence).
