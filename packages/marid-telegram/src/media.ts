import type { FilePartInput } from "@opencode-ai/sdk/v2"
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

// A Telegram-supplied filename is untrusted (INV-004): strip path separators so it
// can never be read as a path when the workspace file is written (traversal guard).
function safeFilename(name?: string): string | undefined {
  return name?.replace(/[/\\]/g, "_")
}

// Resolve inbound attachments (document and/or photo) to SDK file parts so the file
// actually lands in the workspace (defect 2 — previously only inboundNote's text note
// was sent and the file was discarded). The URL embeds the bot token: callers pass
// these straight to the SDK and never log the URL (INV-002). A file that cannot be
// resolved (getFile failed) is skipped, not fatal.
export async function inboundFileParts(message: TgMessage, bot: BotApi): Promise<FilePartInput[]> {
  const parts: FilePartInput[] = []
  const doc = message.document
  if (doc?.file_id) {
    const url = await resolveDownloadUrl(bot, doc.file_id)
    if (url) parts.push({ type: "file", mime: doc.mime_type ?? "application/octet-stream", filename: safeFilename(doc.file_name), url })
  }
  const photoId = largestPhotoFileId(message)
  if (photoId) {
    const url = await resolveDownloadUrl(bot, photoId)
    if (url) parts.push({ type: "file", mime: "image/jpeg", filename: "photo.jpg", url }) // Telegram photos are JPEG
  }
  return parts
}
