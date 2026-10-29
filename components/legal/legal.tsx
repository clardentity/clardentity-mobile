import { Link, type Href } from "expo-router";
import { isValidElement, type ReactNode } from "react";
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
/** Plain text of a cell, for sizing its column. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** Column shares as a browser's automatic table layout works them out, in
 *  characters: every column gets its longest word, and the room left over is
 *  shared out by how much more each column would take on one line. */
function columnShares(head: string[], rows: ReactNode[][]): number[] {
  const cols = head.map((h, j) => [h, ...rows.map((r) => textOf(r[j]))]);
  const min = cols.map((cells) => Math.max(...cells.flatMap((t) => t.split(/\s+/).map((w) => w.length))));
  const max = cols.map((cells) => Math.max(...cells.map((t) => t.length)));
  const room = 46; // characters across a phone, less the cells' right padding
  const spare = Math.max(0, room - min.reduce((a, b) => a + b, 0));
  const extra = max.map((m, j) => m - min[j]);
  const totalExtra = extra.reduce((a, b) => a + b, 0) || 1;
  return min.map((m, j) => m + (spare * extra[j]) / totalExtra);
}

/** The web's table, as a table: a heading row over hairline-ruled rows, the
 *  columns sized as the browser sizes them. */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const c = useColors();
  const shares = columnShares(head, rows);
  const lineHeight = fontSize.sm * 1.43;
  return (
    <View>
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.hairlineStrong, paddingBottom: space(2) }}>
        {head.map((h, j) => (
          <View key={h} style={{ flex: shares[j], paddingRight: space(4) }}>
            <AppText weight="medium" style={{ lineHeight }}>
              {h}
            </AppText>
          </View>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.hairline, paddingVertical: space(2) }}>
          {row.map((cell, j) => (
            <View key={j} style={{ flex: shares[j], paddingRight: space(4) }}>
              <AppText tone="secondary" style={{ lineHeight }}>
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
