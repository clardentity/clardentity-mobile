// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "graphify-out/*", "inbound md files/*", "android/*", "ios/*"],
  },
  {
    // React Compiler advisories. The app doesn't run the compiler, and the
    // patterns they flag (useRef(new Animated.Value()).current, mutating
    // Reanimated shared values) are the documented React Native idioms, so
    // they stay visible as warnings without failing CI.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
