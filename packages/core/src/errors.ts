// Symbol.for, so an error raised by one installed copy of @email-kit/core is still recognised by
// a compiler that loaded another copy (instanceof can't see across copies).
const BRAND = Symbol.for("email-kit.error")

/** An authoring error found while evaluating a template at compile time. */
export class EmailKitError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "EmailKitError"
    this.code = code
    Object.defineProperty(this, BRAND, { value: true })
  }
}

/** True for an EmailKitError from any copy of @email-kit/core. */
export function isEmailKitError(value: unknown): value is EmailKitError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[BRAND] === true &&
    typeof (value as { code?: unknown }).code === "string"
  )
}
