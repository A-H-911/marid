import type { TgMessage, TgUpdate } from "./telegram"

// Hand-rolled Telegram Bot API client over fetch (DEC: no telegram-library runtime
// dependency — the used surface is ~7 endpoints, each a JSON POST, and a library
// would pull a transitive tree into the security-critical gateway process, RISK-004).
// The base URL is configurable so tests point it at a local fake server and a
// self-hosted Bot API server (research §4) works without code changes.
// ponytail: JSON-body sends only (file_id / URL for media). Multipart upload of a
// local file is the upgrade path if a generated local artifact ever needs sending.

export interface InlineKeyboardButton {
  text: string
  callback_data: string
}
export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][]
}
export interface SendOptions {
  parse_mode?: "HTML" | "MarkdownV2"
  reply_markup?: InlineKeyboardMarkup
}
export interface TgFile {
  file_id: string
  file_path?: string
  file_size?: number
}

export interface BotApi {
  getUpdates(offset: number, timeoutSec: number): Promise<TgUpdate[]>
  sendMessage(chatId: number, text: string, opts?: SendOptions): Promise<TgMessage>
  editMessageText(chatId: number, messageId: number, text: string, opts?: SendOptions): Promise<void>
  editMessageReplyMarkup(chatId: number, messageId: number, markup?: InlineKeyboardMarkup): Promise<void>
  sendChatAction(chatId: number, action: "typing"): Promise<void>
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>
  getFile(fileId: string): Promise<TgFile>
  fileDownloadUrl(filePath: string): string
  sendPhoto(chatId: number, photo: string, caption?: string): Promise<TgMessage>
  sendDocument(chatId: number, document: string, caption?: string): Promise<TgMessage>
}

// A Bot API call that returned ok:false. 429s carry retry_after (seconds) so the
// caller can honor Telegram's flood control (research §2); 400 "message is not
// modified" is surfaced so streaming can skip unchanged edits.
export class TelegramError extends Error {
  constructor(
    readonly code: number,
    description: string,
    readonly retryAfter?: number,
  ) {
    super(description)
    this.name = "TelegramError"
  }
}

interface TgResponse<T> {
  ok: boolean
  result?: T
  error_code?: number
  description?: string
  parameters?: { retry_after?: number }
}

export interface BotApiConfig {
  token: string
  baseUrl?: string
  fetch?: typeof fetch
}

const DEFAULT_BASE = "https://api.telegram.org"

export function createBotApi(config: BotApiConfig): BotApi {
  const base = (config.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "")
  const doFetch = config.fetch ?? fetch

  async function call<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const res = await doFetch(`${base}/bot${config.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    })
    const body = (await res.json().catch(() => ({ ok: false, description: "invalid JSON" }))) as TgResponse<T>
    if (!body.ok) {
      throw new TelegramError(body.error_code ?? res.status, body.description ?? "Telegram error", body.parameters?.retry_after)
    }
    return body.result as T
  }

  return {
    getUpdates: (offset, timeoutSec) => call<TgUpdate[]>("getUpdates", { offset, timeout: timeoutSec }),
    sendMessage: (chatId, text, opts) =>
      call<TgMessage>("sendMessage", { chat_id: chatId, text, parse_mode: opts?.parse_mode, reply_markup: opts?.reply_markup }),
    editMessageText: (chatId, messageId, text, opts) =>
      call<unknown>("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: opts?.parse_mode,
        reply_markup: opts?.reply_markup,
      }).then(() => undefined),
    editMessageReplyMarkup: (chatId, messageId, markup) =>
      call<unknown>("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: markup }).then(
        () => undefined,
      ),
    sendChatAction: (chatId, action) =>
      call<unknown>("sendChatAction", { chat_id: chatId, action }).then(() => undefined),
    answerCallbackQuery: (callbackQueryId, text) =>
      call<unknown>("answerCallbackQuery", { callback_query_id: callbackQueryId, text }).then(() => undefined),
    getFile: (fileId) => call<TgFile>("getFile", { file_id: fileId }),
    // The bot token is embedded here — callers must redact() this before logging.
    fileDownloadUrl: (filePath) => `${base}/file/bot${config.token}/${filePath}`,
    sendPhoto: (chatId, photo, caption) => call<TgMessage>("sendPhoto", { chat_id: chatId, photo, caption }),
    sendDocument: (chatId, document, caption) => call<TgMessage>("sendDocument", { chat_id: chatId, document, caption }),
  }
}
