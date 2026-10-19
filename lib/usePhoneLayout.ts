import { useWindowDimensions } from "react-native";

/* The phone layout: below the web's lg breakpoint (1024), where the shell is
 * a drawer. The app is always that layout on a phone; a wide tablet in
 * landscape is the one place this could read false, and it is kept so code
 * ported from the web can ask the same question. */
export function usePhoneLayout(): boolean {
  const { width } = useWindowDimensions();
  return width < 1024;
}
