import * as WebBrowser from "expo-web-browser";

/* Links from an answer - citations, sources, a safety card's fallback page -
 * are written by the model or the server, not by us. Only web addresses get
 * opened: a `javascript:` link would run script in the web build, and on
 * Android an `intent:` or `file:` link can reach into other apps. */

export function isWebUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** Opens `url` in the in-app browser if it is a web address; anything else
 *  is ignored. */
export function safeOpenUrl(url: string | null | undefined): void {
  if (!isWebUrl(url)) return;
  void WebBrowser.openBrowserAsync(url).catch(() => {});
}
