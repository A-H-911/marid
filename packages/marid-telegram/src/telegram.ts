// Minimal Telegram Bot API object shapes the gateway actually reads. Kept small
// and local (no telegram SDK dependency — DEC: hand-rolled client, RISK-004).
// Fields the gateway never inspects are omitted; unknown fields are ignored.

export interface TgUser {
  id: number
  is_bot: boolean
  first_name?: string
  username?: string
}

export interface TgChat {
  id: number
  type: string
}

export interface TgPhotoSize {
  file_id: string
  file_unique_id: string
  file_size?: number
}

export interface TgDocument {
  file_id: string
  file_unique_id: string
  file_name?: string
  mime_type?: string
  file_size?: number
}

export interface TgMessage {
  message_id: number
  from?: TgUser
  chat: TgChat
  text?: string
  caption?: string
  photo?: TgPhotoSize[]
  document?: TgDocument
}

export interface TgCallbackQuery {
  id: string
  from: TgUser
  message?: TgMessage
  data?: string
}

export interface TgUpdate {
  update_id: number
  message?: TgMessage
  callback_query?: TgCallbackQuery
}
