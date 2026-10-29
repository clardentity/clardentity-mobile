/* Ids in a route come from wherever the link came from - a notification, an
 * email, another app - not only from this app, so anything that could change
 * the shape of an API path (a slash, a dot, a query) is turned away at the
 * route rather than spliced in.
 *
 * Not a UUID check, though every id the server hands out today is one: /start
 * opens whatever chat the server names, and a strict check bounced any other
 * id straight back to /start, which opened it again - a redirect loop that
 * locked the app (the demo backend's "c1" ids hit it). */

const ROUTE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function isRouteId(value: unknown): value is string {
  return typeof value === "string" && ROUTE_ID.test(value);
}
