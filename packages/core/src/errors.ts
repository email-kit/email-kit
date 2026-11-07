const BRAND = Symbol.for("email-kit.error")
export class EmailKitError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "EmailKitError"
    this.code = code
    Object.defineProperty(this, BRAND, { value: true })
  }
}

export function isEmailKitError(value: unknown): value is EmailKitError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[BRAND] === true &&
    typeof (value as { code?: unknown }).code === "string"
  )
}
