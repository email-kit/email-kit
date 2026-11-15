import { EmailRenderError } from "./errors.ts"
import { project } from "./project.ts"
import { fill } from "./render.ts"
import { EK, isObject } from "./shared.ts"
import type { CompiledParts, RuntimeTemplate, TemplateOptions, TemplateSpec } from "./types.ts"

/** The generated-module format this runtime renders. `email-kit compile` writes it. */
export const FORMAT = 1

/**
 * Makes one email of the generated `emails` object. Its `render()` validates the data when
 * `options.validate` is given, picks the locale, keeps only the schema's fields, adds the plural
 * and select flags and the sender values, and fills the four parts.
 *
 * The generated module calls it; apps call `render()` on the result.
 *
 * @param spec - The template: id, purpose, data model, locales and compiled parts.
 * @param options - The module's format and the features it uses.
 * @throws {EmailRenderError} `incompatible-module` when the module was compiled for another
 *   version of this package.
 */
export function createTemplate(spec: TemplateSpec, options: TemplateOptions): RuntimeTemplate {
  if (options.format !== FORMAT) {
    throw new EmailRenderError(
      "incompatible-module",
      `The emails were compiled for format ${options.format} of @email-kit/runtime, which ` +
        `renders format ${FORMAT}. Install the same version as @email-kit/cli, and run ` +
        "`email-kit compile`",
    )
  }
  const { id, purpose, model, locales, parts } = spec
  const { context = {}, validate, plural, resolve } = options
  const default_ = locales[0] as string
  const template: RuntimeTemplate = {
    meta: { id, purpose, locales },
    render(data, renderOptions = {}) {
      if (validate) {
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
      const locale = resolve ? resolve(renderOptions.locale, locales) : default_
      const compiled = parts[locale] as CompiledParts
      const projected = project(model, data)
      if (plural) plural.prepare(model, projected, plural.rules[locale] ?? (() => "other"))
      const values = isObject(projected)
        ? { ...projected, [EK]: { ...(isObject(projected[EK]) ? projected[EK] : {}), context } }
        : projected
      const subject = fill(compiled.subject, values, false)
      if (/[\r\n]/.test(subject)) {
        throw new EmailRenderError(
          "subject-line-break",
          `The subject of "${id}" contains a line break; check the data for CR or LF characters`,
        )
      }
      return {
        subject,
        preheader: fill(compiled.preheader, values, false),
        html: fill(compiled.html, values, true),
        text: fill(compiled.text, values, false),
        meta: { id, locale, purpose },
      }
    },
  }
  return validate ? { ...template, validate: (data) => validate(model, data) } : template
}
