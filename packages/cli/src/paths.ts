import { relative, sep } from "node:path"

/**
 * A path relative to `from`, always with `/`: for findings, reporters, config files and imports,
 * which read the same on every platform. `path.relative` uses `\` on Windows.
 */
export function relativePath(from: string, to: string): string {
  return toPosix(relative(from, to))
}

/** `src\mail` → `src/mail`; unchanged on POSIX. */
export function toPosix(path: string): string {
  return sep === "\\" ? path.replaceAll("\\", "/") : path
}
