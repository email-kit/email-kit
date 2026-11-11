const BRAND = Symbol.for("email-kit.error")

/**
 * The error email-kit throws for a mistake in a template or config, such as an invalid template
 * id or a list rendered without `<Each>`. `message` says what to fix.
 */
export class EmailKitError extends Error {
  /** A short, stable name for the kind of mistake, such as `"invalid-id"`. */
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "EmailKitError"
    this.code = code
    Object.defineProperty(this, BRAND, { value: true })
  }
}

/** Whether a value is an `EmailKitError`, even one from another installed copy of email-kit. */
export function isEmailKitError(value: unknown): value is EmailKitError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[BRAND] === true &&
    typeof (value as { code?: unknown }).code === "string"
  )
}
