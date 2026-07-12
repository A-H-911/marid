---
experiment: EXP-014
hypothesis: HYP-014
status: PASS
version: v1.0
updated: 2026-07-11
owner: operator (STK-001)
---

# EXP-014 — Additive OpenAPI for the gateway attach endpoint (AC-024 P-* de-risk)

**Verdict: PASS. HYP-014 confirmed — the Marid gateway's attach endpoint can be OpenAPI-documented
ADDITIVELY (zero upstream edit → NO `P-*`) by merging a Marid-owned `OpenApi.fromApi` fragment into the
`marid-auth`-intercepted `GET /doc` response.**

Validates [HYP-014](../research/hypothesis-register.md): *the gateway's attach/binding endpoints can be
OpenAPI-documented additively, served by the `marid-auth` wrapper, with no upstream edit.* De-risks
[WBS-6.1 slice b](../planning/work-breakdown.md) and its [ADR-0011](../adrs/adr-0011-marid-gateway.md)
"new endpoints are contracted, not scattered" clause; evidence for [AC-024](../validation/acceptance-criteria.md)
(OpenAPI-documented + TEST-CONTRACT-pinned) and [NFR-001](../requirements/non-functional.md) (additive
patch surface). Resolves the open endpoint-location question carried from WBS-6.4.

## The question

`AC-024` requires the gateway's new attach/binding endpoints to be **OpenAPI-documented + health-covered +
TEST-CONTRACT-pinned**. At runtime `/doc` is served from `OpenApi.fromApi(PublicApi)`
(`server/routes/instance/httpapi/server.ts:188`), and both the served routes (`createRoutes`) and `/doc`
are wired inside **upstream** files (`public.ts`, `server.ts`). The naive way to add an endpoint —
compose a group into `PublicApi` — edits upstream `api.ts`, i.e. a **`P-*`** requiring operator approval
(INV-005). The question: **is there an additive path that needs no upstream edit?**

## Result in one line

`marid-auth` already intercepts every request (the EXP-004 wrapper seam). It can **intercept `GET /doc`,
call `next`, and merge a small Marid-generated OpenAPI fragment into the upstream spec** — the endpoint
appears in the single unified `/doc` with **zero upstream edit**. The endpoint is *served* by the same
wrapper (a manual handler before `next`, like the existing marid routes); the Marid `HttpApiGroup` exists
only to *generate the fragment* and to drive TEST-CONTRACT.

## Method

A spike (`packages/opencode/test/marid/exp-014-openapi-additive.spike.test.ts`, 3/3 pass, 3.1 s) proved:

1. **Standalone fragment.** `OpenApi.fromApi(HttpApi.make("marid-gateway").add(group))` on a minimal
   Marid group (`POST /marid/attach`, payload `{token, session}` → `{attached}`) yields a valid OpenAPI
   object whose `paths["/marid/attach"].post` is present. `OpenApi.fromApi` is a **pure spec transform** —
   it needs no runtime service context, so a Marid-owned module can generate the fragment in isolation.
2. **Baseline.** The real upstream `OpenApi.fromApi(PublicApi)` spec (the actual `/doc` body, >10 paths)
   does **not** contain `/marid/attach`.
3. **Clean merge.** Merging the fragment's `paths` + `components.schemas` into the upstream spec has **no
   path collision** and **no schema-name collision** (Marid identifiers are prefixed — `MaridAttachInput`,
   `MaridAttachResult`); the merged spec carries `/marid/attach` and stays JSON-serializable.

```ts
const MaridGatewayApi = HttpApi.make("marid-gateway").add(
  HttpApiGroup.make("marid").add(
    HttpApiEndpoint.post("attach", "/marid/attach", { payload: AttachInput, success: AttachResult })
      .annotateMerge(OpenApi.annotations({ identifier: "marid.attach", summary: "Attach a session to a channel surface" })),
  ),
)
const base = OpenApi.fromApi(PublicApi)          // the real /doc body (upstream, unchanged)
const fragment = OpenApi.fromApi(MaridGatewayApi) // Marid-owned, generated in isolation
const merged = { ...base, paths: { ...base.paths, ...fragment.paths },
  components: { ...base.components, schemas: { ...base.components.schemas, ...fragment.components.schemas } } }
// merged.paths["/marid/attach"].post is defined; no collisions.
```

## Implications for WBS-6.1 slice b

- **No `P-*`.** The attach endpoint (serving) is a manual handler in the `marid-auth` wrapper (additive,
  proven). The OpenAPI coverage (documenting) is a `GET /doc` interception that merges the Marid fragment
  (additive). Neither edits upstream. NFR-001 additive envelope holds; nothing to enumerate.
- **TEST-CONTRACT** pins the merged `/doc` (assert `/marid/attach` present + schema-shaped) plus a live
  round-trip against the wrapper handler — the production successor to this spike.
- **Health-covered** is satisfied by the existing `/global/health` (process liveness + version); AC-024's
  "health-covered" is process/surface health, not per-route enumeration — no new health wiring needed.
- **Rejected path (characterized, for the record):** composing the group into `PublicApi` so `/doc` and
  `createRoutes` emit it natively would edit upstream `api.ts`/`server.ts` = one `P-*`. Not needed given
  the merge path; kept here so the trade-off is on record.

## Threats to validity

The spike merges specs in-memory; slice b must prove the **runtime** `GET /doc` interception preserves the
upstream `matchLegacyOpenApi` transform (it does — the wrapper reads the already-transformed `next`
response and only adds paths, never re-runs the transform) and that the wrapper handler + the fragment
schema agree with the served route shape (TEST-CONTRACT enforces this). The spike does not exercise auth
on `/doc` (unchanged — `authOnlyRouterLayer` still applies upstream; the merge rides the authorized
response). **Runtime gotcha the spike skipped:** `/doc` is JSON >1KB → upstream **gzips** it, and a
compressed body is opaque to the merge (the same reason `middleware.ts` strips `accept-encoding` on filtered
list routes). The `/doc` interception must strip `accept-encoding` (or decompress) before merging. This is
an additive impl detail, not a `P-*`.
