import type { AuditLog, Decision } from "./audit"
import type { BindingStore } from "./binding"
import type { OwnershipStore } from "./ownership"
import type { RateLimiter } from "./ratelimit"
import { authorize, sessionFromPathname } from "./scope"
import { filterOwnedArray, filterSseStream, owningSession, owningSessionGlobal, pickPermissionSessionId, pickSessionId } from "./event-filter"
import { REQUEST_ID_HEADER, resolveRequestId } from "./request-id"
import { errorResponse } from "./http"
import { augmentDoc, handleGatewayRoute, isGatewayRoute } from "./gateway"
import type { TokenStore } from "./token"

export type Next = (request: Request) => Response | Promise<Response>

export interface MaridAuth {
  handle(request: Request, next: Next): Promise<Response>
}

export interface MaridAuthDeps {
  tokens: TokenStore
  ownership: OwnershipStore
  bindings: BindingStore
  audit: AuditLog
  limiter: RateLimiter
}

// Extract the bearer token from the Authorization header. Accept it via BOTH schemes:
//   Bearer <token>                     — the TUI/SDK/API and Telegram gateway
//   Basic  base64("<user>:<token>")    — the upstream web UI (utils/server.ts) can only
//                                         send Basic; it puts the token in the password.
// Same token, same scope/audit/rate-limit — Basic is just the transport the web client
// speaks. No weaker: Basic base64 is not encryption, but neither is a plaintext Bearer;
// both are equally exposed off-loopback, and the token is still required.
function bearer(request: Request): string | undefined {
  const header = request.headers.get("authorization")
  if (!header) return undefined
  const [scheme, value] = header.split(" ")
  if (!value) return undefined
  const lower = scheme?.toLowerCase()
  if (lower === "bearer") return value
  if (lower === "basic") {
    const decoded = Buffer.from(value, "base64").toString("utf8")
    const sep = decoded.indexOf(":")
    return (sep === -1 ? decoded : decoded.slice(sep + 1)) || undefined
  }
  return undefined
}

function isStream(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("text/event-stream")
}

// The two run-triggering routes a channel token is allowed to POST (scope.ts denies
// /shell, /command, etc. for channel). These are where an agent can be selected, so
// they are the ones the bound-agent guard inspects.
function isChannelRunRoute(method: string, pathname: string): boolean {
  if (method.toUpperCase() !== "POST") return false
  const segments = pathname.split("/").filter(Boolean)
  return segments[0] === "session" && segments.length === 3 && (segments[2] === "message" || segments[2] === "prompt_async")
}

// PH-4 (WBS-4.4, INV-001) by-construction backstop. `scope.ts` cannot see the
// request body; this does. A channel token may run ONLY its bound agent, and may
// not smuggle a wider tool/permission set past the restricted agent's config
// ruleset. Reading a clone leaves the original body intact for `next`. Returns a
// 403 to send (and audit as a deny), or undefined to proceed.
async function channelAgentDenial(request: Request, agent: string | undefined, requestId: string): Promise<Response | undefined> {
  const body = (await request
    .clone()
    .json()
    .catch(() => undefined)) as Record<string, unknown> | undefined
  if (!agent || body?.agent !== agent) {
    return errorResponse(403, "ForbiddenError", "channel token must prompt with its bound agent", requestId)
  }
  if (body && ("tools" in body || "permission" in body)) {
    return errorResponse(403, "ForbiddenError", "channel token may not override tools or permission", requestId)
  }
  return undefined
}

function strippedHeaders(source: Headers, remove: string): Headers {
  const headers = new Headers(source)
  headers.delete(remove)
  return headers
}

function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers)
  headers.set(REQUEST_ID_HEADER, requestId)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

