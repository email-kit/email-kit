import { EmailKitError } from "@email-kit/core/internal"

/** A place in a source file. */
export interface Location {
  /** An absolute path. */
  readonly file: string
  /** Counted from 1. */
  readonly line: number
  /** Counted from 1. */
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

/** One thing that stopped the compile, ready to print. */
export interface Problem {
  /** The error code, such as `syntax-error`, which links to its entry in the error docs. */
  readonly code: string
  readonly message: string
  /** Relative to the project folder. */
  readonly file: string
  readonly line?: number
  readonly column?: number
  /** The source lines around the location, ready to print. */
  readonly frame?: string
}

/**
 * One or more problems that stopped the compile; nothing was written. Its message lists them one
 * a line, for code that doesn't format them.
 */
export class CompileError extends Error {
  readonly problems: readonly Problem[]

  constructor(problems: readonly Problem[]) {
    super(problems.map((p) => `${where(p)}: ${p.message}`).join("\n"))
    this.name = "CompileError"
    this.problems = problems
  }
}

/** A problem's place as `file`, or `file:line:column` when the line is known. */
export function where(problem: Problem): string {
  return problem.line === undefined
    ? problem.file
    : `${problem.file}:${problem.line}:${problem.column ?? 1}`
}
