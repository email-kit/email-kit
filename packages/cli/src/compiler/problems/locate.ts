import { readFileSync } from "node:fs"
import { SourceMap } from "node:module"
import { isAbsolute, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { type Location, SourceError } from "./errors.ts"

/** A stack frame's file, line and column, however Node or a test runner formatted it. */
const STACK_FRAME = /at (?:.*? \()?(.+?):(\d+):(\d+)\)?\s*$/
/** A bundle's inline source map, as rolldown writes it on the last line. */
const INLINE_MAP =
  /\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)\s*$/

/** Each bundle's source map, read once. `null` when the bundle has none. */
const sourceMaps = new Map<string, SourceMap | null>()

/**
 * Where an error happened. A build error, such as a syntax error, has rolldown's location. An error
 * thrown while a template runs is located from its stack: each frame in a bundle is mapped back to
 * its source line through the bundle's inline source map, which works however the stack was
 * formatted, by Node or a test runner. The first frame inside the project wins.
 */
export function locate(error: unknown, projectDir: string): Location | undefined {
  if (error instanceof SourceError) return error.location
  const stack = error instanceof Error ? (error.stack ?? "") : ""
  for (const line of stack.split("\n").slice(1)) {
    const match = STACK_FRAME.exec(line)
    if (!match) continue
    const frame = {
      file: toPath((match[1] as string).replace(/^async /, "")),
      line: Number(match[2]),
      column: Number(match[3]),
    }
    const source = frame.file.endsWith(".mjs") ? (original(frame) ?? frame) : frame
    if (isInProject(source.file, projectDir)) return source
  }
  return undefined
}

/** Whether a file is the project's own: inside its folder, and not in `node_modules`. */
function isInProject(file: string, projectDir: string): boolean {
  const path = relative(projectDir, file)
  return !path.startsWith("..") && !isAbsolute(path) && !file.includes("node_modules")
}

/** The position in the original file, from the bundle's inline source map. */
function original(frame: Location): Location | undefined {
  let map = sourceMaps.get(frame.file)
  if (map === undefined) {
    map = readInlineSourceMap(frame.file)
    sourceMaps.set(frame.file, map)
  }
  const origin = map?.findOrigin(frame.line, frame.column)
  if (!origin || !("fileName" in origin) || !origin.fileName) return undefined
  return { file: toPath(origin.fileName), line: origin.lineNumber, column: origin.columnNumber }
}

function readInlineSourceMap(file: string): SourceMap | null {
  try {
    const match = INLINE_MAP.exec(readFileSync(file, "utf8"))
    if (!match) return null
    return new SourceMap(JSON.parse(Buffer.from(match[1] as string, "base64").toString("utf8")))
  } catch {
    return null
  }
}

/** A path, from either a path or a `file://` URL. */
function toPath(file: string): string {
  return file.startsWith("file://") ? fileURLToPath(file) : file
}