// Echo Access-Control-Allow-Origin on marid-auth's OWN responses (its 401/403/429
// errors). Without it a cross-origin browser client (the web UI) sees an opaque CORS
// failure — "No Access-Control-Allow-Origin header" — instead of a readable 401, and
// cannot tell it simply needs a token. Upstream success/SSE responses already carry the
// header, so we only add it when absent (never double-set); a streaming body passes as-is.
//
// Deliberately NO Access-Control-Allow-Credentials: this is a Bearer-token API — the web
// client sends the token in a manual Authorization header, which is NOT a CORS "credential"
// (cookies/TLS certs are), so credentials mode is never used. Reflecting the Origin without
// credentials is safe: a hostile cross-origin page cannot present the secret bearer token,
// so it can only ever read a 401, never authenticated data — and enabling Allow-Credentials
// alongside a reflected Origin would be the classic exploitable CORS hole. Don't add it.
function withCors(response: Response, request: Request): Response {
  const origin = request.headers.get("origin")
  if (!origin || response.headers.has("access-control-allow-origin")) return response
  const headers = new Headers(response.headers)
  headers.set("access-control-allow-origin", origin)
  headers.append("vary", "Origin")
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

// Free the SSE slot exactly once when the stream ends, is cancelled, or the
// client disconnects (request.signal aborts). release() is idempotent.
function trackStream(response: Response, release: () => void, signal: AbortSignal): Response {
  if (!response.body) {
    release()
    return response
  }
  const reader = response.body.getReader()
  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }))
      if (done) {
        controller.close()
        release()
        return
      }
      controller.enqueue(value)
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {})
      release()
    },
  })
  signal.addEventListener("abort", () => reader.cancel().catch(() => {}), { once: true })
  return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers })
}

