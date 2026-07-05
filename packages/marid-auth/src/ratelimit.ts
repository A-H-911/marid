// Rate-limit defaults are fixed by the api-event-contract (§"Rate limiting"):
// token-bucket per token, 10 req/s burst 30; SSE connections exempt from the
// bucket but capped per token at 4. Contract-fixed → constants, not config.
export const RATE_PER_SEC = 10
export const RATE_BURST = 30
export const SSE_MAX_PER_TOKEN = 4
const SSE_RETRY_AFTER = 1

export type RateResult = { ok: true } | { ok: false; retryAfter: number }
export type StreamResult = { ok: true; close: () => void } | { ok: false; retryAfter: number }

export interface RateLimiter {
  take(tokenName: string): RateResult
  openStream(tokenName: string): StreamResult
}

interface Bucket {
  tokens: number
  last: number
}

export function createRateLimiter(opts?: { now?: () => number }): RateLimiter {
  const now = opts?.now ?? Date.now
  const buckets = new Map<string, Bucket>()
  const streams = new Map<string, number>()

  const refill = (name: string): Bucket => {
    const at = now()
    const bucket = buckets.get(name) ?? { tokens: RATE_BURST, last: at }
    const gained = ((at - bucket.last) / 1000) * RATE_PER_SEC
    bucket.tokens = Math.min(RATE_BURST, bucket.tokens + gained)
    bucket.last = at
    buckets.set(name, bucket)
    return bucket
  }

  return {
    take(name) {
      const bucket = refill(name)
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1
        return { ok: true }
      }
      // seconds until the bucket holds one whole token again
      return { ok: false, retryAfter: Math.ceil((1 - bucket.tokens) / RATE_PER_SEC) }
    },
    openStream(name) {
      const open = streams.get(name) ?? 0
      if (open >= SSE_MAX_PER_TOKEN) return { ok: false, retryAfter: SSE_RETRY_AFTER }
      streams.set(name, open + 1)
      let closed = false
      return {
        ok: true,
        close: () => {
          if (closed) return
          closed = true
          streams.set(name, Math.max(0, (streams.get(name) ?? 1) - 1))
        },
      }
    },
  }
}
