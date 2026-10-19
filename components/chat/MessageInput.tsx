import { useRef, useState, type ReactNode, type RefObject } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { File as FsFile } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AudioRecorder } from "@/components/upload/AudioRecorder";
import { VendorModelPicker } from "@/components/chat/VendorModelPicker";
import { PICKABLE_MODES } from "@/lib/pickableModels";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { useTouchKeyboard } from "@/lib/useTouchKeyboard";
import { usePhoneLayout } from "@/lib/usePhoneLayout";
import { track } from "@/lib/analytics";
import { fonts, fontSize, px, radius, space, useColors, useThemedStyles, type Colors } from "@/lib/theme";
import { tourRef } from "@/components/tour/TourOverlay";

/** Tallest the composer's text box grows before it scrolls - about five
 *  lines on a phone, about eight at the desktop's larger type. Past that it
 *  scrolls inside, so a pasted page never pushes the thread off the screen.
 *  A multiline TextInput grows with its text by itself, so the cap is all
 *  the web's fitComposer measuring comes down to here (a maxHeight). */
const COMPOSER_MAX_HEIGHT_PHONE = 120;
const COMPOSER_MAX_HEIGHT_DESKTOP = 220;

/** Something the next message carries. An image goes to the model as
 *  vision context; a document is read on the server and its text put in
 *  front of the model (and into the workspace for later questions). */
