import { REQUEST_ID_HEADER } from "./request-id"

// Shared response builders (api-event-contract §"Errors"): the structured error envelope
// { name, message, requestId } and a JSON success envelope, both stamping the request-id
// header. Extracted so the auth middleware and the gateway routes emit an identical shape.

export function errorResponse(
  status: number,
  name: string,
  message: string,
  requestId: string,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ name, message, requestId }), {
    status,
    headers: { "content-type": "application/json", [REQUEST_ID_HEADER]: requestId, ...extra },
  })
}

export function jsonResponse(status: number, body: unknown, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", [REQUEST_ID_HEADER]: requestId },
  })
}
