import { styleText } from "node:util"

import { isEmailKitError } from "@email-kit/core/internal"

import { CompileError, type Problem, SourceError, where } from "./errors.ts"
import { problemAt } from "./frame.ts"

/** The error docs. Each error code has an entry, linked as `#<code>`. */
const DOCS_URL = "https://github.com/email-kit/email-kit/blob/main/docs/reference/errors.md"

/** Colours text for the terminal, or leaves it as it is without colours. */
type Paint = (format: Parameters<typeof styleText>[0], text: string) => string

export interface FormatOptions {
  /**
   * Whether to use ANSI colours. The CLI turns them on for a terminal, unless `NO_COLOR` is set,
   * so they aren't checked again here.
   */
  readonly color?: boolean
  /** Paths outside a compile's project are shown relative to this. Defaults to `process.cwd()`. */
  readonly cwd?: string
}

/**
 * An error as people read it: the error id, `file:line:col`, the message, a code frame and a link
 * to the id's entry in the error docs. An error that isn't email-kit's is shown with its stack.
 */
export function formatError(error: unknown, options: FormatOptions = {}): string {
  const paint: Paint = (format, text) =>
    options.color ? styleText(format, text, { validateStream: false }) : text
  if (error instanceof CompileError) {
    const n = error.problems.length
    const body = error.problems.map((p) => formatProblem(p, paint)).join("\n\n")
    return `${body}\n\n${n} ${n === 1 ? "problem" : "problems"}; nothing was written.`
  }
  if (error instanceof SourceError && error.location) {
    const base = options.cwd ?? process.cwd()
    return formatProblem(problemAt(error.code, error.message, error.location, base), paint)
  }
  if (isEmailKitError(error)) {
    return `${paint("red", "✗")} [${error.code}] ${error.message}\n\n  ${docs(error.code, paint)}`
  }
  return `${paint("red", "✗")} ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
}

/**
 * ```text
 * ✗ src/email-kit/welcome/template.tsx:12:14 [syntax-error]
 *   Expected `}`
 *
 *   > 12 |   {data.name)
 *        |             ^
 *
 *   Docs: https://…/errors.md#syntax-error
 * ```
 */
function formatProblem(problem: Problem, paint: Paint): string {
  const lines = [`${paint("red", "✗")} ${paint("bold", where(problem))} [${problem.code}]`]
  lines.push(indent(problem.message))
  if (problem.frame) lines.push("", indent(paint("dim", problem.frame)))
  lines.push("", indent(docs(problem.code, paint)))
  return lines.join("\n")
}

function docs(code: string, paint: Paint): string {
  return paint("dim", `Docs: ${DOCS_URL}#${code}`)
}

/** Indents each line that isn't empty by two spaces. */
function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n")
}
