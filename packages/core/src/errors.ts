/** An authoring error found while evaluating a template at compile time. */
export class EmailKitError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "EmailKitError"
    this.code = code
  }
}
