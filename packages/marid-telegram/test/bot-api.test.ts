import { describe, expect, test } from "bun:test"
import { createBotApi } from "../src/bot-api"

const TOKEN = "123:AAsecretTokenValue"
const okResponse = () => new Response(JSON.stringify({ ok: true, result: { message_id: 7, chat: { id: 5, type: "private" } } }))

// Capture the fetch call the bot-api makes, so we can assert the multipart shape.
function capturingBot() {
  let captured: { url: string; init: RequestInit } | undefined
  const bot = createBotApi({
    token: TOKEN,
    baseUrl: "https://api.telegram.org",
    fetch: (async (url: string, init: RequestInit) => {
      captured = { url: String(url), init }
      return okResponse()
    }) as unknown as typeof fetch,
  })
  return { bot, get: () => captured }
}

describe("bot-api multipart byte uploads (outbound files)", () => {
  test("sendDocumentBytes POSTs multipart/form-data with the file, chat_id, and caption", async () => {
    const { bot, get } = capturingBot()
    await bot.sendDocumentBytes(5, new Uint8Array(Buffer.from("DOC-BYTES")), "report.pdf", "report.pdf")

    const call = get()!
    expect(call.url).toBe("https://api.telegram.org/bot123:AAsecretTokenValue/sendDocument")
    expect(call.init.method).toBe("POST")
    // The body is FormData — do NOT set content-type by hand (fetch adds the boundary).
    expect(call.init.body).toBeInstanceOf(FormData)
    expect((call.init.headers as Record<string, string> | undefined)?.["content-type"]).toBeUndefined()

    const form = call.init.body as FormData
    expect(form.get("chat_id")).toBe("5")
    expect(form.get("caption")).toBe("report.pdf")
    const doc = form.get("document") as Blob
    expect(doc).toBeInstanceOf(Blob)
    expect(await doc.text()).toBe("DOC-BYTES")
  })

  test("sendPhotoBytes uses the `photo` field and omits caption when not given", async () => {
    const { bot, get } = capturingBot()
    await bot.sendPhotoBytes(5, new Uint8Array(Buffer.from("PNG-BYTES")), "chart.png")

    const form = get()!.init.body as FormData
    expect(get()!.url.endsWith("/sendPhoto")).toBe(true)
    expect(form.get("caption")).toBeNull()
    expect(await (form.get("photo") as Blob).text()).toBe("PNG-BYTES")
  })

  test("a Bot API ok:false surfaces as TelegramError", async () => {
    const bot = createBotApi({
      token: TOKEN,
      fetch: (async () => new Response(JSON.stringify({ ok: false, error_code: 413, description: "too big" }))) as unknown as typeof fetch,
    })
    await expect(bot.sendDocumentBytes(5, new Uint8Array([1]), "x.bin")).rejects.toThrow("too big")
  })
})
