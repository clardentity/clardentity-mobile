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

  /* Over-the-air updates (EAS Update). The runtime version is a fingerprint
   * of the native project, so an update only ever reaches builds whose native
   * code it was bundled against; anything that changes native code (a new
   * native module, a permission, an SDK bump) changes the fingerprint and
   * needs a store build instead. The project id is in app.json
   * (extra.eas.projectId, expo.dev/accounts/clardentity/projects/clardentity);
   * EAS_PROJECT_ID overrides it, e.g. for a staging project. */
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;

  return {
    ...config,
    plugins,
    runtimeVersion: { policy: "fingerprint" },
    updates: projectId
      ? { url: `https://u.expo.dev/${projectId}`, checkAutomatically: "ON_LOAD", fallbackToCacheTimeout: 0 }
      : { enabled: false },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
