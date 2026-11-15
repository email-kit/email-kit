import type { DataIssue } from "./types.ts"

/**
 * What kind of problem an `EmailRenderError` reports:
 * - `invalid-data`: the data doesn't match the template's schema; `issues` lists each field;
 * - `missing-context` or `invalid-context`: a sender value passed to `createEmails()` is missing,
 *   empty, or not an https URL or email address where one is needed;
 * - `subject-line-break`: the data puts a line break in the subject;
 * - `missing-value`, `non-scalar-value`, `invalid-number`: a value can't fill its placeholder.
 *   With validation on, data that passes it never causes these;
 * - `incompatible-module`: the generated module was compiled for another version of this package.
 */
export type RenderErrorCode =
  | "invalid-data"
  | "missing-context"
  | "invalid-context"
  | "subject-line-break"
  | "missing-value"
  | "non-scalar-value"
  | "invalid-number"
  | "incompatible-module"

/**
 * Why an email couldn't be rendered. `code` says what kind of problem it is; for `invalid-data`,
 * `issues` lists each field that doesn't match the schema, with its path.
 *
 * @example
 * ```ts
 * try {
 *   emails.welcome.render(data)
 * } catch (error) {
 *   if (error instanceof EmailRenderError && error.code === "invalid-data") {
 *     console.error(error.issues) // [{ path: "name", message: "is required" }]
 *   }
 * }
 * ```
 */
export class EmailRenderError extends Error {
  /** What kind of problem it is, such as `"invalid-data"`. */
  readonly code: RenderErrorCode
  /** For `invalid-data`: each field that doesn't match the schema. Empty otherwise. */
  readonly issues: readonly DataIssue[]

  /**
   * @param code - What kind of problem it is.
   * @param message - What went wrong, for people.
   * @param issues - For `invalid-data`, each field that doesn't match the schema.
   */
  constructor(code: RenderErrorCode, message: string, issues: readonly DataIssue[] = []) {
    super(message)
    this.name = "EmailRenderError"
    this.code = code
    this.issues = issues
  }
}
