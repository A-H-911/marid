import type { BindingStore } from "./binding"
import { errorResponse, jsonResponse } from "./http"

// Marid gateway routes (WBS-6.1 slice b, ADR-0011/0012): the operator-reachable surface
// that writes the session↔surface binding registry, making explicit-attach mirroring live.
// Served ENTIRELY by the marid-auth wrapper (these never reach the upstream handler) and
// admin-scope ONLY — a `channel:` token attaching itself to an arbitrary session would
// defeat explicit-attach (a restricted channel could self-observe a privileged session),
// which is the INV-001 landmine ADR-0012 calls out. So "operator explicitly attaches" is an
// admin-surface action (TUI/CLI/web), never a channel-typed command.

const GATEWAY_ROUTES = new Set(["/marid/attach", "/marid/detach", "/marid/bindings"])

export function isGatewayRoute(pathname: string): boolean {
  return GATEWAY_ROUTES.has(pathname)
}

function stringField(body: unknown, key: string): string | undefined {
  const value = (body as Record<string, unknown> | null | undefined)?.[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

// Handle an admin-gated /marid/* route. `scope` is the verified token's scope; the caller
// (middleware) has already authenticated and rate-limited. Returns the full Response.
export async function handleGatewayRoute(input: {
  request: Request
  pathname: string
  method: string
  scope: string
  requestId: string
  bindings: BindingStore
}): Promise<Response> {
  const { requestId } = input
  if (input.scope !== "admin") {
    return errorResponse(403, "ForbiddenError", "gateway routes require admin scope", requestId)
  }
  const method = input.method.toUpperCase()

  if (input.pathname === "/marid/bindings") {
    if (method !== "GET") return errorResponse(405, "MethodNotAllowedError", "GET only", requestId)
    const token = new URL(input.request.url).searchParams.get("token")
    if (!token) return errorResponse(400, "BadRequestError", "missing token query param", requestId)
    const sessions = [...(await input.bindings.list(token))]
    return jsonResponse(200, { token, sessions }, requestId)
  }

  // attach / detach
  if (method !== "POST") return errorResponse(405, "MethodNotAllowedError", "POST only", requestId)
  const body = (await input.request.json().catch(() => undefined)) as unknown
  const token = stringField(body, "token")
  const session = stringField(body, "session")
  if (!token || !session) {
    return errorResponse(400, "BadRequestError", "attach/detach require string token and session", requestId)
  }
  if (input.pathname === "/marid/attach") {
    await input.bindings.attach(token, session)
    return jsonResponse(200, { attached: true, token, session }, requestId)
  }
  await input.bindings.detach(token, session)
  return jsonResponse(200, { detached: true, token, session }, requestId)
}

// The OpenAPI fragment for the gateway routes, merged into the intercepted GET /doc
// response (EXP-014). Hand-authored (no effect dependency — marid-auth stays dependency-
// free) with INLINE schemas, so there are no component-name collisions with the upstream
// spec. TEST-CONTRACT pins it against the served handlers above.
const stringSchema = { type: "string" } as const
const attachBody = {
  required: true,
  content: {
    "application/json": {
      schema: { type: "object", required: ["token", "session"], properties: { token: stringSchema, session: stringSchema } },
    },
  },
}
const okObject = (properties: Record<string, unknown>) => ({
  description: "OK",
  content: { "application/json": { schema: { type: "object", properties } } },
})
const MARID_GATEWAY_DOC_PATHS: Record<string, unknown> = {
  "/marid/attach": {
    post: {
      summary: "Attach a session to a channel surface",
      description: "Admin-only. Binds a channel token to a session so the surface mirrors it (ADR-0012).",
      requestBody: attachBody,
      responses: {
        "200": okObject({ attached: { type: "boolean" }, token: stringSchema, session: stringSchema }),
        "400": { description: "Invalid body" },
        "403": { description: "Not admin scope" },
      },
    },
  },
  "/marid/detach": {
    post: {
      summary: "Detach a session from a channel surface",
      description: "Admin-only. Removes a session↔surface binding.",
      requestBody: attachBody,
      responses: {
        "200": okObject({ detached: { type: "boolean" }, token: stringSchema, session: stringSchema }),
        "400": { description: "Invalid body" },
        "403": { description: "Not admin scope" },
      },
    },
  },
  "/marid/bindings": {
    get: {
      summary: "List the sessions bound to a channel surface",
      description: "Admin-only. Returns the sessions the given channel token is attached to.",
      parameters: [{ name: "token", in: "query", required: true, schema: stringSchema }],
      responses: {
        "200": okObject({ token: stringSchema, sessions: { type: "array", items: stringSchema } }),
        "403": { description: "Not admin scope" },
      },
    },
  },
}

// Merge the gateway paths into an upstream OpenAPI spec response. Only ADDS paths (never
// re-runs the upstream transform); leaves non-2xx / unparseable bodies untouched. The
// caller strips accept-encoding before delegating so the upstream body is plain JSON — a
// gzipped /doc (JSON >1KB) would be opaque to this merge (same reason the list routes strip it).
export async function augmentDoc(response: Response): Promise<Response> {
  if (response.status < 200 || response.status >= 300) return response
  const spec = (await response.clone().json().catch(() => undefined)) as { paths?: Record<string, unknown> } | undefined
  if (!spec || typeof spec !== "object" || !spec.paths || typeof spec.paths !== "object") return response
  spec.paths = { ...spec.paths, ...MARID_GATEWAY_DOC_PATHS }
  const headers = new Headers(response.headers)
  headers.delete("content-length") // body length changes; let the runtime recompute
  headers.delete("content-encoding") // upstream was told not to compress; drop any stale marker
  return new Response(JSON.stringify(spec), { status: response.status, statusText: response.statusText, headers })
}
