import type { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import { fonts, fontSize } from "@/lib/theme";

/* The light formatting the bubble renders - see lib/text.ts for the set
 * and why it is fixed. Inline: **bold**, *italic*, `code`. Block: hyphen
 * bullets, numbered lists, pipe tables, paragraphs. Nothing here knows
 * about citation markers; callers hand in a `leaf` renderer for the plain
 * text runs so the chat can put its [n] pills and opinion markers in, and
 * the crux card can render plain. */

export type InlineSegment =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string };

const INLINE = /(\*\*[^*\n][\s\S]*?\*\*|`[^`\n]+`|(?<![\w*])\*(?!\s)[^*\n]+?(?<!\s)\*(?![\w*]))/g;

export function splitInline(text: string): InlineSegment[] {
  const out: InlineSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    const tok = m[0];
    if (tok.startsWith("**")) out.push({ kind: "bold", text: tok.slice(2, -2) });
    else if (tok.startsWith("`")) out.push({ kind: "code", text: tok.slice(1, -1) });
    else out.push({ kind: "italic", text: tok.slice(1, -1) });
    last = at + tok.length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/* Inline runs as nested <Text>: React Native draws rich text by nesting Text
   inside Text, which also keeps a long answer selectable as one block. The
   caller's outer <Text> sets the colour and size; bold switches the font
   (Android needs a family per weight), code switches to Geist Mono on a
   neutral tint that reads on either theme. */
const inlineStyles = StyleSheet.create({
  bold: { fontFamily: fonts.semibold },
  italic: { fontStyle: "italic" },
  code: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm * 0.9,
    backgroundColor: "rgba(127,127,127,0.14)",
    borderRadius: 4,
  },
});

export function renderInline(
  text: string,
  keyPrefix: string,
  leaf: (text: string, key: string) => ReactNode = (t) => t,
): ReactNode[] {
  return splitInline(text).map((seg, i) => {
    const key = `${keyPrefix}-${i}`;
    if (seg.kind === "bold") return <Text key={key} style={inlineStyles.bold}>{leaf(seg.text, key)}</Text>;
    if (seg.kind === "italic") return <Text key={key} style={inlineStyles.italic}>{leaf(seg.text, key)}</Text>;
    if (seg.kind === "code") return <Text key={key} style={inlineStyles.code}>{` ${seg.text} `}</Text>;
    return <Text key={key}>{leaf(seg.text, key)}</Text>;
  });
}

export type Block =
  | { kind: "text"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; rows: string[][] };

const BULLET = /^\s*-\s+(?=\S)/;
const NUMBERED = /^\s*\d+[.)]\s+(?=\S)/;
const SEPARATOR_ROW = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

export function splitCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function isTableLine(line: string): boolean {
  return line.includes("|") && splitCells(line).length >= 2 && !SEPARATOR_ROW.test(line);
}

/** Paragraph text, lists and tables, in document order. A run of two or
 *  more pipe rows with a matching cell count is a table; a run of hyphen
 *  or numbered lines is a list (one item per line - the prompt asks for one
 *  claim per item, so items don't wrap onto continuation lines). */
export function splitBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let buffer: string[] = [];
  const flushText = () => {
    if (buffer.length) blocks.push({ kind: "text", text: buffer.join("\n") });
    buffer = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isTableLine(line)) {
      const width = splitCells(line).length;
      let j = i;
      const rows: string[][] = [];
      while (j < lines.length) {
        if (SEPARATOR_ROW.test(lines[j])) {
          j++;
          continue;
        }
        if (!isTableLine(lines[j])) break;
        const cells = splitCells(lines[j]);
        if (Math.abs(cells.length - width) > 1) break;
        rows.push(cells);
        j++;
      }
      if (rows.length >= 2) {
        flushText();
        blocks.push({ kind: "table", rows });
        i = j;
        continue;
      }
    }
    const bullet = BULLET.test(line);
    const numbered = !bullet && NUMBERED.test(line);
    if (bullet || numbered) {
      const marker = bullet ? BULLET : NUMBERED;
      const items: string[] = [];
      let j = i;
      while (j < lines.length && marker.test(lines[j])) {
        items.push(lines[j].replace(marker, ""));
        j++;
      }
      flushText();
      blocks.push({ kind: "list", ordered: numbered, items });
      i = j;
      continue;
    }
    buffer.push(line);
    i++;
  }
  flushText();
  return blocks;
}
