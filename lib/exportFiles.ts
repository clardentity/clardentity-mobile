import { Directory, File, Paths } from "expo-file-system";

/* Where generated files wait for the share sheet.
 *
 * One folder of their own under the cache, so they can be cleared as a set on
 * sign-out, and so a name from the server can never land anywhere else: an
 * export is someone's answer turned into a document, and it should not
 * outlive the moment it was shared. */

function exportDirectory(): Directory {
  const dir = new Directory(Paths.cache, "exports");
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

/** The server's suggested name, reduced to a plain file name: no path
 *  separators, no leading dots (so never "." or ".."), nothing unprintable.
 *  `fallback` when nothing usable is left. */
export function safeFileName(name: string | null | undefined, fallback: string): string {
  const cleaned = (name ?? "")
    .replace(/[\u0000-\u001f/\\:*?"<>|]/g, "_")
    .replace(/^[.\s]+/, "")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

export function exportFile(name: string): File {
  return new File(exportDirectory(), name);
}

/** Best-effort: a file the share sheet still holds open just stays until
 *  the OS clears the cache. */
export function deleteQuietly(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}

export function clearExportFiles(): void {
  try {
    const dir = new Directory(Paths.cache, "exports");
    if (dir.exists) dir.delete();
  } catch {
    // ignore
  }
}
