import { randomUUID } from "node:crypto"

export const REQUEST_ID_HEADER = "x-request-id"

// Accept a client-supplied correlation id, else mint one. Echoed in responses
// and propagated into the audit log (api-event-contract §"Correlation").
export function resolveRequestId(request: Request): string {
  const supplied = request.headers.get(REQUEST_ID_HEADER)?.trim()
  return supplied ? supplied : randomUUID()
}
