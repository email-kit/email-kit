// Errors as people read them (CLI-06): the error id, `file:line:col`, the message, a code frame
// and a link to the docs entry for the id (docs/errors.md).
//
// Locations come from two places. Build errors (syntax, unresolved imports) carry rolldown's
// location. Errors thrown while a template runs are located from the stack: templates are bundled
// with inline source maps, and each frame in a bundle is mapped back to its .tsx line here, so it
// works whoever formats stacks (Node, a test runner). The first frame inside the project wins.

import { existsSync, readFileSync } from "node:fs"
import { SourceMap } from "node:module"
import { isAbsolute, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { styleText } from "node:util"

import { EmailKitError, isEmailKitError } from "@email-kit/core/internal"

export const DOCS_URL = "https://github.com/email-kit/email-kit/blob/main/docs/errors.md"

export interface Location {
  /** Absolute path */
  readonly file: string
  /** 1-based */
  readonly line: number
  /** 1-based */
  readonly column: number
}

/** An error at a known place in a source file. */
export class SourceError extends EmailKitError {
  readonly location: Location | undefined

  constructor(code: string, message: string, location: Location | undefined) {
    super(code, message)
    this.name = "SourceError"
    this.location = location
  }
}

export interface Problem {
  readonly code: string
  readonly message: string
  /** Relative to the project folder */
  readonly file: string
  readonly line?: number
  readonly column?: number
  /** The source lines around the location, ready to print */
  readonly frame?: string
}

/** One or more problems that stopped the compile; nothing was written. */
export class CompileError extends Error {
  readonly problems: readonly Problem[]

  constructor(problems: readonly Problem[]) {
    super(problems.map((p) => `${where(p)}: ${p.message}`).join("\n"))
    this.name = "CompileError"
    this.problems = problems
  }
}

/** Turns anything thrown while compiling `file` into a problem, located when possible. */
export function toProblem(error: unknown, file: string, projectDir: string): Problem {
  const location = locate(error, projectDir)
  const code = isEmailKitError(error) ? error.code : "load-failed"
  const message = isEmailKitError(error)
    ? error.message
    : error instanceof Error
      ? error.message.split("\n").slice(0, 6).join("\n")
      : String(error)
  if (!location) return { code, message, file: relative(projectDir, file) }
  const frame = codeFrame(location)
  return {
    code,
    message,
    file: relative(projectDir, location.file),
    line: location.line,
    column: location.column,
    ...(frame && { frame }),
  }
}

function locate(error: unknown, projectDir: string): Location | undefined {
  if (error instanceof SourceError) return error.location
  const stack = error instanceof Error ? (error.stack ?? "") : ""
  for (const line of stack.split("\n").slice(1)) {
    const match = /at (?:.*? \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line)
    if (!match) continue
    let file = match[1] as string
    if (file.startsWith("file://")) file = fileURLToPath(file)
    const frame = { file, line: Number(match[2]), column: Number(match[3]) }
    const source = file.endsWith(".mjs") ? (original(frame) ?? frame) : frame
    const rel = relative(projectDir, source.file)
    if (rel.startsWith("..") || isAbsolute(rel) || source.file.includes("node_modules")) continue
    return source
  }
  return undefined
}

const sourceMaps = new Map<string, SourceMap | null>()

// The position in the original file, from the bundle's inline source map.
function original(frame: Location): Location | undefined {
  let map = sourceMaps.get(frame.file)
  if (map === undefined) {
    map = readInlineSourceMap(frame.file)
    sourceMaps.set(frame.file, map)
  }
  if (!map) return undefined
  const origin = map.findOrigin(frame.line, frame.column)
  if (!("fileName" in origin) || !origin.fileName) return undefined
  return {
    file: origin.fileName.startsWith("file://") ? fileURLToPath(origin.fileName) : origin.fileName,
    line: origin.lineNumber,
    column: origin.columnNumber,
  }
}

function readInlineSourceMap(file: string): SourceMap | null {
  try {
    const match =
      /\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)\s*$/.exec(
        readFileSync(file, "utf8"),
      )
    if (!match) return null
    return new SourceMap(JSON.parse(Buffer.from(match[1] as string, "base64").toString("utf8")))
  } catch {
    return null
  }
}

/** Two lines either side, the line itself marked, and a caret under the column. */
export function codeFrame(location: Location, context = 2): string | undefined {
  if (!existsSync(location.file)) return undefined
  const lines = readFileSync(location.file, "utf8").split(/\r?\n/)
  if (location.line < 1 || location.line > lines.length) return undefined
  const first = Math.max(1, location.line - context)
  const last = Math.min(lines.length, location.line + context)
  const width = String(last).length
  const out: string[] = []
  for (let n = first; n <= last; n++) {
    const text = (lines[n - 1] as string).replace(/\t/g, "  ")
    const marker = n === location.line ? ">" : " "
    out.push(`${marker} ${String(n).padStart(width)} | ${text}`.trimEnd())
    if (n === location.line) {
      const before = (lines[n - 1] as string).slice(0, location.column - 1).replace(/\t/g, "  ")
      out.push(`  ${" ".repeat(width)} | ${" ".repeat(before.length)}^`)
    }
  }
  return out.join("\n")
}

export interface FormatOptions {
  /** ANSI colours; the CLI turns them on for a terminal without NO_COLOR */
  readonly color?: boolean
  /** Paths outside a compile's project are shown relative to this. Default: process.cwd() */
  readonly cwd?: string
}

export function formatError(error: unknown, options: FormatOptions = {}): string {
  const paint = (format: Parameters<typeof styleText>[0], text: string) =>
    // The caller already decided (TTY, NO_COLOR), so don't let styleText check the stream again.
    options.color ? styleText(format, text, { validateStream: false }) : text
  if (error instanceof CompileError) {
    const n = error.problems.length
    const body = error.problems.map((p) => formatProblem(p, paint)).join("\n\n")
    return `${body}\n\n${n} ${n === 1 ? "problem" : "problems"}; nothing was written.`
  }
  if (error instanceof SourceError && error.location) {
    const { line, column } = error.location
    const file = relative(options.cwd ?? process.cwd(), error.location.file)
    const frame = codeFrame(error.location)
    return formatProblem(
      { code: error.code, message: error.message, file, line, column, ...(frame && { frame }) },
      paint,
    )
  }
  if (isEmailKitError(error)) {
    return `${paint("red", "✗")} [${error.code}] ${error.message}\n\n  ${paint("dim", `Docs: ${DOCS_URL}#${error.code}`)}`
  }
  return `${paint("red", "✗")} ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
}

function formatProblem(
  problem: Problem,
  paint: (format: Parameters<typeof styleText>[0], text: string) => string,
): string {
  const lines = [`${paint("red", "✗")} ${paint("bold", where(problem))} [${problem.code}]`]
  lines.push(indent(problem.message))
  if (problem.frame) lines.push("", indent(paint("dim", problem.frame)))
  lines.push("", indent(paint("dim", `Docs: ${DOCS_URL}#${problem.code}`)))
  return lines.join("\n")
}

function where(problem: Problem): string {
  return problem.line === undefined
    ? problem.file
    : `${problem.file}:${problem.line}:${problem.column ?? 1}`
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n")
}
