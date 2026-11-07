// The shapes the runtime works with, and its error class.

// --- inlined into generated modules from here ---

export interface TemplateParts {
  readonly subject: string
  readonly preheader: string
  readonly html: string
  readonly text: string
}

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

export interface DataIssue {
  readonly path: string
  readonly message: string
}

export interface RenderedParts extends TemplateParts {
  readonly meta: { readonly id: string; readonly locale: string; readonly purpose: string }
}

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

export class EmailRenderError extends Error {
  readonly code: string
  readonly issues: readonly DataIssue[]

  constructor(code: string, message: string, issues: readonly DataIssue[] = []) {
    super(message)
    this.name = "EmailRenderError"
    this.code = code
    this.issues = issues
  }
}
