import { isEmailKitError } from "@email-kit/core/internal"

import { relativePath } from "../../paths.ts"

import type { Problem } from "./errors.ts"
import { problemAt } from "./frame.ts"
import { locate } from "./locate.ts"

export { CompileError, type Location, type Problem, SourceError } from "./errors.ts"
export { type FormatOptions, formatError } from "./format.ts"

/**
 * Turns anything thrown while compiling `file` into a problem, located when possible. An error
 * that isn't email-kit's keeps the first lines of its message.
 */
export function toProblem(error: unknown, file: string, projectDir: string): Problem {
  const code = isEmailKitError(error) ? error.code : "load-failed"
  const message = messageOf(error)
  const location = locate(error, projectDir)
  return location
    ? problemAt(code, message, location, projectDir)
    : { code, message, file: relativePath(projectDir, file) }
}

function messageOf(error: unknown): string {
  if (isEmailKitError(error)) return error.message
  if (error instanceof Error) return error.message.split("\n").slice(0, 6).join("\n")
  return String(error)
}
