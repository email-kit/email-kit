import { stripVTControlCharacters } from "node:util"

import { SourceError } from "../problems.ts"

/** One error in a rolldown build failure. */
interface RolldownDiagnostic {
  readonly code?: string
  readonly message?: string
  readonly id?: string
  /** Where it happened, with a 0-based column. */
  readonly loc?: { readonly file?: string; readonly line: number; readonly column: number }
}

/** email-kit's error code for each rolldown code. Any other failure is `load-failed`. */
const CODES: Readonly<Record<string, string>> = {
  PARSE_ERROR: "syntax-error",
  UNRESOLVED_IMPORT: "unresolved-import",
}

/**
 * Turns a rolldown build failure, `{ errors: [...] }`, into a `SourceError` with a 1-based column,
 * or gives `undefined` for any other error. Only the message's first line is kept, without
 * rolldown's colours and code prefix, since the error output draws its own code frame.
 */
export function toSourceError(error: unknown): SourceError | undefined {
  const [first] = (error as { errors?: readonly RolldownDiagnostic[] } | null)?.errors ?? []
  if (!first) return undefined
  const file = first.loc?.file ?? first.id
  const message = stripVTControlCharacters(first.message ?? String(error))
    .split("\n")[0]
    ?.replace(/^\[[A-Z_]+\]\s*/, "")
  return new SourceError(
    CODES[first.code ?? ""] ?? "load-failed",
    message || String(error),
    file && first.loc ? { file, line: first.loc.line, column: first.loc.column + 1 } : undefined,
  )
}
