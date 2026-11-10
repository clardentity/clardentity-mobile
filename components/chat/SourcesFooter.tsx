import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { Claim } from "@/lib/sse";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";
import { safeOpenUrl } from "@/lib/links";

/* The sources an answer rests on, gathered at its foot as cards - one per
 * document or page, however many claims cite it - so what the inline
 * markers point at can be seen in one place without opening each popover.
 * Web sources open in the in-app browser; documents are the user's own
 * uploads and are named. Nothing here is a verdict: the per-claim scores stay
 * on the markers, where they belong to a specific sentence. */

type Source = {
  key: string;
  title: string;
  url: string | null;
  host: string | null;
  kind: "document" | "web";
  cites: number;
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function collectSources(claims: Claim[]): Source[] {
  const byKey = new Map<string, Source>();
  for (const claim of claims) {
    // One count per claim per source, however many excerpts of it were used.
    const seenInClaim = new Set<string>();
    for (const e of claim.evidence) {
      const key = e.url ?? e.document_id ?? e.document_filename;
      if (!key || seenInClaim.has(key)) continue;
      seenInClaim.add(key);
      const existing = byKey.get(key);
      if (existing) {
        existing.cites += 1;
        continue;
      }
      byKey.set(key, {
        key,
        title: e.document_filename || e.url || "Source",
        url: e.source_type === "web" ? e.url : null,
        host: e.url ? hostOf(e.url) : null,
        kind: e.source_type,
        cites: 1,
      });
    }
  }
  return [...byKey.values()];
}

const ICON = px(14);

function DocIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <Path d="M14 3v5h5M9 13h6M9 17h6" />
    </Svg>
  );
}

function GlobeIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="9" />
      <Path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </Svg>
  );
}

export function SourcesFooter({ claims }: { claims: Claim[] }) {
  const c = useColors();
  const s = useThemedStyles(styles);
  const sources = collectSources(claims);
  if (sources.length === 0) return null;
  return (
    <View style={s.root}>
      <Text style={s.heading}>Sources</Text>
      <View style={s.list}>
        {sources.map((src) => {
          const inner = (
            <>
              {src.kind === "web" ? <GlobeIcon color={c.brand} /> : <DocIcon color={c.inkMuted} />}
              <View style={{ minWidth: 0, flexShrink: 1 }}>
                <Text numberOfLines={1} style={s.title}>
                  {src.title}
                </Text>
                <Text numberOfLines={1} style={s.meta}>
                  {src.host ?? "Your attachment"}
                  {" · "}
                  {src.cites === 1 ? "1 claim" : `${src.cites} claims`}
                </Text>
              </View>
            </>
          );
          return src.url ? (
            <Pressable
              key={src.key}
              onPress={() => safeOpenUrl(src.url)}
              accessibilityRole="link"
              style={({ pressed }) => [s.card, pressed && { borderColor: c.brandBorder, backgroundColor: c.brandSoft }]}
            >
              {inner}
            </Pressable>
          ) : (
            <View key={src.key} style={s.card}>
              {inner}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    root: { marginTop: space(3), borderTopWidth: 1, borderTopColor: c.hairline, paddingTop: space(2.5) },
    heading: {
      marginBottom: space(1.5),
      fontSize: fontSize.xs,
      fontFamily: fonts.semibold,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: c.inkMuted,
    },
    list: { flexDirection: "row", flexWrap: "wrap", gap: space(1.5) },
    card: {
      maxWidth: "100%",
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: space(2),
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surfaceMuted,
      paddingHorizontal: space(2.5),
      paddingVertical: space(1.5),
    },
    title: { fontSize: fontSize.xs, fontFamily: fonts.medium, color: c.ink },
    meta: { fontSize: fontSize.xs, fontFamily: fonts.regular, color: c.inkMuted },
  });
