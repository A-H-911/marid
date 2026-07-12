import type { Scope } from "./token"

// api-event-contract §"AuthZ scopes":
//   admin           — everything
//   client          — sessions it created + its own events
//   channel:<name>  — its channel's dedicated agent/policy/sessions
//
// This runs at the HTTP-ingress wrapper (EXP-004 seam), so it enforces what a
// method+path can express: per-session *route* ownership. Body-level isolation —
// dropping other sessions' frames from the `/event` firehose and other sessions'
// entries from the `GET /session` and `GET /permission` lists — is done by the
// middleware via event-filter.ts (those routes are ALLOWed here, then filtered on
// the way out). So a non-admin client cannot touch, observe, or enumerate the
// sessions/permissions of sessions it doesn't own, yet may still read
// config/agents/providers and stream its own sessions' events.
//
// PH-4 (WBS-4.4, INV-001): a `channel:` token is STRICTER than `client`. Owning a
// session is necessary but no longer sufficient — a channel token may reach only a
// minimal deny-by-default sub-route set (read the session/history, prompt, abort,
// reply to a permission). Everything else on an owned session — crucially
// `/shell` and `/command` (direct execution), plus `/revert`, `/init`, `/share`,
// `/summarize`, `/fork`, message-part mutation — is DENIED at this boundary, so an
// untrusted channel cannot escape its restricted agent by calling a non-prompt run
// route. The bound-agent check on the prompt body itself is enforced in
// middleware.ts (which can see the body; this function cannot).
//
// Residual (documented): POST /permission/:requestID/reply is keyed by an opaque
// per_ id, not a sessionID, so the wrapper cannot ownership-gate it without a
// requestID→session map. It stays route-allowed; the filtered GET /permission no
// longer discloses other sessions' requestIDs, so replying requires an id learned
// out-of-band. The channel gateway uses the ownership-gated session-scoped reply
// route (`/session/:id/permissions/:pid`) instead. Full flat-reply gating is a
// follow-up (needs in-pipeline knowledge).

export type Authorization =
  | { allow: true; recordSession?: boolean }
  | { allow: false }

const ALLOW: Authorization = { allow: true }
const CREATE: Authorization = { allow: true, recordSession: true }
const DENY: Authorization = { allow: false }

function segmentsOf(pathname: string): string[] {
  return pathname.split("/").filter(Boolean)
}

// The target session id of a request, or undefined for the /session root or any
// non-session route. Segments: "/session/ses_x/message" → ["session","ses_x",...]
//
// Only a real session id (`ses_`-prefixed) is session-scoped. Literal sub-routes
// like `/session/status` (a directory-status meta route the web UI hits at
// bootstrap) are NOT a session — without this guard "status" was read as a
// session id, hit the ownership gate, and 403'd for every non-admin token,
// breaking the web UI on connect. Non-id second segments fall through to the
// non-session allow path, exactly like `GET /session`.
export function sessionFromPathname(pathname: string): string | undefined {
  const segments = segmentsOf(pathname)
  if (segments[0] !== "session" || segments.length < 2) return undefined
  return segments[1].startsWith("ses_") ? segments[1] : undefined
}

// The two session-*creating* ops in SessionPaths: create (POST /session) and
// fork/branch (POST /session/:id/fork). Both return a NEW Session.Info.id in the
// body, which the middleware records as owned. `init` mutates an existing
// session, so it is not one.
function createsSession(method: string, segments: string[]): boolean {
  if (method.toUpperCase() !== "POST" || segments[0] !== "session") return false
  if (segments.length === 1) return true // create
  return segments[segments.length - 1] === "fork" // fork/branch
}

// The only /session/:id/* sub-routes a `channel:` token may reach (INV-001,
// deny-by-default). `sub` is the path after ["session", id]. Everything not listed
// — /shell, /command, /revert, /unrevert, /init, /share, /summarize, /fork,
// /children, /todo, /diff, message-part mutation — is denied.
function channelOwnedRouteAllowed(method: string, sub: string[]): boolean {
  const m = method.toUpperCase()
  if (sub.length === 0) return m === "GET" // GET /session/:id (read the session)
  if (sub[0] === "message") {
    if (sub.length === 1) return m === "GET" || m === "POST" // history | sync prompt
    if (sub.length === 2) return m === "GET" // read one message; deny deeper part mutation
    return false
  }
  if (sub[0] === "prompt_async" && sub.length === 1) return m === "POST" // async prompt
  if (sub[0] === "abort" && sub.length === 1) return m === "POST" // cancel a run
  if (sub[0] === "permissions" && sub.length === 2) return m === "POST" // reply to a pending permission
  return false
}

export function authorize(input: {
  scope: Scope
  method: string
  pathname: string
  owns: (sessionID: string) => boolean
}): Authorization {
  if (input.scope === "admin") return ALLOW

  const segments = segmentsOf(input.pathname)
  const session = sessionFromPathname(input.pathname)
  const creates = createsSession(input.method, segments)

  // /session root: create records ownership; list (GET) is allowed (see caveat above)
  if (session === undefined) {
    if (segments[0] === "session" && creates) return CREATE // POST /session
    return ALLOW // non-session route (config, agents, providers, event stream, meta)
  }

  // /session/:id/* — gated by ownership of the (parent) session
  if (!input.owns(session)) return DENY

  // Channel scope is deny-by-default on owned-session sub-routes (INV-001): only the
  // minimal read/prompt/permission set, never shell/command/fork/etc. A channel
  // never forks, so no CREATE is recorded here.
  if (input.scope.startsWith("channel:")) {
    return channelOwnedRouteAllowed(input.method, segments.slice(2)) ? ALLOW : DENY
  }

  // client: owning it, a fork spawns a new child session whose id must be recorded too
  return creates ? CREATE : ALLOW
}
