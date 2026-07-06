import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { dispatchUpdate, type DispatchDeps } from "../src/router"
import { createDedup } from "../src/dedup"
import type { TgCallbackQuery, TgMessage, TgUpdate } from "../src/telegram"

// AC-010 (INV-001): a non-allowlisted Telegram user creates no session and gets
// no answer — the attempt is logged and dropped. The handlers are the only route
// to the SDK/bot, so asserting they are never called proves "no session, no reply".

function harness(allow: number[]) {
  const messages: TgMessage[] = []
  const callbacks: TgCallbackQuery[] = []
  const logs: string[] = []
  return {
    messages,
    callbacks,
    logs,
    make(file: string): DispatchDeps {
      return {
        allow: new Set(allow),
        dedup: createDedup(file),
        log: (line) => logs.push(line),
        onMessage: async (m) => void messages.push(m),
        onCallback: async (c) => void callbacks.push(c),
      }
    },
  }
}

const OPERATOR = 111
const STRANGER = 999

const messageFrom = (userId: number, updateId: number, text = "hi"): TgUpdate => ({
  update_id: updateId,
  message: { message_id: updateId, from: { id: userId, is_bot: false }, chat: { id: userId, type: "private" }, text },
})
const callbackFrom = (userId: number, updateId: number): TgUpdate => ({
  update_id: updateId,
  callback_query: { id: "cq1", from: { id: userId, is_bot: false }, data: "p:x:a" },
})

describe("dispatchUpdate (AC-010 deny-by-default)", () => {
  let dir: string
  let file: string
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-router-"))
    file = path.join(dir, "dedup.json")
  })
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  test("a non-allowlisted MESSAGE is dropped: no handler call, logged, offset advanced", async () => {
    const h = harness([OPERATOR])
    const deps = h.make(file)
    await dispatchUpdate(messageFrom(STRANGER, 500), deps)

    expect(h.messages).toHaveLength(0)
    expect(h.callbacks).toHaveLength(0)
    expect(h.logs.some((l) => l.includes("non-allowlisted") && l.includes(String(STRANGER)))).toBe(true)
    expect(await deps.dedup.last()).toBe(500) // advanced so it is never re-fetched
  })

  test("a non-allowlisted CALLBACK (button press) is also dropped (INV-001 covers callbacks)", async () => {
    const h = harness([OPERATOR])
    const deps = h.make(file)
    await dispatchUpdate(callbackFrom(STRANGER, 501), deps)

    expect(h.callbacks).toHaveLength(0)
    expect(h.messages).toHaveLength(0)
    expect(h.logs.some((l) => l.includes("non-allowlisted"))).toBe(true)
  })

  test("an allowlisted message IS dispatched and confirmed", async () => {
    const h = harness([OPERATOR])
    const deps = h.make(file)
    await dispatchUpdate(messageFrom(OPERATOR, 600, "do a thing"), deps)

    expect(h.messages).toHaveLength(1)
    expect(h.messages[0]!.text).toBe("do a thing")
    expect(await deps.dedup.last()).toBe(600)
  })

  test("a duplicate/lower update_id is skipped (never re-dispatched)", async () => {
    const h = harness([OPERATOR])
    const deps = h.make(file)
    await deps.dedup.commit(700)
    await dispatchUpdate(messageFrom(OPERATOR, 700, "dup"), deps)
    await dispatchUpdate(messageFrom(OPERATOR, 650, "older"), deps)

    expect(h.messages).toHaveLength(0)
  })

  test("an update with no identifiable sender is dropped without dispatch", async () => {
    const h = harness([OPERATOR])
    const deps = h.make(file)
    await dispatchUpdate({ update_id: 800 }, deps)

    expect(h.messages).toHaveLength(0)
    expect(h.callbacks).toHaveLength(0)
    expect(await deps.dedup.last()).toBe(800)
  })
})
