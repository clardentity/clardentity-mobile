/* Ids in a route come from wherever the link came from - a notification, an
 * email, another app - not only from this app. Every chat and workspace id
 * the server hands out is a UUID, so anything else is turned away at the
 * route rather than spliced into an API path. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
