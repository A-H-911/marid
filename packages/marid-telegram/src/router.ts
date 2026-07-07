import { isAllowed } from "./allowlist"
import type { Dedup } from "./dedup"
import type { TgCallbackQuery, TgMessage, TgUpdate } from "./telegram"

// Long-poll ingress (WBS-4.1, FR-046/050/051). Owns the getUpdates offset via the
// dedup store, enforces the INV-001 allowlist on EVERY update (both messages and
// callback_query button presses), and dispatches allowed updates to the gateway.
//
// AC-010: a non-allowlisted sender produces NO session and NO reply — the update
// is logged and dropped, and the offset advances so it is never re-fetched. The
// handlers (onMessage/onCallback) are the only path to the SDK/bot, so "never
// dispatched" == "no session created, nothing answered".

export interface UpdateHandlers {
  onMessage(message: TgMessage): Promise<void>
  onCallback(query: TgCallbackQuery): Promise<void>
}

export interface DispatchDeps extends UpdateHandlers {
  allow: ReadonlySet<number>
  dedup: Dedup
  log: (line: string) => void
}

// The sender id of an update, whether it arrived as a message or a button press.
function senderOf(update: TgUpdate): number | undefined {
  return update.message?.from?.id ?? update.callback_query?.from.id
}

export async function dispatchUpdate(update: TgUpdate, deps: DispatchDeps): Promise<void> {
  if (await deps.dedup.seen(update.update_id)) return // duplicate / redelivered / lower

  const sender = senderOf(update)
  // No identifiable sender (service messages, channel posts) — not for us. Drop.
  if (sender === undefined) {
    await deps.dedup.commit(update.update_id)
    return
  }

  // INV-001: deny-by-default. Log the attempt, advance the offset, dispatch nothing.
  if (!isAllowed(sender, deps.allow)) {
    deps.log(`ignored update ${update.update_id} from non-allowlisted user ${sender}`)
    await deps.dedup.commit(update.update_id)
    return
  }

  if (update.message) await deps.onMessage(update.message)
  else if (update.callback_query) await deps.onCallback(update.callback_query)

  // Confirm AFTER side effects (at-least-once): a crash before this line lets
  // Telegram redeliver, and the handler's messageID = update_id keeps it idempotent.
  await deps.dedup.commit(update.update_id)
}

export interface RouterDeps extends DispatchDeps {
  getUpdates(offset: number, timeoutSec: number): Promise<TgUpdate[]>
  sleep(ms: number): Promise<void>
  signal: AbortSignal
  pollTimeoutSec?: number
}

// The poll loop. offset = last confirmed update_id + 1, so Telegram never
// redelivers a confirmed update. On a transient getUpdates error it backs off
// briefly rather than hot-spinning, then retries.
export async function runRouter(deps: RouterDeps): Promise<void> {
  const timeout = deps.pollTimeoutSec ?? 50
  while (!deps.signal.aborted) {
    const offset = (await deps.dedup.last()) + 1
    const updates = await deps.getUpdates(offset, timeout).catch((cause: unknown) => {
      deps.log(`getUpdates failed: ${cause instanceof Error ? cause.message : String(cause)}`)
      return undefined
    })
    if (updates === undefined) {
      await deps.sleep(1000)
      continue
    }
    for (const update of updates) {
      if (deps.signal.aborted) break
      await dispatchUpdate(update, deps)
    }
  }
}
