import type { BotApi } from "./bot-api"
import type { TgMessage } from "./telegram"

// Media handling within Bot API caps (WBS-4.5, FR-049).
//
// Inbound: attachments are surfaced to the agent as an untrusted DATA note appended
// to the prompt (INV-004) — the restricted text agent is not fed raw bytes. If the
// file is fetched, resolveDownloadUrl builds the download URL, which embeds the bot
// token and therefore MUST be redact()ed before it can appear in any log (AC-016,
// INV-002/RISK-007).
//
// Outbound: sendPhoto/sendDocument on BotApi send by URL or file_id (JSON body).

// A short, safe description of any attachment on an inbound message, or undefined
// if there is none. Used to augment the prompt text as data.
export function inboundNote(message: TgMessage): string | undefined {
  if (message.photo && message.photo.length > 0) return "[operator attached a photo]"
  if (message.document) {
    const name = message.document.file_name ? `: ${message.document.file_name}` : ""
    return `[operator attached a document${name}]`
  }
  return undefined
}

// Resolve a Telegram file_id to a download URL. The URL contains the bot token, so
// the caller must never log it un-redacted.
export async function resolveDownloadUrl(bot: BotApi, fileId: string): Promise<string | undefined> {
  const file = await bot.getFile(fileId).catch(() => undefined)
  if (!file?.file_path) return undefined
  return bot.fileDownloadUrl(file.file_path)
}

// The largest photo size Telegram offers for a message (last in the array), for
// re-fetching or forwarding.
export function largestPhotoFileId(message: TgMessage): string | undefined {
  const photos = message.photo
  return photos && photos.length > 0 ? photos[photos.length - 1]!.file_id : undefined
}
