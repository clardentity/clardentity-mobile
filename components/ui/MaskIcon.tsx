import { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import { ICONS } from "@/components/ui/icons";
import { useColors } from "@/lib/theme";

/** One of the design's own marks, drawn in the colour of whatever it sits in.
 *
 *  The SVGs that came out of Figma carry the colour they were drawn with
 *  baked into every path - #5F5551 for the sidebar, #6B5C60 for the mode
 *  rail. On the web the file is used as a CSS mask painted with
 *  `currentColor`. React Native has no currentColor cascade, so the colour is
 *  passed in (default: the secondary ink) and every fill and stroke in the
 *  file is rewritten to it - the same effect, one copy of the asset.
 *
 *  `src` is the web path ("/ui/mode-finder.svg"), so call sites port as-is.
 */
export function MaskIcon({
  src,
  size = 20,
  width,
  height,
  color,
  style,
}: {
  src: string;
  /** Drawn size; the mark is scaled to fit it. */
  size?: number;
  width?: number;
  height?: number;
  /** What the web got from `currentColor`. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const paint = color ?? colors.inkSecondary;
  const xml = useMemo(() => {
    const raw = ICONS[src];
    if (!raw) return null;
    return raw
      .replace(/fill="(?!none)[^"]*"/g, `fill="${paint}"`)
      .replace(/stroke="(?!none)[^"]*"/g, `stroke="${paint}"`)
      .replace(/\sstyle="[^"]*"/g, "");
  }, [src, paint]);
  if (!xml) return null;
  return (
    <SvgXml
      xml={xml}
      width={width ?? size}
      height={height ?? size}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
