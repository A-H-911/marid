import { describe, expect, test } from "bun:test"
import type { InboundMessage } from "../src/client"
import { inboundFileParts, inboundNote, resolveOutboundBytes, safeFilename } from "../src/media"

// WBS-7.3 media (FR-049). Inbound download -> data: URL; outbound data: -> bytes.

const msg = (over: Partial<InboundMessage>): InboundMessage => ({
  id: "m1",
  from: "1@c.us",
  body: "",
  fromMe: false,
  hasMedia: false,
  ...over,
})

describe("inboundNote", () => {
  test("undefined when there is no media", () => {
    expect(inboundNote(msg({}))).toBeUndefined()
  })

  test("notes an attachment, sanitizing the filename", () => {
    expect(inboundNote(msg({ hasMedia: true, media: { url: "x", mimetype: "image/png", filename: "a/../b.png" } }))).toBe(
      "[operator attached a file: a_.._b.png]",
    )
  })
})

describe("safeFilename — traversal guard (INV-004)", () => {
  test("strips path separators so a name cannot be read as a path", () => {
    expect(safeFilename("a/b\\c")).toBe("a_b_c")
    expect(safeFilename("../../evil")).toBe(".._.._evil")
    expect(safeFilename(undefined)).toBeUndefined()
  })
})

describe("inboundFileParts", () => {
  test("downloads media and wraps it as a self-contained data: file part", async () => {
    const client = { downloadMedia: async () => new Uint8Array([1, 2, 3]) }
    const parts = await inboundFileParts(
      msg({ hasMedia: true, media: { url: "http://waha/api/files/x.png", mimetype: "image/png", filename: "x.png" } }),
      client,
    )
    expect(parts).toEqual([
      { type: "file", mime: "image/png", filename: "x.png", url: `data:image/png;base64,${Buffer.from([1, 2, 3]).toString("base64")}` },
    ])
  })

  test("returns nothing when there is no media", async () => {
    const client = { downloadMedia: async () => new Uint8Array([1]) }
    expect(await inboundFileParts(msg({}), client)).toEqual([])
  })

  test("skips (not fatal) when the download fails", async () => {
    const client = { downloadMedia: async () => { throw new Error("boom") } }
    expect(await inboundFileParts(msg({ hasMedia: true, media: { url: "x", mimetype: "image/png" } }), client)).toEqual([])
  })
})

describe("resolveOutboundBytes", () => {
  test("decodes a base64 data: URL with no network", async () => {
    const url = `data:image/png;base64,${Buffer.from([9, 8, 7]).toString("base64")}`
    expect(Array.from((await resolveOutboundBytes(url))!)).toEqual([9, 8, 7])
  })

  test("decodes a non-base64 data: URL", async () => {
    expect(new TextDecoder().decode(await resolveOutboundBytes("data:text/plain,hello%20there"))).toBe("hello there")
  })

  test("returns undefined for a malformed data: URL", async () => {
    expect(await resolveOutboundBytes("data:broken")).toBeUndefined()
  })
})
