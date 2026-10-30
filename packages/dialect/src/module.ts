// The runtime half of a generated module (P1-074): locale fallback (OUT-09), projecting data
// onto the schema before rendering, and the per-template render() (OUT-10, RUN-06). The compiler
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

/** Builds one entry of the generated `emails` object. `locales[0]` is the default locale. */
function createTemplate(
  id: string,
  purpose: string,
  shape: Shape,
  locales: readonly string[],
  templates: Readonly<Record<string, TemplateParts>>,
): RuntimeTemplate {
  return {
    meta: { id, purpose, locales },
    templates,
    render(data, options = {}) {
      const locale = resolveLocale(options.locale, locales)
      const parts = templates[locale] as TemplateParts
      const context = project(shape, data)
      const subject = fill(parts.subject, context, "text")
      if (/[\r\n]/.test(subject)) {
        throw new EmailRenderError(
          "subject-line-break",
          `The subject of "${id}" contains a line break; check the data for CR or LF characters`,
        )
      }
      return {
        subject,
        preheader: fill(parts.preheader, context, "text"),
        html: fill(parts.html, context, "html"),
        text: fill(parts.text, context, "text"),
        meta: { id, locale, purpose },
      }
    },
  }
}

export { createTemplate, EmailRenderError, project, resolveLocale, type Shape, type TemplateParts }
