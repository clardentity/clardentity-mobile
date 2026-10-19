import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { apiFetch } from "@/lib/apiClient";
import { track } from "@/lib/analytics";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";

/* "Was this helpful?" - a thumb, or a thumb and a sentence, on one answer.
 *
 * Deliberately small and quiet: this sits under every single response, so
 * anything louder than a row of small icons would be the one thing you see on
 * every message in a long thread. A rating is optimistic and instant -
 * there's nothing to wait on - and toggles off if you tap the same one twice,
 * the same contract as any other like button.
 *
 * Rating and comment are one object server-side (see PUT .../feedback), so
 * every save sends both fields together - saving a rating alone must not
 * silently erase a comment already left, and vice versa.
 */

export type MessageFeedback = { rating: "up" | "down" | null; comment: string | null };

export function FeedbackWidget({
  conversationId,
  messageId,
  feedback,
}: {
  conversationId: string;
  messageId: string;
  feedback: MessageFeedback | null;
}) {
  const [rating, setRating] = useState<"up" | "down" | null>(feedback?.rating ?? null);
  const [comment, setComment] = useState<string | null>(feedback?.comment ?? null);
  const [draft, setDraft] = useState(feedback?.comment ?? "");
  const [commentOpen, setCommentOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const c = useColors();
  const s = useThemedStyles(styles);

  async function save(next: { rating: "up" | "down" | null; comment: string | null }) {
    setSaving(true);
    try {
      await apiFetch(`/chat/${conversationId}/messages/${messageId}/feedback`, {
        method: "PUT",
        body: next,
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch {
      // Best-effort: a failed vote isn't worth an error banner under every
      // message. The buttons stay interactive, so trying again costs one tap.
    } finally {
      setSaving(false);
    }
  }

  function toggleRating(value: "up" | "down") {
    const next = rating === value ? null : value;
    track("feedback_given", { rating: next ?? "cleared" });
    setRating(next);
    void save({ rating: next, comment });
  }

  function submitComment() {
    const trimmed = draft.trim();
    const next = trimmed.length > 0 ? trimmed : null;
    setComment(next);
    setCommentOpen(false);
    void save({ rating, comment: next });
  }

  function cancelComment() {
    setDraft(comment ?? "");
    setCommentOpen(false);
  }

  return (
    <View style={s.root}>
      {/* Wraps: on the narrowest phones the buttons drop under the question
          instead of squeezing it onto several lines. */}
      <View style={s.row}>
        <Text style={s.muted} numberOfLines={1}>
          Was this helpful?
        </Text>
        <Pressable
          onPress={() => toggleRating("up")}
          disabled={saving}
          accessibilityRole="button"
          accessibilityState={{ selected: rating === "up", disabled: saving }}
          accessibilityLabel="Mark this answer helpful"
          hitSlop={8}
          style={({ pressed }) => [s.thumb, pressed && { backgroundColor: c.surfaceHover }, saving && { opacity: 0.4 }]}
        >
          <ThumbIcon direction="up" filled={rating === "up"} color={rating === "up" ? c.bandHigh : c.inkMuted} />
        </Pressable>
        <Pressable
          onPress={() => toggleRating("down")}
          disabled={saving}
          accessibilityRole="button"
          accessibilityState={{ selected: rating === "down", disabled: saving }}
          accessibilityLabel="Mark this answer not helpful"
          hitSlop={8}
          style={({ pressed }) => [s.thumb, pressed && { backgroundColor: c.surfaceHover }, saving && { opacity: 0.4 }]}
        >
          <ThumbIcon direction="down" filled={rating === "down"} color={rating === "down" ? c.bandLow : c.inkMuted} />
        </Pressable>
        {!commentOpen && (
          <Pressable
            onPress={() => {
              setDraft(comment ?? "");
              setCommentOpen(true);
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [s.link, pressed && { backgroundColor: c.surfaceHover }]}
          >
            <Text style={s.linkText}>{comment ? "Edit comment" : "Other"}</Text>
          </Pressable>
        )}
        {justSaved && !commentOpen && <Text style={s.thanks}>Thanks</Text>}
      </View>

      {commentOpen && (
        <View style={s.editor}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            // The return key sends, as Enter did on the web. Cancel replaces
            // the web's Escape.
            submitBehavior="submit"
            returnKeyType="send"
            onSubmitEditing={submitComment}
            autoFocus
            placeholder="What would have made this better?"
            placeholderTextColor={c.inkMuted}
            textAlignVertical="top"
            style={s.input}
          />
          <View style={s.editorActions}>
            <Pressable
              onPress={submitComment}
              disabled={saving}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [s.send, pressed && { backgroundColor: c.brandDark }, saving && { opacity: 0.4 }]}
            >
              <Text style={s.sendText}>Send</Text>
            </Pressable>
            <Pressable
              onPress={cancelComment}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [s.cancel, pressed && { backgroundColor: c.surfaceHover }]}
            >
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!commentOpen && comment ? <Text style={s.comment}>“{comment}”</Text> : null}
    </View>
  );
}

function ThumbIcon({ direction, filled, color }: { direction: "up" | "down"; filled: boolean; color: string }) {
  const size = px(14);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : "none"}
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={direction === "down" ? { transform: [{ rotate: "180deg" }] } : undefined}
    >
      <Path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4.5-8a2 2 0 0 1 2.24.6l.16.22A3 3 0 0 1 14.4 5v4h4.13a2 2 0 0 1 1.98 2.28l-1.2 8A2 2 0 0 1 17.34 21H10a3 3 0 0 1-3-3" />
    </Svg>
  );
}

const MAX_W = 448; // max-w-md

const styles = (c: Colors) =>
  StyleSheet.create({
    root: { marginTop: space(1.5), gap: space(1.5) },
    row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space(2) },
    muted: { fontSize: fontSize.xs, fontFamily: fonts.regular, color: c.inkMuted },
    thumb: { borderRadius: radius.md, padding: space(1) },
    link: { borderRadius: radius.md, paddingHorizontal: space(1.5), paddingVertical: space(0.5) },
    linkText: {
      fontSize: fontSize.xs,
      fontFamily: fonts.regular,
      color: c.inkMuted,
      textDecorationLine: "underline",
      textDecorationColor: c.hairlineStrong,
    },
    thanks: { fontSize: fontSize.xs, fontFamily: fonts.regular, color: c.inkSecondary },
    editor: { maxWidth: MAX_W },
    input: {
      width: "100%",
      minHeight: fontSize.xs * 1.5 * 2 + space(3),
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.hairline,
      backgroundColor: c.surface,
      paddingHorizontal: space(2.5),
      paddingVertical: space(1.5),
      fontSize: fontSize.xs,
      fontFamily: fonts.regular,
      color: c.ink,
    },
    editorActions: { marginTop: space(1), flexDirection: "row", alignItems: "center", gap: space(2) },
    send: { borderRadius: radius.full, backgroundColor: c.brand, paddingHorizontal: space(2.5), paddingVertical: space(1) },
    sendText: { fontSize: fontSize.xs, fontFamily: fonts.medium, color: "#ffffff" },
    cancel: { borderRadius: radius.full, paddingHorizontal: space(2), paddingVertical: space(1) },
    cancelText: { fontSize: fontSize.xs, fontFamily: fonts.regular, color: c.inkSecondary },
    comment: { maxWidth: MAX_W, fontSize: fontSize.xs, fontFamily: fonts.regular, color: c.inkSecondary },
  });
