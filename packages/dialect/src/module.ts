// The runtime half of a generated module (P1-074): locale fallback (OUT-09), projecting data
// onto the schema before rendering, the runtime context (RUN-04), and the per-template render()
// (OUT-10, RUN-06). The compiler
// inlines it after the renderer, so the same rules apply: no imports below the marker, ES2020,
// and nothing unused (hosts may compile with noUnusedLocals).

import { type ParsedTemplate, parse, render } from "./index.ts"

// --- inlined into generated modules from here ---

/** The four parts of one template in one locale, as mustache-core templates. */
interface TemplateParts {
  readonly subject: string
  readonly preheader: string
  readonly html: string
  readonly text: string
}

/**
 * The shape of a template's data, from its schema: which keys exist and which are optional.
 * `"scalar"` covers strings, numbers and booleans.
 */
type Shape =
  | "scalar"
  | { readonly list: Shape }
  | { readonly fields: Readonly<Record<string, Shape>>; readonly optional: readonly string[] }

interface RuntimeTemplate {
  readonly meta: {
    readonly id: string
    readonly purpose: string
    readonly locales: readonly string[]
  }
  readonly templates: Readonly<Record<string, TemplateParts>>
  render(
    data: unknown,
    options?: { readonly locale?: string },
  ): TemplateParts & {
    readonly meta: { readonly id: string; readonly locale: string; readonly purpose: string }
  }
}

/** An error from render() that isn't a mustache-core error, such as a line break in the subject. */
class EmailRenderError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "EmailRenderError"
    this.code = code
  }
}

const parsedTemplates = new Map<string, ParsedTemplate>()

function fill(template: string, data: unknown, profile: "html" | "text"): string {
  let parsed = parsedTemplates.get(template)
  if (parsed === undefined) {
    parsed = parse(template)
    parsedTemplates.set(template, parsed)
  }
  return render(parsed, data, profile)
}

/**
 * BCP 47 lookup (RFC 4647 §3.4): try the tag, then drop subtags from the end (`pt-BR` → `pt`),
 * then fall back to the default locale. Matching ignores case.
 */
function resolveLocale(requested: string | undefined, available: readonly string[]): string {
  const fallback = available[0] as string
  let tag = requested?.toLowerCase()
  while (tag) {
    for (const locale of available) {
      if (locale.toLowerCase() === tag) return locale
    }
    const cut = tag.lastIndexOf("-")
    tag = cut > 0 ? tag.slice(0, cut) : undefined
  }
  return fallback
}

/**
 * Copies data onto the schema's shape before rendering: unknown keys are dropped and missing
 * optional keys become null. Without this, mustache-core's context-stack lookup could find an
 * outer value through an item that lacks the key, or an extra key could shadow an outer one.
 */
function project(shape: Shape, value: unknown): unknown {
  if (shape === "scalar" || value === null || typeof value !== "object") return value
  if ("list" in shape) {
    return Array.isArray(value) ? value.map((item) => project(shape.list, item)) : value
  }
  if (Array.isArray(value)) return value
  const source = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(shape.fields)) {
    // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn needs lib ES2022 in the host
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      out[key] = project(shape.fields[key] as Shape, source[key])
    } else if (shape.optional.indexOf(key) !== -1) {
      out[key] = null
    }
  }
  return out
}

/**
 * Checks the values passed to createEmails() (RUN-04): every runtime key is a non-empty string.
 * Only the declared keys are kept.
 */
function readContext(keys: readonly string[], context: unknown): Readonly<Record<string, string>> {
  const values: Record<string, string> = {}
  for (const key of keys) {
    const value =
      typeof context === "object" && context !== null
        ? (context as Record<string, unknown>)[key]
        : undefined
    if (typeof value !== "string" || value === "") {
      throw new EmailRenderError(
        "missing-context",
        `createEmails() needs "${key}" as a non-empty string`,
      )
    }
    values[key] = value
  }
  return values
}

/**
 * Builds one entry of the generated `emails` object. `locales[0]` is the default locale. The
 * context goes under the reserved `_ek` key after projection, so data can't override it: the
 * schema can't declare `_ek`, and projection drops every undeclared key.
 */
function createTemplate(
  id: string,
  purpose: string,
  shape: Shape,
  locales: readonly string[],
  templates: Readonly<Record<string, TemplateParts>>,
  context: Readonly<Record<string, string>>,
): RuntimeTemplate {
  return {
    meta: { id, purpose, locales },
    templates,
    render(data, options = {}) {
      const locale = resolveLocale(options.locale, locales)
      const parts = templates[locale] as TemplateParts
      const projected = project(shape, data)
      const values =
        typeof projected === "object" && projected !== null && !Array.isArray(projected)
          ? { ...projected, _ek: { context } }
          : projected
      const subject = fill(parts.subject, values, "text")
      if (/[\r\n]/.test(subject)) {
        throw new EmailRenderError(
          "subject-line-break",
          `The subject of "${id}" contains a line break; check the data for CR or LF characters`,
        )
      }
      return {
        subject,
        preheader: fill(parts.preheader, values, "text"),
        html: fill(parts.html, values, "html"),
        text: fill(parts.text, values, "text"),
        meta: { id, locale, purpose },
      }
    },
  }
}

export {
  createTemplate,
  EmailRenderError,
  project,
  readContext,
  resolveLocale,
  type Shape,
  type TemplateParts,
}
