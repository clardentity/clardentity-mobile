import { Dimensions } from "react-native";
import { UI_SCALE } from "@/lib/theme";

/* On the web the interface is drawn at 85% (92% on touch phones) through a
 * CSS zoom on the root, and anything that measured a rect and positioned a
 * panel had to convert between the two pixel spaces here.
 *
 * Native has one pixel space: a measured layout (onLayout, measureInWindow)
 * is already in the units a style is written in, and the 0.92 is baked into
 * the design tokens (lib/theme px()). So the conversions are identities. They
 * are kept so the tour, the citation popover and the drawer, ported from the
 * web, call the same functions. */

export function uiZoom(): number {
  return UI_SCALE;
}

export function rectScale(): number {
  return 1;
}

export type LayoutRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

/** A measured rectangle (x, y, width, height from measureInWindow). */
export function toLayoutRect(rect: { x: number; y: number; width: number; height: number }): LayoutRect {
  return {
    top: rect.y,
    left: rect.x,
    width: rect.width,
    height: rect.height,
    bottom: rect.y + rect.height,
    right: rect.x + rect.width,
  };
}

/** The window - what to clamp a panel against. */
export function layoutViewport(): { width: number; height: number } {
  const { width, height } = Dimensions.get("window");
  return { width, height };
}
