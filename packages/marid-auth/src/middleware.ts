import type { AuditLog, Decision } from "./audit"
import type { OwnershipStore } from "./ownership"
import type { RateLimiter } from "./ratelimit"
import { authorize, sessionFromPathname } from "./scope"
import { REQUEST_ID_HEADER, resolveRequestId } from "./request-id"
import type { TokenStore } from "./token"

export type Next = (request: Request) => Response | Promise<Response>

export interface MaridAuth {
  handle(request: Request, next: Next): Promise<Response>
}

export interface MaridAuthDeps {
  tokens: TokenStore
  ownership: OwnershipStore
  audit: AuditLog
  limiter: RateLimiter
}

function bearer(request: Request): string | undefined {
  const header = request.headers.get("authorization")
  if (!header) return undefined
  const [scheme, token] = header.split(" ")
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined
  return token
}

function isStream(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("text/event-stream")
}

function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers)
  headers.set(REQUEST_ID_HEADER, requestId)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

// Upstream structured errors pass through; marid-auth failures use the same
// shape (api-event-contract §"Errors"): { name, message, requestId }.
function errorResponse(
  status: number,
  name: string,
  message: string,
  requestId: string,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ name, message, requestId }), {
    status,
    headers: { "content-type": "application/json", [REQUEST_ID_HEADER]: requestId, ...extra },
  })
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
  return {
    async handle(request, next) {
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

      const response = await Promise.resolve(next(request)).catch((cause: unknown) => {
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
      if (stream) return withRequestId(trackStream(response, releaseStream, request.signal), requestId)
      return withRequestId(response, requestId)
    },
  }
}
