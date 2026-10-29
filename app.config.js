/* app.json holds the config; this file only adds what depends on the
 * environment at build time.
 *
 * Google sign-in's config plugin needs the iOS client's reversed ID as a URL
 * scheme, and fails the build without one. So it is added only when
 * EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set; without it the app builds and the
 * Google button stays hidden (components/auth/GoogleSignInButton.tsx). */

module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (iosClientId) {
    const reversed = iosClientId.split(".").reverse().join(".");
    plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: reversed }]);
  }

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
    },
  };
};
