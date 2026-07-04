import type { Scope } from "./token"

// api-event-contract §"AuthZ scopes":
//   admin           — everything
//   client          — sessions it created + its own events
//   channel:<name>  — its channel's dedicated agent/policy/sessions (PH-4 wires policy)
//
// This runs at the HTTP-ingress wrapper (EXP-004 seam), so it enforces what a
// method+path can express: per-session *route* ownership. It deliberately does
// NOT body-filter the global `/event` firehose or the `GET /session` list —
// that is stream/body rewriting inside the Effect pipeline, the same seam
// boundary EXP-004 left as a documented limitation. Client interpretation:
// restricted on session *data* (cannot touch sessions it doesn't own), but may
// read config/agents/providers and subscribe to the event stream so it can
// function. A stricter client is a follow-up, not silently assumed here.

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
export function sessionFromPathname(pathname: string): string | undefined {
  const segments = segmentsOf(pathname)
  return segments[0] === "session" && segments.length >= 2 ? segments[1] : undefined
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
  // owning it, a fork spawns a new child session whose id must be recorded too
  return creates ? CREATE : ALLOW
}
