import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { ServerConnection } from "@/context/server"
import { decode64 } from "@/utils/base64"

export function authTokenFromCredentials(input: { username?: string; password: string }) {
  return btoa(`${input.username ?? "opencode"}:${input.password}`)
}

export function authFromToken(token: string | null) {
  const decoded = decode64(token ?? undefined)
  if (!decoded) return
  const separator = decoded.indexOf(":")
  if (separator === -1) return
  return {
    username: decoded.slice(0, separator) || "opencode",
    password: decoded.slice(separator + 1),
  }
}

// Marid (P-9): a secured local gateway needs a token on every request. The token arrives once via
// `?auth_token=` and is held only in the boot server's in-memory `http.password`. A connection
// re-resolved from just its URL key (e.g. a persisted/rediscovered local server the app navigates
// into after the first prompt) loses it → 401 → the app flips to the Unauthorized gate even though
// the operator supplied a valid token. Persist the token for the tab session and fall back to it for
// any loopback connection missing a password, so auth survives navigation. Loopback-only keeps the
// token off remote (desktop) servers; the `!password` guard means a local server with its own
// explicit password is untouched. sessionStorage (not localStorage) scopes it to the tab.
const AUTH_STORAGE_KEY = "marid.auth"

export function persistServerAuth(token: string) {
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, token)
  } catch {}
}

function persistedServerAuth(): string | undefined {
  try {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function isLoopbackUrl(url: string) {
  try {
    // URL parsing brackets IPv6 hosts (`[::1]`); accept both forms.
    const host = new URL(url).hostname
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]"
  } catch {
    return false
  }
}

export function createSdkForServer({
  server,
  ...config
}: Omit<NonNullable<Parameters<typeof createOpencodeClient>[0]>, "baseUrl"> & {
  server: ServerConnection.HttpBase
}) {
  const auth = (() => {
    if (server.password)
      return {
        Authorization: `Basic ${authTokenFromCredentials({ username: server.username, password: server.password })}`,
      }
    if (isLoopbackUrl(server.url)) {
      const persisted = persistedServerAuth()
      if (persisted) return { Authorization: `Basic ${persisted}` }
    }
    return
  })()

  return createOpencodeClient({
    ...config,
    headers: {
      ...(config.headers instanceof Headers ? Object.fromEntries(config.headers.entries()) : config.headers),
      ...auth,
    },
    baseUrl: server.url,
  })
}
