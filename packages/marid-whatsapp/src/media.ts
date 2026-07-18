import fs from "node:fs/promises"
import { fileURLToPath } from "node:url"
import type { FilePartInput } from "@opencode-ai/sdk/v2"
import type { InboundMessage, WhatsAppClient } from "./client"

// Media handling (WBS-7.3, FR-049).
//
// INBOUND differs from Telegram in one load-bearing way. Telegram hands the SDK a
// token-bearing download URL and lets the marid server fetch it. WAHA's media URL needs
// the WAHA API KEY (a header the marid server neither has nor should have — INV-001), so
// the adapter must download the bytes ITSELF (client.downloadMedia) and hand the server a
// self-contained `data:` URL. The file lands in the workspace as DATA, never executed
// (INV-004); the restricted text agent is not fed raw bytes, only a note + the file part.
//
// OUTBOUND: an assistant file part carries `url: "data:<mime>;base64,…"` (bytes inline);
// decode to bytes and hand them to client.sendMedia (WAHA takes BinaryFile base64).

// A short, safe DATA note describing an inbound attachment, or undefined if none.
export function inboundNote(message: InboundMessage): string | undefined {
  if (!message.hasMedia) return undefined
  const name = message.media?.filename ? `: ${safeFilename(message.media.filename)}` : ""
  return `[operator attached a file${name}]`
}

// A WAHA-supplied filename is untrusted (INV-004): strip path separators so it can never
// be read as a path when the workspace file is written (traversal guard).
export function safeFilename(name?: string): string | undefined {
  return name?.replace(/[/\\]/g, "_")
}

// Download an inbound attachment through the WAHA client and wrap it as an SDK file part
// with a self-contained data: URL. Skipped (not fatal) if there is no downloadable media
// or the download fails. The WAHA URL is never logged (INV-002) — it is used only inside
// the client, which attaches the key.
export async function inboundFileParts(message: InboundMessage, client: Pick<WhatsAppClient, "downloadMedia">): Promise<FilePartInput[]> {
  const media = message.media
  if (!message.hasMedia || !media) return []
  const bytes = await client.downloadMedia(media).catch(() => undefined)
  if (!bytes) return []
  const b64 = Buffer.from(bytes).toString("base64")
  return [
    {
      type: "file",
      mime: media.mimetype,
      filename: safeFilename(media.filename),
      url: `data:${media.mimetype};base64,${b64}`,
    },
  ]
}

// Resolve an OUTBOUND file part's `url` to raw bytes for client.sendMedia. Assistant/tool
// parts carry `data:` (the common case, decoded with no network); `file://` reads disk;
// `http(s)` is a genuinely public artifact. Returns undefined on any failure — the caller
// logs + skips (never fatal). Mirrors marid-telegram/media.resolveOutboundBytes.
export async function resolveOutboundBytes(url: string): Promise<Uint8Array | undefined> {
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",")
    if (comma === -1) return undefined
    const meta = url.slice(5, comma)
    const payload = url.slice(comma + 1)
    return /;base64/i.test(meta)
      ? new Uint8Array(Buffer.from(payload, "base64"))
      : new TextEncoder().encode(decodeURIComponent(payload))
  }
  if (url.startsWith("file://")) {
    const buf = await fs.readFile(fileURLToPath(url)).catch(() => undefined)
    return buf ? new Uint8Array(buf) : undefined
  }
  const res = await fetch(url).catch(() => undefined)
  if (!res || !res.ok) return undefined
  return new Uint8Array(await res.arrayBuffer())
}
