import { Stack } from "expo-router";

/* Signed-out screens: login, register, forgot and reset password. Full-bleed,
   no app shell - the same grouping as the web's (auth) route group. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
