import { existsSync, readFileSync } from "node:fs"

import { relativePath } from "../../paths.ts"

import type { Location, Problem } from "./errors.ts"

/**
 * A problem at `location`, with its file shown relative to `base` and a code frame when the file
 * can be read.
 */
export function problemAt(
  code: string,
  message: string,
  location: Location,
  base: string,
): Problem {
  const frame = codeFrame(location)
  return {
    code,
    message,
    file: relativePath(base, location.file),
    line: location.line,
    column: location.column,
    ...(frame && { frame }),
  }
}

/**
 * Two lines either side, the line itself marked, and a caret under the column. Tabs are shown as
 * two spaces, so the caret lines up.
 *
 * ```text
 *   11 |   <Text>
 * > 12 |   {data.name)
 *      |             ^
 *   13 |   </Text>
 * ```
 */
export function codeFrame(location: Location, context = 2): string | undefined {
  if (!existsSync(location.file)) return undefined
  const lines = readFileSync(location.file, "utf8").split(/\r?\n/)
  if (location.line < 1 || location.line > lines.length) return undefined
  const first = Math.max(1, location.line - context)
  const last = Math.min(lines.length, location.line + context)
  const width = String(last).length
  const untab = (text: string) => text.replace(/\t/g, "  ")
  const out: string[] = []
  for (let n = first; n <= last; n++) {
    const text = lines[n - 1] as string
    const marker = n === location.line ? ">" : " "
    out.push(`${marker} ${String(n).padStart(width)} | ${untab(text)}`.trimEnd())
    if (n === location.line) {
      const before = untab(text.slice(0, location.column - 1))
      out.push(`  ${" ".repeat(width)} | ${" ".repeat(before.length)}^`)
    }
  }
  return out.join("\n")
}
