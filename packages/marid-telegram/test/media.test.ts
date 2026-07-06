import { describe, expect, test } from "bun:test"
import { inboundNote, largestPhotoFileId, resolveDownloadUrl } from "../src/media"
import { createBotApi } from "../src/bot-api"
import { redact } from "../src/redact"
import type { TgMessage } from "../src/telegram"

const msg = (extra: Partial<TgMessage>): TgMessage => ({ message_id: 1, chat: { id: 5, type: "private" }, ...extra })

describe("inboundNote (INV-004: attachments surface as data)", () => {
  test("describes a photo", () => {
    expect(inboundNote(msg({ photo: [{ file_id: "f1", file_unique_id: "u1" }] }))).toBe("[operator attached a photo]")
  })
  test("describes a document with its name", () => {
    expect(inboundNote(msg({ document: { file_id: "f", file_unique_id: "u", file_name: "report.pdf" } }))).toBe(
      "[operator attached a document: report.pdf]",
    )
  })
  test("returns undefined when there is no attachment", () => {
    expect(inboundNote(msg({ text: "just text" }))).toBeUndefined()
  })
})

describe("largestPhotoFileId", () => {
  test("picks the last (largest) photo size", () => {
    const m = msg({
      photo: [
        { file_id: "small", file_unique_id: "s" },
        { file_id: "large", file_unique_id: "l" },
      ],
    })
    expect(largestPhotoFileId(m)).toBe("large")
  })
})

describe("resolveDownloadUrl (AC-016: the download URL embeds the token and must be redactable)", () => {
  const TOKEN = "123:AAsecretTokenValue"
  test("builds the download URL, and redact() masks the embedded token", async () => {
    const fetchImpl = (async (url: string) => {
      expect(String(url)).toContain("getFile")
      return new Response(JSON.stringify({ ok: true, result: { file_id: "f", file_path: "photos/x.jpg" } }))
    }) as unknown as typeof fetch
    const bot = createBotApi({ token: TOKEN, baseUrl: "https://api.telegram.org", fetch: fetchImpl })

    const url = await resolveDownloadUrl(bot, "f")
    expect(url).toBe("https://api.telegram.org/file/bot123:AAsecretTokenValue/photos/x.jpg")
    expect(url!.includes(TOKEN)).toBe(true)
    expect(redact(url!, TOKEN)).toBe("https://api.telegram.org/file/bot<redacted>/photos/x.jpg")
  })
})
