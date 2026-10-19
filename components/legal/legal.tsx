import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Linking, View } from "react-native";
import { AppText } from "@/components/ui/primitives";
import { fonts, fontSize, space, useColors } from "@/lib/theme";

/* The web's app/(legal)/legal.tsx. It cannot stay under app/ here: every file
 * there is a route in Expo Router. */

/** Shared typography for the two legal documents, so they read as one pair
 *  rather than two pages that happen to be near each other. */
export function LegalPage({
  title,
  updated,
  version,
  intro,
  children,
}: {
  title: string;
  updated: string;
  version: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={{ gap: space(6) }}>
      <View style={{ gap: space(2), borderBottomWidth: 1, borderBottomColor: c.hairline, paddingBottom: space(6) }}>
        <AppText size="2xl" weight="semibold" accessibilityRole="header" style={{ letterSpacing: -0.3 }}>
          {title}
        </AppText>
        <AppText size="xs" tone="muted">
          Version {version} · Last updated {updated}
        </AppText>
        <AppText tone="secondary" style={{ paddingTop: space(2), lineHeight: fontSize.sm * 1.625 }}>
          {intro}
        </AppText>
      </View>
      <View style={{ gap: space(6) }}>{children}</View>
    </View>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space(2.5) }}>
      <AppText size="base" weight="semibold" accessibilityRole="header">
        {n}. {title}
      </AppText>
      <View style={{ gap: space(2.5) }}>{children}</View>
    </View>
  );
}

/** A table, drawn as one block per row. The web scrolls a three-column table
 *  sideways on a phone; stacking the row instead - its first cell as the
 *  heading, the rest under their column names - reads without any scrolling
 *  at all. Same props, so the documents port unchanged. */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const c = useColors();
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.hairlineStrong }}>
      {rows.map((row, i) => (
        <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: c.hairline, paddingVertical: space(2.5), gap: space(1) }}>
          <AppText weight="medium">{row[0]}</AppText>
          {row.slice(1).map((cell, j) => (
            <View key={j}>
              <AppText size="xs" tone="muted">
                {head[j + 1]}
              </AppText>
              <AppText tone="secondary" style={{ lineHeight: fontSize.sm * 1.5 }}>
                {cell}
              </AppText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/* The documents' inline pieces - <p>, <strong>, <ul>, links - which React
 * Native has no tags for. */

/** A paragraph of body text. */
export function P({ children }: { children: ReactNode }) {
  return (
    <AppText tone="secondary" style={{ lineHeight: fontSize.sm * 1.625 }}>
      {children}
    </AppText>
  );
}

/** Emphasis inside a paragraph. */
export function Strong({ children }: { children: ReactNode }) {
  const c = useColors();
  return <AppText style={{ fontFamily: fonts.semibold, color: c.ink }}>{children}</AppText>;
}

/** A link to another in-app route. */
export function DocLink({ href, children }: { href: Href; children: ReactNode }) {
  const c = useColors();
  return (
    <Link href={href} style={{ color: c.brand, fontFamily: fonts.regular }}>
      {children}
    </Link>
  );
}

/** A mailto: link - the mail app, as on the web. */
export function MailLink({ to }: { to: string }) {
  const c = useColors();
  return (
    <AppText
      accessibilityRole="link"
      style={{ color: c.brand }}
      onPress={() => void Linking.openURL(`mailto:${to}`).catch(() => {})}
    >
      {to}
    </AppText>
  );
}

/** A bulleted list (`list-disc space-y-1 pl-5`). */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <View style={{ gap: space(1), paddingLeft: space(1) }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", gap: space(2) }}>
          <AppText tone="secondary">{"•"}</AppText>
          <AppText tone="secondary" style={{ flex: 1, lineHeight: fontSize.sm * 1.625 }}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}