export type PendingAttachment = {
  kind: "image" | "document";
  data: string;
  mimeType: string;
  filename: string;
  /** Images only: the picked file's local uri, for the thumbnail (the web
   *  used a data URL). */
  previewUrl?: string;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
/** How many files one message can carry. */
const MAX_ATTACHMENTS = 10;
/** Mirrors SUPPORTED_TYPES / LEGACY_TYPES in the backend's document_ingestion. */
export const DOCUMENT_EXTENSIONS = [
  "pdf", "docx", "xlsx", "xlsm", "pptx", "txt", "md", "markdown", "csv", "tsv",
  "json", "xml", "html", "htm", "rtf", "log", "yaml", "yml",
];
const LEGACY_EXTENSIONS: Record<string, string> = { doc: "docx", xls: "xlsx", ppt: "pptx" };
/** The web's <input accept> string. The native pickers filter by MIME type,
 *  not extension, so they open on everything and attachmentProblem decides. */
export const DOCUMENT_ACCEPT = DOCUMENT_EXTENSIONS.map((e) => `.${e}`).join(",");

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** A file the pickers handed back - the parts of a web File the checks use,
 *  plus where it lives on the device. */
export type PickedFile = { name: string; size: number; type: string; uri: string };

/** Why a file can't be attached, or null when it can. */
export function attachmentProblem(file: Pick<PickedFile, "name" | "size" | "type">): string | null {
  if (file.type.startsWith("image/")) {
    return file.size > MAX_IMAGE_BYTES ? "Images must be under 5MB" : null;
  }
  const ext = fileExtension(file.name);
  if (LEGACY_EXTENSIONS[ext]) {
    return `.${ext} is the old binary format - save it as .${LEGACY_EXTENSIONS[ext]} and attach that`;
  }
  if (!DOCUMENT_EXTENSIONS.includes(ext)) {
    return "That file type isn't supported. Use PDF, Word, Excel, PowerPoint, images, or a text file";
  }
  return file.size > MAX_DOCUMENT_BYTES ? "Documents must be under 25MB" : null;
}

/* Not ported: the web's pastedFiles (pasting a screenshot or a copied file
 * into the box) and dropping files on the card. A native TextInput only
 * ever pastes text, and there is nothing to drag onto a phone's composer -
 * the paperclip's sheet (photos, camera, files) is the one road in. */

/* Not ported either: autocorrect and the grey inline completion.
 * lib/autocorrect's autocorrectSupported() is false in the app - the OS
 * keyboard corrects and suggests, and two correctors fight - and the ghost
 * text depended on a mirror layer drawn exactly behind the textarea's
 * glyphs, which a native TextInput gives no way to line up. The box asks the
 * keyboard for its own correction instead (autoCorrect, spellCheck). */

function StopIcon({ color }: { color: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={px(14)} height={px(14)} fill={color}>
      <Rect x="6" y="6" width="12" height="12" rx="2" />
    </Svg>
  );
}

/** The text is controlled by the parent rather than held here, because editing
 *  a sent message has to put that message back in the box. Pushing text into a
 *  child that owns it means an effect that writes state on every change - the
 *  parent owning it makes the same feature a plain assignment. (The parent
 *  also keeps the draft per chat in lib/storage's sessionStorage, as on the
 *  web.) */
export function MessageInput({
  disabled,
  disabledReason,
  value,
  onChange,
  onSend,
  onTypingChange,
  textareaRef,
  onStartCall,
  trailing,
  onModelLocked,
  mode,
  isGenerating,
  onStop,
  gated,
}: {
  disabled: boolean;
  disabledReason?: string;
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string, attachments: PendingAttachment[]) => void;
  onTypingChange?: (isTyping: boolean) => void;
  textareaRef?: RefObject<TextInputInstance | null>;
  /** Owned by the conversation, not the composer: a finished call has to be
   *  saved into the thread, and the composer doesn't know which thread. */
  onStartCall?: () => void;
  /** Rendered in the foot of the card, beside the model chip. The design puts
   *  the controls that describe *how* the answer is produced there, which is
   *  where switching belongs now that the rail spans the full width. */
  trailing?: ReactNode;
  /** Which companion is selected. Only used to decide whether a model
   *  picker belongs here at all: Co-Creative names the models; every other
   *  mode has none (the capability tiers are plans, under Upgrade in the
   *  account menu). */
  mode?: string | null;
  /** True while an answer is being generated - swaps the send button for a
   *  stop control instead of just greying it out, so cutting a slow or
   *  unwanted answer off doesn't mean waiting it out. */
  isGenerating?: boolean;
  onStop?: () => void;
  /** Set only by the landing page's guest demo, which shows this composer to
   *  someone who has no account. Attaching a file, dictating and choosing a
   *  model all need one, so each control stays exactly where it is and calls
   *  this instead of doing its job - the row is the product's own, and the
   *  answer to pressing one is an invitation rather than a dead button. The
   *  call button needs nothing here: it already does whatever `onStartCall`
   *  says, and the demo passes an invitation. */
  gated?: (feature: "attach" | "voice" | "model") => void;
  /** A greyed model was tapped in a mode where picking one is not part of
   *  the plan - the caller shows the plans. Gets the model's name. */
  onModelLocked?: (label: string) => void;
}) {
  const s = useThemedStyles(styles);
  const colors = useColors();
  const touchKeyboard = useTouchKeyboard();
  const phoneLayout = usePhoneLayout();
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const fallbackTextareaRef = useRef<TextInputInstance>(null);
  const taRef = textareaRef ?? fallbackTextareaRef;

  function handleChange(newValue: string) {
    onChange(newValue);
    onTypingChange?.(newValue.trim().length > 0);
  }

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, attachments);
    onChange("");
    setAttachments([]);
    onTypingChange?.(false);
  }

  /* The paperclip opens a small sheet - photos, the camera, or a file -
     since a phone has three places a thing to attach can come from, where
     the web's one file input covered them all. */
  async function pickFrom(source: "library" | "camera" | "files") {
    setAttachError(null);
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setAttachError(`Up to ${MAX_ATTACHMENTS} attachments per message`);
      return;
    }
    try {
      let files: PickedFile[] = [];
      if (source === "files") {
        const result = await DocumentPicker.getDocumentAsync({
          type: "*/*",
          multiple: true,
          copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        files = result.assets.map((a) => ({
          name: a.name,
          size: a.size ?? new FsFile(a.uri).size,
          type: a.mimeType ?? "",
          uri: a.uri,
        }));
      } else {
        if (source === "camera") {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            setAttachError("Camera access denied - allow it in Settings to take a photo");
            return;
          }
        }
        const options: ImagePicker.ImagePickerOptions = {
          mediaTypes: ["images"],
          allowsMultipleSelection: source === "library",
          selectionLimit: room,
        };
        const result =
          source === "camera"
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync(options);
        if (result.canceled) return;
        files = result.assets.map((a, i) => {
          const type = a.mimeType ?? "image/jpeg";
          return {
            name: a.fileName ?? `photo-${Date.now()}-${i}.${type.split("/")[1] ?? "jpg"}`,
            size: a.fileSize ?? new FsFile(a.uri).size,
            type,
            uri: a.uri,
          };
        });
      }
      await addFiles(files, "picker");
    } catch {
      setAttachError("That file couldn't be read");
    }
  }

  async function addFiles(files: PickedFile[], via: "picker") {
    if (files.length === 0) return;

    let count = attachments.length;
    for (const file of files) {
      if (count >= MAX_ATTACHMENTS) {
        setAttachError(`Up to ${MAX_ATTACHMENTS} attachments per message`);
        break;
      }
      const problem = attachmentProblem(file);
      if (problem) {
        setAttachError(problem);
        continue;
      }
      // Base64 of the file's bytes, which is what SendMessageAttachment
      // carries - read straight from disk rather than through a data URL.
      const base64 = await new FsFile(file.uri).base64();
      const isImage = file.type.startsWith("image/");
      track("attachment_added", {
        kind: isImage ? "image" : "document",
        extension: isImage ? undefined : fileExtension(file.name),
        size_kb: Math.round(file.size / 1024),
        via,
      });
      count += 1;
      setAttachments((prev) => [
        ...prev,
        isImage
          ? { kind: "image", data: base64, mimeType: file.type, filename: file.name, previewUrl: file.uri }
          : { kind: "document", data: base64, mimeType: file.type || "application/octet-stream", filename: file.name },
      ]);
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  const sendDisabled = isGenerating ? !onStop : disabled || !value.trim();

  return (
    <View style={{ gap: space(1) }}>
      {attachments.length > 0 && (
        <View style={s.attachments}>
          {attachments.map((item, i) => (
            <View key={i}>
              {item.kind === "image" ? (
                <Image source={{ uri: item.previewUrl }} accessibilityLabel="Attached" contentFit="cover" style={s.thumb} />
              ) : (
                <View style={s.docChip} accessibilityLabel={item.filename}>
                  <Text style={s.docExt}>{fileExtension(item.filename) || "file"}</Text>
                  <Text numberOfLines={1} style={s.docName}>
                    {item.filename}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => removeAttachment(i)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.kind === "image" ? "image" : item.filename}`}
                hitSlop={12}
                style={({ pressed }) => [s.remove, pressed && { opacity: 0.8 }]}
              >
                <Text style={s.removeText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {attachError ? <Text style={[s.small, { color: colors.bandLow }]}>{attachError}</Text> : null}

      {/* No focus treatment on the composer. It is the one control on the
          page whose whole purpose is to be typed into, so ringing it in the
          accent colour every time the caret lands there was decoration that
          fired constantly and told you nothing you didn't already know. The
          caret is the indicator. */}
      <View
        ref={tourRef("composer")} collapsable={false}
        // The design's composer: one tall white card, 20px radius, a hairline
        // and a soft shadow, with the question on top and the controls along
        // the foot. Not a row - the text gets the full width.
        style={s.card}
      >
        <View ref={tourRef("composer-input")} collapsable={false} style={[s.textWrap, !phoneLayout && s.textWrapWide]}>
          <TextInput
            ref={taRef}
            value={value}
            onChangeText={handleChange}
            multiline
            // Return is the new-line key, as on the web's touch layout: there
            // is no Shift to hold, and sending on Return meant half-written
            // questions went out. The arrow is the only way to send.
            submitBehavior={touchKeyboard ? "newline" : "submit"}
            onSubmitEditing={touchKeyboard ? undefined : handleSend}
            editable={!disabled}
            // Explicit, not left to the platform default: the keyboard's own
            // spelling correction is the free Grammarly tier people asked for.
            spellCheck
            autoCorrect
            autoCapitalize="sentences"
            placeholder={
              // The fallback is deliberately neutral. It used to be "Select a
              // mode to start typing", which is true of exactly one of the
              // reasons this box gets disabled and actively wrong about the
              // others - a caller that disabled it mid-answer got an
              // instruction the user had already followed.
              disabled ? disabledReason ?? "One moment…" : "Ask a question…"
            }
            placeholderTextColor={colors.inkMuted}
            accessibilityHint={touchKeyboard ? "Return starts a new line - tap the arrow to send" : undefined}
            style={[
              s.input,
              { maxHeight: phoneLayout ? COMPOSER_MAX_HEIGHT_PHONE : COMPOSER_MAX_HEIGHT_DESKTOP },
              disabled && { opacity: 0.7 },
            ]}
          />
        </View>

        {/* The foot of the card, as drawn: the paperclip alone on the left,
            and on the right the chip that says how the answer is made, then
            the voice controls, then the send disc. The buttons keep a 44pt
            reach through hitSlop and are spaced so those areas don't
            overlap. */}
        <View style={[s.foot, !phoneLayout && s.footWide]}>
          <Pressable
            ref={tourRef("attach-image")} collapsable={false}
            onPress={() => (gated ? gated("attach") : setSheetOpen(true))}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Attach a file or image"
            hitSlop={6}
            style={({ pressed }) => [s.iconButton, { marginLeft: -space(1.5) }, pressed && s.pressed, disabled && s.off]}
          >
            {({ pressed }) => (
              <MaskIcon src="/ui/composer-paperclip.svg" size={px(20)} color={pressed ? colors.brand : colors.inkMuted} />
            )}
          </Pressable>

          <View style={[s.controls, { gap: phoneLayout ? space(4) : space(1) }]}>
            {/* Every mode since 2026-10-16. Where choosing is not part of
                the plan the menu still shows what exists, greyed, rather
                than hiding it - the choice is an upgrade, not a secret. */}
            {mode ? (
              gated ? (
                // The chip, without the menu behind it. Same shape and the
                // same place, so the foot of the card reads as it does in
                // the app.
                <Pressable
                  onPress={() => gated("model")}
                  accessibilityRole="button"
                  accessibilityLabel="Choose which model answers in this mode"
                  hitSlop={6}
                  style={({ pressed }) => [s.chip, pressed && s.pressed]}
                >
                  <Text style={s.chipText}>Auto</Text>
                  <Svg viewBox="0 0 24 24" width={px(14)} height={px(14)} fill="none" stroke={colors.inkMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="m6 9 6 6 6-6" />
                  </Svg>
                </Pressable>
              ) : (
                <VendorModelPicker
                  mode={mode}
                  disabled={disabled}
                  locked={!PICKABLE_MODES.has(mode)}
                  onLocked={onModelLocked}
                />
              )
            ) : null}
            {trailing}

            {/* Next to the mic, because they are the same intention at two
                lengths: dictate one message, or have a conversation. */}
            <Pressable
              ref={tourRef("live-call")} collapsable={false}
              onPress={() => {
                track("call_started");
                onStartCall?.();
              }}
              disabled={disabled || !onStartCall}
              accessibilityRole="button"
              accessibilityLabel="Start a live call"
              hitSlop={6}
              style={({ pressed }) => [s.iconButton, pressed && s.pressed, (disabled || !onStartCall) && s.off]}
            >
              {/* The dialpad. A keypad is what you press to place a call,
                  and this is the button that places one. The waveform it
                  replaces said "audio" without saying what would happen. */}
              {({ pressed }) => (
                <MaskIcon src="/ui/composer-dialpad.svg" size={px(20)} color={pressed ? colors.brand : colors.inkMuted} />
              )}
            </Pressable>

            {gated ? (
              // The recorder's idle face, button for button. It never starts
              // a recording, so it never asks for the microphone either -
              // a permission prompt for a feature that cannot run would be
              // the rudest possible way to ask someone to sign up.
              <Pressable
                onPress={() => gated("voice")}
                accessibilityRole="button"
                accessibilityLabel="Record a voice message"
                hitSlop={6}
                style={({ pressed }) => [s.iconButton, pressed && s.pressed]}
              >
                {({ pressed }) => (
                  <Svg
                    viewBox="0 0 24 24"
                    width={px(20)}
                    height={px(20)}
                    fill="none"
                    stroke={pressed ? colors.brand : colors.inkMuted}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <Path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
                  </Svg>
                )}
              </Pressable>
            ) : (
              <AudioRecorder
                disabled={disabled}
                onTranscribed={(text) => {
                  track("voice_recorded", { words: text.trim().split(/\s+/).length });
                  handleChange((value ? value + " " : "") + text);
                }}
              />
            )}

            {/* While generating this becomes a stop control rather than a
                disabled "Ask" - the answer might be slow, wrong-mode, or just
                no longer wanted, and waiting it out was the only option
                before. */}
            <Pressable
              ref={tourRef("ask-button")} collapsable={false}
              onPress={isGenerating ? onStop : handleSend}
              disabled={sendDisabled}
              // A burgundy disc at the end of the row, as drawn. It keeps its
              // accessible name - the circle alone says nothing to a screen
              // reader - and still becomes a stop control mid-answer.
              accessibilityRole="button"
              accessibilityLabel={isGenerating ? "Stop generating" : "Ask"}
              accessibilityState={{ disabled: sendDisabled }}
              hitSlop={4}
              style={({ pressed }) => [
                s.send,
                { width: phoneLayout ? px(36) : px(32), height: phoneLayout ? px(36) : px(32) },
                isGenerating
                  ? { backgroundColor: pressed ? colors.surfaceHover : colors.surfaceSunken }
                  : // Grey while there is nothing to send. It was a full
                    // burgundy disc whether or not it would do anything,
                    // so the one control that is supposed to say "ready"
                    // looked identical when it was not.
                    { backgroundColor: sendDisabled ? colors.surfaceSunken : pressed ? colors.brandDark : colors.brand },
              ]}
            >
              {isGenerating ? (
                <StopIcon color={colors.ink} />
              ) : (
                // One face: an arrow that greys out says "not yet" without
                // the glyph changing under the reader's eye.
                <Svg
                  viewBox="0 0 20 20"
                  width={px(20)}
                  height={px(20)}
                  fill="none"
                  stroke={sendDisabled ? colors.inkMuted : "#ffffff"}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d="M10 16V4.5M4.6 9.9 10 4.5l5.4 5.4" />
                </Svg>
              )}
            </Pressable>
          </View>
        </View>
      </View>
      {disabled && disabledReason ? <Text style={[s.small, { color: colors.inkMuted }]}>{disabledReason}</Text> : null}
      {/* No standing keyboard hint under the card - the design puts nothing
          there, and a line of grey type that never changes stops being read
          after the first visit. */}

      <AttachSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPick={(source) => {
          setSheetOpen(false);
          // iOS will not present the picker while the sheet is still
          // animating away, so it waits for the fade to finish.
          setTimeout(() => void pickFrom(source), Platform.OS === "ios" ? 400 : 0);
        }}
      />
    </View>
  );
}

/** Where an attachment comes from: the photo library, the camera, or the
 *  Files app / storage. A bottom sheet, as the app's other menus are. */
function AttachSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (source: "library" | "camera" | "files") => void;
}) {
  const s = useThemedStyles(sheetStyles);
  const insets = useSafeAreaInsets();
  const options: Array<{ source: "library" | "camera" | "files"; label: string }> = [
    { source: "library", label: "Photo library" },
    { source: "camera", label: "Take a photo" },
    { source: "files", label: "Choose a file" },
  ];
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[s.sheet, { paddingBottom: space(3) + insets.bottom }]} onPress={() => {}}>
          <Text style={s.title}>Attach</Text>
          {options.map((o) => (
            <Pressable
              key={o.source}
              onPress={() => onPick(o.source)}
              accessibilityRole="button"
              style={({ pressed }) => [s.option, pressed && s.pressed]}
            >
              <Text style={s.optionText}>{o.label}</Text>
            </Pressable>
          ))}
          <Text style={s.hint}>Images up to 5MB; PDF, Word, Excel, PowerPoint or text files up to 25MB.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    attachments: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
    thumb: { width: px(56), height: px(56), borderRadius: radius.md, borderWidth: 1, borderColor: c.hairlineStrong },
    docChip: {
      height: px(56),
      maxWidth: px(220),
      flexDirection: "row",
      alignItems: "center",
      gap: space(2),
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.hairlineStrong,
      backgroundColor: c.surfaceMuted,
      paddingHorizontal: space(2.5),
    },
    docExt: {
      borderRadius: radius.base,
      backgroundColor: c.surface,
      paddingHorizontal: space(1),
      paddingVertical: space(0.5),
      fontFamily: fonts.semibold,
      fontSize: fontSize.xs,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: c.inkMuted,
      overflow: "hidden",
    },
    docName: { flexShrink: 1, fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkSecondary },
    remove: {
      position: "absolute",
      right: -space(1.5),
      top: -space(1.5),
      width: px(16),
      height: px(16),
      borderRadius: 9999,
      backgroundColor: c.ink,
      alignItems: "center",
      justifyContent: "center",
    },
    removeText: { fontSize: px(10), lineHeight: px(12), color: c.surface, fontFamily: fonts.regular },
    small: { fontFamily: fonts.regular, fontSize: fontSize.xs },
    // The web stacks five near-transparent black shadows; one soft one
    // stands in for them.
    card: {
      borderRadius: px(20),
      borderWidth: 1,
      borderColor: c.hairlineStrong,
      backgroundColor: c.surfaceRaised,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 14 },
      elevation: 3,
    },
    textWrap: { paddingHorizontal: space(4), paddingTop: space(3.5) },
    textWrapWide: { paddingHorizontal: px(27), paddingTop: px(26), minHeight: px(124) - px(47) },
    input: {
      padding: 0,
      fontFamily: fonts.regular,
      fontSize: fontSize.lg,
      color: c.ink,
      textAlignVertical: "top",
    },
    foot: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: space(3.5),
      paddingRight: space(3),
      paddingTop: space(2.5),
      paddingBottom: space(2),
    },
    footWide: { paddingHorizontal: px(27), paddingBottom: px(15) },
    controls: { marginLeft: "auto", minWidth: 0, flexDirection: "row", alignItems: "center", flexShrink: 1 },
    iconButton: { width: px(32), height: px(32), flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: radius.lg },
    pressed: { backgroundColor: c.surfaceHover },
    off: { opacity: 0.5 },
    chip: { flexDirection: "row", alignItems: "center", gap: space(1), borderRadius: radius.md, paddingHorizontal: space(2), paddingVertical: space(1) },
    chipText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.inkMuted },
    send: { marginRight: -px(5), flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 9999 },
  });

const sheetStyles = (c: Colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
    sheet: {
      borderTopLeftRadius: px(20),
      borderTopRightRadius: px(20),
      backgroundColor: c.surfaceRaised,
      paddingHorizontal: space(4),
      paddingTop: space(4),
      gap: space(1),
    },
    title: { marginBottom: space(2), fontFamily: fonts.semibold, fontSize: fontSize.sm, color: c.ink },
    option: { borderRadius: radius.lg, paddingHorizontal: space(3), paddingVertical: space(3) },
    optionText: { fontFamily: fonts.regular, fontSize: fontSize.lg, color: c.ink },
    pressed: { backgroundColor: c.surfaceHover },
    hint: { marginTop: space(2), fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.inkMuted },
  });
