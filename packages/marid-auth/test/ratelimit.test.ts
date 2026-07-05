import { describe, expect, test } from "bun:test"
import { createRateLimiter, RATE_BURST, RATE_PER_SEC, SSE_MAX_PER_TOKEN } from "../src/ratelimit"

describe("rate limiter (token bucket, contract defaults)", () => {
  test("allows a burst up to capacity then 429s", () => {
    let now = 1_000
    const rl = createRateLimiter({ now: () => now })
    for (let i = 0; i < RATE_BURST; i++) {
      expect(rl.take("a").ok).toBe(true)
    }
    const denied = rl.take("a")
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.retryAfter).toBeGreaterThan(0)
  })

  test("refills at RATE_PER_SEC over time", () => {
    let now = 0
    const rl = createRateLimiter({ now: () => now })
    for (let i = 0; i < RATE_BURST; i++) rl.take("a")
    expect(rl.take("a").ok).toBe(false)
    now += 1000 // one second → RATE_PER_SEC tokens back
    for (let i = 0; i < RATE_PER_SEC; i++) expect(rl.take("a").ok).toBe(true)
    expect(rl.take("a").ok).toBe(false)
  })

  test("buckets are independent per token name", () => {
    let now = 0
    const rl = createRateLimiter({ now: () => now })
    for (let i = 0; i < RATE_BURST; i++) rl.take("a")
    expect(rl.take("a").ok).toBe(false)
    expect(rl.take("b").ok).toBe(true) // b untouched
  })

  test("SSE streams are exempt from the bucket but capped per token", () => {
    let now = 0
    const rl = createRateLimiter({ now: () => now })
    for (let i = 0; i < RATE_BURST; i++) rl.take("a") // drain the request bucket
    // streams still open despite an empty request bucket (exempt)
    const streams = []
    for (let i = 0; i < SSE_MAX_PER_TOKEN; i++) {
      const s = rl.openStream("a")
      expect(s.ok).toBe(true)
      if (s.ok) streams.push(s)
    }
    const over = rl.openStream("a")
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.retryAfter).toBeGreaterThan(0)

    // closing one frees a slot
    streams[0].close()
    expect(rl.openStream("a").ok).toBe(true)
  })
})
