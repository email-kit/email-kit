import { isObject, type ParsedTemplate, parse, render } from "../index.ts"
import { type LocaleData, NO_LOCALE_DATA, resolveLocale } from "./locale.ts"
import { EK, prepare } from "./plurals.ts"
import { project } from "./project.ts"
import { EmailRenderError, type Model, type RuntimeTemplate, type TemplateParts } from "./types.ts"
import { validate } from "./validate.ts"

// --- inlined into generated modules from here ---

const parsedTemplates = new Map<string, ParsedTemplate>()

/** Renders a template, parsing each one only the first time. */
function fill(template: string, data: unknown, profile: "html" | "text"): string {
  let parsed = parsedTemplates.get(template)
  if (parsed === undefined) {
    parsed = parse(template)
    parsedTemplates.set(template, parsed)
  }
  return render(parsed, data, profile)
}

/**
 * Makes one entry of the generated `emails` object. Its `render()` validates the data when
 * `checkData` is on, picks the locale, keeps only the schema's fields, adds the plural and select
 * flags and the sender values, and fills the four parts.
 */
export function createTemplate(
  id: string,
  purpose: string,
  model: Model,
  locales: readonly string[],
  templates: Readonly<Record<string, TemplateParts>>,
  context: Readonly<Record<string, string>>,
  checkData: boolean,
  plurals: Readonly<Record<string, (n: number) => string>>,
  localeData: LocaleData = NO_LOCALE_DATA,
): RuntimeTemplate {
  return {
    meta: { id, purpose, locales },
    templates,
    validate: (data) => validate(model, data),
    render(data, options = {}) {
      if (checkData) {
        const issues = validate(model, data)
        if (issues.length > 0) {
          throw new EmailRenderError(
            "invalid-data",
            `The data for "${id}" doesn't match its schema:\n${issues
              .map((issue) => `  ${issue.path}: ${issue.message}`)
              .join("\n")}`,
            issues,
          )
        }
      }
      const locale = resolveLocale(options.locale, locales, localeData)
      const parts = templates[locale] as TemplateParts
      const projected = project(model, data)
      prepare(model, projected, plurals[locale] ?? (() => "other"))
      const values = isObject(projected)
        ? { ...projected, [EK]: { ...(isObject(projected[EK]) ? projected[EK] : {}), context } }
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
