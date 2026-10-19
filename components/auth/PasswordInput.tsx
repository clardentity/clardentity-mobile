import { useState, type Ref } from "react";
import { Pressable, View, type TextInputInstance, type TextInputProps } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Input } from "@/components/ui/primitives";
import { inputRef } from "@/components/auth/AuthScreen";
import { px, radius, useColors } from "@/lib/theme";

/* A password field you can read back.
 *
 * Typing a password you cannot see, into a form that only tells you it was
 * wrong after you submit, is the whole reason people get locked out of
 * accounts they know the password to. The reveal is off by default and
 * reverts on every render of a fresh field, so it never leaks a password to
 * someone who walks up to an already-open screen. */
export function PasswordInput({
  style,
  ref,
  ...rest
}: Omit<TextInputProps, "secureTextEntry"> & { ref?: Ref<TextInputInstance> }) {
  const [visible, setVisible] = useState(false);
  const c = useColors();
  const [pressed, setPressed] = useState(false);

  return (
    <View>
      <Input
        {...inputRef(ref)}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        {...rest}
        secureTextEntry={!visible}
        // Room for the toggle, so a long password doesn't run underneath it.
        style={[{ paddingRight: px(44) }, style]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          height: px(44),
          width: px(44),
          alignItems: "center",
          justifyContent: "center",
          borderTopRightRadius: radius.lg,
          borderBottomRightRadius: radius.lg,
        }}
      >
        <Svg
          viewBox="0 0 24 24"
          width={px(16)}
          height={px(16)}
          fill="none"
          stroke={pressed ? c.ink : c.inkMuted}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {visible ? (
            <>
              <Path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.6 18.6 0 0 0 2 12s3 8 10 8a9.1 9.1 0 0 0 5.39-1.61" />
              <Path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              <Path d="m2 2 20 20" />
            </>
          ) : (
            <>
              <Path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
              <Circle cx="12" cy="12" r="3" />
            </>
          )}
        </Svg>
      </Pressable>
    </View>
  );
}
