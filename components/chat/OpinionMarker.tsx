import { useState } from "react";
import { Text } from "react-native";
import { fonts, fontSize, useColors } from "@/lib/theme";

/** Inline tag after a sentence the model marked as its own view rather than a
 *  sourced fact. Opinions carry no citation, so without this they had no
 *  visible marker at all once the evidence panel went - a reader couldn't tell
 *  a sourced sentence from an unsourced one. Tap to read what the tag means;
 *  a tooltip alone would be invisible on a phone. Rendered as nested Text
 *  because it sits inside the answer's own Text. */
export function OpinionMarker() {
  const [open, setOpen] = useState(false);
  const c = useColors();
  return (
    <>
      <Text
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Stated as an opinion - Clardentity's own view, not a sourced fact"
        style={{
          fontSize: fontSize.xs * 0.85,
          fontFamily: fonts.semibold,
          letterSpacing: 0.4,
          color: c.inkSecondary,
          backgroundColor: c.surfaceMuted,
        }}
      >
        {" OPINION "}
      </Text>
      {open && (
        <Text
          style={{
            fontSize: fontSize.xs,
            fontFamily: fonts.regular,
            fontStyle: "normal",
            color: c.inkSecondary,
            backgroundColor: c.surfaceRaised,
          }}
        >
          {" "}
          Stated as an opinion: Clardentity&apos;s own view on this, not something a source backs. Weigh it as you
          would a person&apos;s take.{" "}
        </Text>
      )}
    </>
  );
}
