// One template × one locale → the four parts of an email, as mustache-core templates (P0-03).

import type { EmailDefinition } from "@email-kit/core"
import {
  EmailKitError,
  evaluate,
  type Messages,
  type PlatformValues,
  type ThemeContext,
} from "@email-kit/core/internal"
import { parse } from "@email-kit/dialect"
import { pluralRules } from "../i18n/plurals.ts"
import { loadTheme, type Theme } from "../theme/theme.ts"
import { checkDerived } from "./derived.ts"
import { renderDocument } from "./document.ts"
import type { Field } from "./schema.ts"
import { renderLine, renderTextPart } from "./text.ts"

export interface CompiledEmail {
  readonly id: string
  readonly locale: string
  /** `text` profile */
  readonly subject: string
  /** `text` profile */
  readonly preheader: string
  /** `html` profile */
  readonly html: string
  /** `text` profile */
  readonly text: string
  /** The message keys the template used, for i18n.unused-keys */
  readonly messageKeys: readonly string[]
}

export interface CompileOptions {
  readonly locale: string
  readonly messages: Messages
  readonly platform?: PlatformValues
  /** The resolved theme; the built-in default when left out */
  readonly theme?: Theme
  /** The schema's model, to check plural and select arguments against */
  readonly model?: Field
}

/** What components see through useTheme(): the light palette and the other tokens. */
export function themeContext(theme: Theme): ThemeContext {
  return { ...theme, roles: theme.roles.light }
}

let defaultTheme: Theme | undefined

/** The built-in theme, loaded once: it reads no files. */
function builtInTheme(): Theme {
  defaultTheme ??= loadTheme(undefined, ".")
  return defaultTheme
}

const RTL = new Set(["ar", "dv", "fa", "he", "ps", "ur", "yi"])

/** Whether the locale's language is written right to left. */
export function isRtl(locale: string): boolean {
  return RTL.has(locale.split("-")[0] ?? "")
}

export function compileEmail<T>(
  definition: EmailDefinition<T>,
  options: CompileOptions,
): CompiledEmail {
  const theme = options.theme ?? builtInTheme()
  const dir = isRtl(options.locale) ? "rtl" : "ltr"
  const plurals = pluralRules(options.locale)
  const used = new Set<string>()
  const ir = evaluate(definition, {
    ...options,
    theme: themeContext(theme),
    dir,
    plurals,
    onMessage: (key) => used.add(key),
  })
  if (options.model) {
    const parts = [ir.subject, ...(ir.preheader ? [ir.preheader] : []), ir.body]
    checkDerived(parts, options.model, `${definition.id} (${options.locale})`)
  }
  const subject = renderLine(ir.subject, "subject")
  const preheader = ir.preheader ? renderLine(ir.preheader, "preheader") : ""
  const html = renderDocument({
    lang: options.locale,
    dir,
    subject: ir.subject,
    preheader: ir.preheader,
    body: ir.body,
    // Classic Outlook stays a target by default until the targets config (CFG-05, M1.2).
    outlookClassic: true,
    dark: theme.dark === "authored" ? theme.roles.dark : undefined,
    ground: { canvas: theme.roles.light.canvas, ink: theme.roles.light.ink },
  })
  const text = renderTextPart(ir.body, preheader)

  const compiled = {
    id: definition.id,
    locale: options.locale,
    subject,
    preheader,
    html,
    text,
    messageKeys: [...used].sort(),
  }
  for (const part of ["subject", "preheader", "html", "text"] as const) {
    try {
      parse(compiled[part])
    } catch (error) {
      throw new EmailKitError(
        "invalid-output",
        `Bug: the ${part} of ${definition.id} (${options.locale}) isn't valid mustache-core: ` +
          (error as Error).message,
      )
    }
  }
  return compiled
}
