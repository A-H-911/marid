import { describe, expect, test } from "bun:test"
import { inboundFileParts, inboundNote, largestPhotoFileId, resolveDownloadUrl, resolveOutboundBytes } from "../src/media"
import { createBotApi } from "../src/bot-api"
import { redact } from "../src/redact"
import type { TgMessage } from "../src/telegram"

const msg = (extra: Partial<TgMessage>): TgMessage => ({ message_id: 1, chat: { id: 5, type: "private" }, ...extra })

// A bot whose getFile returns file_path (or ok:false for the failure case).
const TOKEN = "123:AAsecretTokenValue"
const botWith = (filePath: string | null) =>
  createBotApi({
    token: TOKEN,
    baseUrl: "https://api.telegram.org",
    fetch: (async () =>
      new Response(
        JSON.stringify(filePath ? { ok: true, result: { file_id: "f", file_path: filePath } } : { ok: false, description: "not found" }),
      )) as unknown as typeof fetch,
  })

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

describe("inboundFileParts (defect 2: the file lands in the workspace, not just a note)", () => {
  test("a document becomes a file part carrying its mime, filename, and resolved URL", async () => {
    const parts = await inboundFileParts(
      msg({ document: { file_id: "f", file_unique_id: "u", file_name: "report.pdf", mime_type: "application/pdf" } }),
      botWith("documents/report.pdf"),
    )
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ type: "file", mime: "application/pdf", filename: "report.pdf" })
    expect(parts[0]!.url).toContain("documents/report.pdf") // the real download URL (previously discarded)
  })

  test("a document with no mime falls back to application/octet-stream", async () => {
    const parts = await inboundFileParts(msg({ document: { file_id: "f", file_unique_id: "u" } }), botWith("documents/x.bin"))
    expect(parts[0]!.mime).toBe("application/octet-stream")
  })

  test("a photo becomes an image/jpeg file part", async () => {
    const parts = await inboundFileParts(msg({ photo: [{ file_id: "p", file_unique_id: "u" }] }), botWith("photos/x.jpg"))
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ type: "file", mime: "image/jpeg", filename: "photo.jpg" })
  })

  test("a text-only message yields no file parts", async () => {
    expect(await inboundFileParts(msg({ text: "hi" }), botWith("x/y"))).toEqual([])
  })

  test("INV-004: a malicious filename with path separators is neutralized (traversal guard)", async () => {
    const parts = await inboundFileParts(
      msg({ document: { file_id: "f", file_unique_id: "u", file_name: "../../etc/passwd" } }),
      botWith("documents/x"),
    )
    expect(parts[0]!.filename).not.toContain("/")
    expect(parts[0]!.filename).not.toContain("\\")
  })

  test("a file that cannot be resolved (getFile failed) is skipped, not fatal", async () => {
    const parts = await inboundFileParts(msg({ document: { file_id: "f", file_unique_id: "u", file_name: "x.pdf" } }), botWith(null))
    expect(parts).toEqual([])
  })

  test("INV-002: the file part's URL embeds the token and is redactable before any log", async () => {
    const parts = await inboundFileParts(
      msg({ document: { file_id: "f", file_unique_id: "u", file_name: "x.pdf" } }),
      botWith("documents/x.pdf"),
    )
    expect(parts[0]!.url).toContain(TOKEN)
    expect(redact(parts[0]!.url, TOKEN)).not.toContain(TOKEN)
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

describe("resolveOutboundBytes (outbound file → raw bytes for multipart)", () => {
  const dec = (b?: Uint8Array) => (b ? new TextDecoder().decode(b) : undefined)

  test("decodes a base64 data: URL to the exact bytes", async () => {
    const url = `data:application/pdf;base64,${Buffer.from("HELLO-PDF").toString("base64")}`
    expect(dec(await resolveOutboundBytes(url))).toBe("HELLO-PDF")
  })

  test("decodes a non-base64 (percent-encoded) data: URL", async () => {
    expect(dec(await resolveOutboundBytes("data:text/plain,hi%20there"))).toBe("hi there")
  })

  test("returns undefined for a malformed data: URL (no comma)", async () => {
    expect(await resolveOutboundBytes("data:application/pdf;base64")).toBeUndefined()
  })

  test("reads bytes from a file:// URL", async () => {
    const fs = await import("node:fs/promises")
    const os = await import("node:os")
    const path = await import("node:path")
    const { pathToFileURL } = await import("node:url")
    const p = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "ob-")), "f.bin")
    await fs.writeFile(p, "FILE-BYTES")
    expect(dec(await resolveOutboundBytes(pathToFileURL(p).href))).toBe("FILE-BYTES")
  })
})
