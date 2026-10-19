import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

/* "Download the app" for a PWA.
 *
 * On the web this offered the browser's own install prompt (or the iOS
 * Add-to-Home-Screen steps), and hid itself once running as an installed
 * app. This *is* the installed app, so there is never anything to offer: the
 * component is kept, with the web's props, so call sites port unchanged, and
 * renders nothing. */
export function InstallAppButton(_props: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return null;
}
