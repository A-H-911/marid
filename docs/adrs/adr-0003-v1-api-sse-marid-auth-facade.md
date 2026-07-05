---
id: ADR-0003
status: Approved
version: v1.0
updated: 2026-07-03
supersedes: none
superseded_by: none
---

# ADR-0003 — Build on the v1 API + SSE behind a marid-auth layer; watch v2

**Status:** Approved (2026-07-03; gate 5, API confirmed gate 7) · promotes DEC-002 + DEC-004 · derives from C-3, C-4

**Context.** R-02: the v1 HTTP surface + published `@opencode-ai/sdk` already satisfy 7/16 remote-API FRs
as-is; every v2 `/api/*` group is annotated Experimental; SSE exists with per-session durable replay
(`?after=<seq>`); rate limiting and audit logging are absent; auth is one optional Basic credential.

**Decision.** Marid's public interface = the upstream v1 API + SSE, fronted by **marid-auth** (new
package on the single server extension seam): bearer tokens with per-token scopes, rate limiting, audit
logging, request-ID correlation. SSE remains the only streaming transport (WebSocket only if a concrete
FR-036 gap survives EXP-001). The v2/sdk-next migration is a standing item in every upstream-sync review;
when upstream stabilizes it, a migration DEC is raised.

**Consequences.** Stability now, one facade to re-point at v2 later; Marid does not expose internal types
beyond what upstream's SDK already exposes (the §6 versioning concern is inherited but bounded by the
facade). Cost: living with dual API generations in-repo (RISK-001 watch).

**Rejected.** v2-now (experimental churn); brand-new Marid API (violates DEC-009/INV-007).
