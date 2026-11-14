import { existsSync, statSync } from "node:fs"
import { isAbsolute, relative, sep } from "node:path"

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

/** Whether `path` exists and is a folder. */
export function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}

/** Whether `path` is `folder` itself or anywhere inside it. */
export function isWithin(folder: string, path: string): boolean {
  const rel = relative(folder, path)
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))
}
