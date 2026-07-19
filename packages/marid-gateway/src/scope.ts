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
// PH-4 (WBS-4.4, INV-001): a `channel:` token is STRICTER than `client` on BOTH
// axes. (1) On an OWNED session, owning it is necessary but not sufficient — only a
// minimal deny-by-default sub-route set is reachable (read the session/history,
// prompt, abort, reply to a permission); everything else — crucially `/shell` and
// `/command` (direct execution), plus `/revert`, `/init`, `/share`, `/summarize`,
// `/fork`, message-part mutation — is DENIED. (2) On NON-session (top-level) routes,
// a channel is likewise deny-by-default (`channelNonSessionAllowed`): only read-only
// meta + the filtered firehoses/lists, never the top-level `/pty` shell surface
// (POST /pty spawns an OS shell; /pty/:id/connect drives it) or any other top-level
// execution/mutation route. Before ADR-0020 (2026-07-19) a channel inherited the
// client blanket non-session ALLOW, so `/pty` was reachable — a realized INV-001
// breach (RISK-026). The bound-agent check on the prompt body itself is enforced in
// middleware.ts (which can see the body; this function cannot).
//
// The flat POST /permission/:requestID/reply route (opaque per_ id, no sessionID the
// wrapper can ownership-gate) is now a non-session POST, so it is DENIED for channel
// scope by (2) above — closing the old "route-allowed" residual for the untrusted
// case. The channel gateway uses the ownership-gated session-scoped reply route
// (`/session/:id/permissions/:pid`). Flat-reply gating for `client` scope (which keeps
// blanket non-session ALLOW as the operator's own credential) remains a follow-up
// (deferred-work #2 — needs a requestID→session map / in-pipeline knowledge).

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

// The only NON-session routes a `channel:` token may reach (INV-001, deny-by-default).
// A channel is untrusted ingress, so — unlike a `client` token, which gets blanket
// non-session ALLOW — it may reach ONLY read-only meta + the (filtered) firehoses and
// permission/session lists. Everything else at the top level is DENIED, crucially the
// `/pty` shell surface (POST /pty spawns an OS shell; /pty/:id/connect drives it) and
// any other top-level execution/mutation route (/file, /tui, /mcp, /command,
// /experimental, /project, /instance, ...). `POST /session` (create) is handled by the
// createsSession branch in authorize(), before this runs.
function channelNonSessionAllowed(method: string, segments: string[]): boolean {
  if (method.toUpperCase() !== "GET") return false // no non-session mutation except create
  if (segments.length === 0) return true // GET / (root / health)
  const top = segments[0]
  // /global/event — the cross-instance firehose the channel rides for mirroring (body
  // filtered owns∪bound in middleware.ts, so route-allowing it leaks nothing).
  if (top === "global" && segments[1] === "event" && segments.length === 2) return true
  if (top === "session") {
    if (segments.length === 1) return true // GET /session (list; body-filtered)
    if (segments.length === 2 && segments[1] === "status") return true // meta, not a session
    return false
  }
  // Single-segment read-only meta/list routes (mirror the client meta set): config,
  // agents, providers, the per-instance event firehose, the filtered permission list,
  // the OpenAPI doc, and health/status.
  const metaGet = ["config", "agent", "provider", "event", "permission", "doc", "status"]
  return segments.length === 1 && metaGet.includes(top)
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
    // Channel scope is deny-by-default on NON-session routes too (INV-001): only the
    // read-only meta/firehose allowlist, never the top-level /pty shell surface or any
    // other top-level execution/mutation route. `client` stays blanket-allowed here — it
    // is the operator's own trusted credential (the TUI/web /pty terminal uses it).
    if (input.scope.startsWith("channel:")) {
      return channelNonSessionAllowed(input.method, segments) ? ALLOW : DENY
    }
    return ALLOW // client/other non-session route (config, agents, providers, event stream, meta)
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
