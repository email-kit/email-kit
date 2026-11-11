// --- inlined into generated modules from here ---

/** One email in one locale, as templates with `{{placeholders}}`. */
export interface TemplateParts {
  readonly subject: string
  readonly preheader: string
  readonly html: string
  readonly text: string
}

/**
 * A template's data schema, cut down to what validating and rendering need: types, `enum`,
 * nullability, limits such as `maxLength`, and fields marked as URLs.
 */
export interface Model {
  readonly type: "string" | "number" | "integer" | "boolean" | "array" | "object"
  readonly nullable?: true
  readonly enum?: readonly string[]
  readonly constraints?: Readonly<Record<string, number | string>>
  readonly url?: true
  readonly items?: Model
  readonly properties?: Readonly<Record<string, Model>>
  readonly required?: readonly string[]
}

/** One way the data doesn't match the schema. */
export interface DataIssue {
  /** Where, such as `order.items[2].price`, or `data` for the data itself. */
  readonly path: string
  /** What's wrong, such as `expected a number, got string "12"`. */
  readonly message: string
}

/** A rendered email, and which template and locale it came from. */
export interface RenderedParts extends TemplateParts {
  readonly meta: { readonly id: string; readonly locale: string; readonly purpose: string }
}

/** One entry of the generated `emails` object. */
export interface RuntimeTemplate {
  readonly meta: {
    readonly id: string
    readonly purpose: string
    readonly locales: readonly string[]
  }
  readonly templates: Readonly<Record<string, TemplateParts>>
  validate(data: unknown): readonly DataIssue[]
  render(data: unknown, options?: { readonly locale?: string }): RenderedParts
}

/**
 * Why an email couldn't be rendered: `invalid-data` when the data doesn't match the schema,
 * `missing-context` or `invalid-context` for a bad value passed to `createEmails()`, and
 * `subject-line-break` when data puts a line break in the subject.
 */
export class EmailRenderError extends Error {
  /** What kind of problem it is, such as `"invalid-data"`. */
  readonly code: string
  /** For `invalid-data`: each field that doesn't match the schema. */
  readonly issues: readonly DataIssue[]

  constructor(code: string, message: string, issues: readonly DataIssue[] = []) {
    super(message)
    this.name = "EmailRenderError"
    this.code = code
    this.issues = issues
  }
}