export function createMaridAuth(deps: MaridAuthDeps): MaridAuth {
  const run: MaridAuth["handle"] = async (request, next) => {
      // CORS preflight: browsers send OPTIONS with NO credentials (the CORS spec forbids them),
      // so it can never carry a token. Delegate straight to the upstream handler, which answers
      // the preflight with the Access-Control-Allow-* headers. A preflight returns no data and
      // has no side effects; the actual credentialed request that follows is still authenticated.
      // Without this, marid-auth 401s the preflight and the browser blocks every request (the web
      // UI cannot reach the server at all).
      if (request.method === "OPTIONS") return next(request)
      const requestId = resolveRequestId(request)
      const url = new URL(request.url)
      const session = sessionFromPathname(url.pathname)
      // Audit lines carry the session for session-scoped routes (contract §"Audit log").
      const record = (token: string, decision: Decision): Promise<void> =>
        deps.audit.append({ token, route: url.pathname, session, decision, requestId })

      const secret = bearer(request)
      if (!secret) {
        await record("-", "deny")
        return errorResponse(401, "UnauthorizedError", "missing bearer token", requestId)
      }
      const token = await deps.tokens.verify(secret)
      if (!token) {
        await record("-", "deny")
        return errorResponse(401, "UnauthorizedError", "invalid bearer token", requestId)
      }

      const rateLimited = async (retryAfter: number): Promise<Response> => {
        await record(token.name, "429")
        return errorResponse(429, "RateLimitedError", "rate limit exceeded", requestId, {
          "retry-after": String(retryAfter),
        })
      }

      // SSE streams are exempt from the request bucket but capped per token; a
      // normal request draws from the token-bucket. (api-event-contract §"Rate limiting")
      const stream = isStream(request)
      let releaseStream: () => void = () => {}
      if (stream) {
        const gate = deps.limiter.openStream(token.name)
        if (!gate.ok) return rateLimited(gate.retryAfter)
        releaseStream = gate.close
      } else {
        const gate = deps.limiter.take(token.name)
        if (!gate.ok) return rateLimited(gate.retryAfter)
      }

      // Marid gateway routes (WBS-6.1b): admin-gated attach/detach/bindings, served entirely
      // here — they never reach the upstream handler, and are not upstream session routes, so
      // they short-circuit before ownership/authorize. releaseStream is a no-op unless a
      // client sent Accept: text/event-stream on one of these (defensive — they aren't SSE).
      if (isGatewayRoute(url.pathname)) {
        releaseStream()
        const res = await handleGatewayRoute({
          request,
          pathname: url.pathname,
          method: request.method,
          scope: token.scope,
          tokenName: token.name,
          requestId,
          bindings: deps.bindings,
        })
        await record(token.name, res.status >= 200 && res.status < 300 ? "allow" : "deny")
        return res
      }

      const owned = await deps.ownership.list(token.name)
      const decision = authorize({
        scope: token.scope,
        method: request.method,
        pathname: url.pathname,
        owns: (id) => owned.has(id),
      })
      if (!decision.allow) {
        releaseStream()
        await record(token.name, "deny")
        return errorResponse(403, "ForbiddenError", "token scope forbids this route", requestId)
      }

      // Channel tokens: even on an allowed prompt route, enforce the bound agent and
      // block tool/permission widening (WBS-4.4, INV-001). Run routes are POST, so no
      // stream was opened here.
      if (token.scope.startsWith("channel:") && isChannelRunRoute(request.method, url.pathname)) {
        const denial = await channelAgentDenial(request, token.agent, requestId)
        if (denial) {
          await record(token.name, "deny")
          return denial
        }
      }

      // Strict client-scope isolation (deferred PH-1 follow-up, now resolved): a
      // non-admin token sees only its own sessions' data — on the `/event` firehose
      // and on the `GET /session` / `GET /permission` list routes. Admin is never
      // filtered. Each list route names its owning session differently: a session
      // by its own `id`, a permission by its `sessionID`.
      const isolate = token.scope !== "admin"
      const owns = (id: string): boolean => owned.has(id)
      const listPick =
        request.method === "GET" && url.pathname === "/session"
          ? pickSessionId
          : request.method === "GET" && url.pathname === "/permission"
            ? pickPermissionSessionId
            : undefined

      // GET /doc is augmented on the way out with the Marid gateway's OpenAPI fragment
      // (WBS-6.1b, EXP-014). Strip accept-encoding so upstream returns plain JSON — a
      // gzipped spec (>1KB) would be opaque to the merge, exactly like the list routes.
      const isDoc = request.method === "GET" && url.pathname === "/doc"

      // Upstream gzips JSON >=1KB when the request allows it, and a compressed body
      // is opaque to the filter. Strip accept-encoding on the routes we rewrite so
      // upstream returns plain JSON. (SSE is never compressed, so /event needs none.)
      const delegated =
        ((isolate && listPick !== undefined) || isDoc) && request.headers.has("accept-encoding")
          ? new Request(request, { headers: strippedHeaders(request.headers, "accept-encoding") })
          : request

      const response = await Promise.resolve(next(delegated)).catch((cause: unknown) => {
        releaseStream()
        throw cause
      })

      // Record ownership from the created session id (2xx create response).
      if (decision.recordSession && response.status >= 200 && response.status < 300) {
        const id = await response
          .clone()
          .json()
          .then((body: unknown) => {
            const value = (body as { id?: unknown } | null)?.id
            return typeof value === "string" ? value : undefined
          })
          .catch(() => undefined)
        if (id) await deps.ownership.record(token.name, id)
      }

      await record(token.name, "allow")

      if (stream) {
        // Full bidirectional mirroring (WBS-6.3/6.1b, ADR-0012): a token sees frames of
        // sessions it OWNS plus sessions the operator has explicitly ATTACHED it to
        // (the binding registry). VIEW-via-binding lives here, on BOTH SSE firehoses:
        //   /event         — the per-instance stream, RAW frames (owningSession).
        //   /global/event  — the cross-instance stream that web + TUI + the channel all
        //                    ride, ROUTING-WRAPPED frames incl. durable sync twins
        //                    (owningSessionGlobal). It was UNFILTERED for every non-admin
        //                    token — a pre-existing INV-001 gap (WBS-6.1b) — and the same
        //                    owns∪bound filter closes it AND delivers mirroring.
        // The ACTING gate (authorize/scope.ts) and the list routes stay on `owns` alone,
        // so a bound surface can view but never approve/prompt a session it does not own
        // (act-via-ownership, INV-001 — EXP-008). Binding I/O is confined to the subscribe,
        // and a registry fault degrades to owns-only (RISK-024).
        let filtered = response
        const pickFrame =
          url.pathname === "/event" ? owningSession : url.pathname === "/global/event" ? owningSessionGlobal : undefined
        if (isolate && pickFrame && response.body) {
          const bound = await deps.bindings.list(token.name).catch(() => new Set<string>())
          const isVisible = (id: string): boolean => owns(id) || bound.has(id)
          filtered = new Response(filterSseStream(response.body, isVisible, pickFrame), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          })
        }
        return withRequestId(trackStream(filtered, releaseStream, request.signal), requestId)
      }

      if (isolate && listPick && response.status >= 200 && response.status < 300) {
        const original = await response.clone().text().catch(() => undefined)
        if (original !== undefined) {
          const headers = new Headers(response.headers)
          headers.delete("content-length") // body length changes; let the runtime recompute
          headers.delete("content-encoding") // upstream was told not to compress; drop any stale marker
          const body = await filterOwnedArray(original, listPick, owns)
          return withRequestId(new Response(body, { status: response.status, statusText: response.statusText, headers }), requestId)
        }
      }

      if (isDoc && response.status >= 200 && response.status < 300) {
        return withRequestId(await augmentDoc(response), requestId)
      }

      return withRequestId(response, requestId)
  }
  return {
    handle: async (request, next) => withCors(await run(request, next), request),
  }
}
