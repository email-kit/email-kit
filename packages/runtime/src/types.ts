import type { Template } from "./render.ts"

/** The legal purpose of an email, from `defineEmail({ purpose })`. */
export type Purpose = "transactional" | "marketing" | "consent-request"

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

/** One email in one locale, rendered. */
export interface EmailParts {
  /** The `Subject:` header. */
  readonly subject: string
  /** The preview text inboxes show after the subject. It's also the start of `html` and `text`. */
  readonly preheader: string
  /** The HTML body. */
  readonly html: string
  /** The plain-text body. Send it with `html` as multipart/alternative. */
  readonly text: string
}

/** How to render an email. */
export interface RenderOptions<Locale extends string = string> {
  /**
   * A BCP 47 tag. Falls back along CLDR's parents (`es-AR` → `es-419` → `es`, `de-AT` → `de`)
   * and `locales.fallback`, then to the default locale. Default: the default locale.
   */
  readonly locale?: Locale | (string & {}) | undefined
}

/** A rendered email: send `html` and `text` as multipart/alternative, with `subject`. */
export interface RenderedEmail<Id extends string = string, Locale extends string = string>
  extends EmailParts {
  /** Which template and locale it came from, and why it's sent. */
  readonly meta: { readonly id: Id; readonly locale: Locale; readonly purpose: Purpose }
}

/** One email of the generated `emails` object, such as `emails.welcome`. */
export interface EmailTemplate<Id extends string, Data, Locale extends string = string> {
  /** The template id, why it's sent, and the locales it's compiled in, the default first. */
  readonly meta: {
    readonly id: Id
    readonly purpose: Purpose
    readonly locales: readonly Locale[]
  }
  /**
   * Fills the template for one locale. Values are HTML-escaped in `html` only. With validation on
   * (the default), invalid data throws an `EmailRenderError` (`invalid-data`) listing each field.
   *
   * @param data - The template's data, as its schema describes it.
   * @param options - The locale to render in.
   * @returns The subject, preheader, HTML and text, with `meta`.
   */
  render(data: Data, options?: RenderOptions<Locale>): RenderedEmail<Id, Locale>
  /**
   * Checks data against the template's schema without rendering, for data from a queue or
   * webhook. Not there when the project compiles with `validate: false`.
   *
   * @param data - Anything.
   * @returns Every problem, each with its path; empty when the data is valid.
   */
  validate(data: unknown): readonly DataIssue[]
}

/** One email in one locale, as the compiler writes it: each part a compiled template. */
export interface CompiledParts {
  readonly subject: Template
  readonly preheader: Template
  readonly html: Template
  readonly text: Template
}

/** What the generated module knows about one template. */
export interface TemplateSpec {
  readonly id: string
  readonly purpose: Purpose
  /** The schema's data model, for projecting (and validating) the data. */
  readonly model: Model
  /** Every compiled locale, the default first. */
  readonly locales: readonly string[]
  /** The compiled parts in each locale. */
  readonly parts: Readonly<Record<string, CompiledParts>>
}

/**
 * The runtime features the generated module turns on. Each optional one comes from its own entry
 * point, so a project that doesn't use it doesn't load or bundle it.
 */
export interface TemplateOptions {
  /** The generated module's format. The runtime refuses one it doesn't know. */
  readonly format: number
  /** The sender values passed at send time, checked by `readContext()`. */
  readonly context?: Readonly<Record<string, string>>
  /**
   * `validate` from `@email-kit/runtime/validate`: `render()` checks data first, and each
   * template has `validate()`.
   */
  readonly validate?: (model: Model, data: unknown) => DataIssue[]
  /**
   * `prepare` from `@email-kit/runtime/plural`, with each locale's CLDR plural rule: adds the
   * flags compiled plurals and selects test.
   */
  readonly plural?: {
    readonly prepare: (model: Model, data: unknown, category: (n: number) => string) => void
    readonly rules: Readonly<Record<string, (n: number) => string>>
  }
  /**
   * Picks the compiled locale for a requested one, from `@email-kit/runtime/locale`. Without it,
   * every email renders in the default locale: the module has only one.
   */
  readonly resolve?: (requested: string | undefined, available: readonly string[]) => string
}

/** What `createTemplate()` returns, before the generated module gives it its exact type. */
export interface RuntimeTemplate {
  readonly meta: {
    readonly id: string
    readonly purpose: Purpose
    readonly locales: readonly string[]
  }
  render(data: unknown, options?: RenderOptions): RenderedEmail
  validate?(data: unknown): readonly DataIssue[]
}
