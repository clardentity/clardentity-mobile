import { px } from "@/lib/theme";

/* The shell's two CSS variables (app/globals.css on the web), as numbers.
 * The notices that float under the top bar - offline, server waking, the
 * arrival greeting - are placed from these, so they live apart from AppShell
 * to keep those small files from importing the whole shell. The safe-area
 * inset is added by whoever places against them. */

/** --topbar-height: 67px. */
export const TOPBAR_HEIGHT = px(67);

/** --sidebar-width: 287px - the phone drawer's width, capped by the screen. */
export const SIDEBAR_WIDTH = px(287);
