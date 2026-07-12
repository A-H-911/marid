import path from "node:path"
import { Global } from "@opencode-ai/core/global"
import {
  createAuditLog,
  createBindingStore,
  createMaridAuth,
  createOwnershipStore,
  createRateLimiter,
  createTokenStore,
} from "@marid/gateway"
import { Server } from "../server/server"

// Per-instance marid state lives under the instance data dir (XDG-driven, set
// per instance by marid-instance in PH-2). tokens.json / ownership.json /
// binding.json / audit/ all sit here at 0600.
export function maridDir(): string {
  return path.join(Global.Path.data, "marid")
}

// The EXP-004 seam: marid-auth runs as an outer middleware and delegates
// authorized requests to the exported, self-contained v1 handler
// (`Server.Default().app.fetch`) — no upstream server edit.
export function createMaridHandler(dir: string): (request: Request) => Promise<Response> {
  // marid-auth IS the auth layer. Disable upstream ingress auth so the delegated
  // v1 handler does not ALSO demand Basic auth and reject valid Bearer requests.
  // Must run before the first `Server.Default()` (lazy) builds its config layer.
  delete process.env.OPENCODE_SERVER_PASSWORD

  const auth = createMaridAuth({
    tokens: createTokenStore(dir),
    ownership: createOwnershipStore(dir),
    bindings: createBindingStore(dir),
    audit: createAuditLog(dir),
    limiter: createRateLimiter(),
  })
  // oxlint-disable-next-line typescript-eslint/unbound-method -- `app.fetch` is a standalone arrow (no `this`); safe to extract.
  const upstream = Server.Default().app.fetch
  return (request) => auth.handle(request, upstream)
}

export interface MaridServer {
  hostname: string
  port: number
  url: string
  stop: () => void
}

export function maridServe(opts: { hostname: string; port: number; dir?: string }): MaridServer {
  const handler = createMaridHandler(opts.dir ?? maridDir())
  // idleTimeout: 0 — disable Bun's default 10s idle timeout. The v1 API's SSE stream
  // (GET /event, /global/event) idles between events; the 10s default closes it, the
  // client treats the close as an error and reconnect-loops, spamming "event stream
  // error" in the web UI (and needlessly re-subscribing every client). SSE must stay open.
  const server = Bun.serve({ hostname: opts.hostname, port: opts.port, idleTimeout: 0, fetch: handler })
  return {
    hostname: server.hostname ?? opts.hostname,
    port: server.port ?? Number(server.url.port),
    url: server.url.href,
    stop: () => server.stop(true),
  }
}
