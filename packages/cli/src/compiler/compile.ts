import type { EmailDefinition, FontStackName } from "@email-kit/core"
import {
  EmailKitError,
  evaluate,
  fontClass,
  type Messages,
  type SenderValues,
  type ThemeContext,
} from "@email-kit/core/internal"
import { parse } from "@email-kit/dialect"
import { pluralRules } from "../i18n/plurals.ts"
import { loadTheme, type Theme } from "../theme/theme.ts"
import { checkDerived } from "./derived.ts"
import { type DocumentOptions, msoFontFamily, renderDocument } from "./document.ts"
import type { Field } from "./schema.ts"
import { renderLine, renderTextPart } from "./text.ts"

/**
 * One template in one locale: the four parts of an email, as mustache-core templates with tags
 * where data goes. The generated module fills them in at send time, escaping data for HTML in
 * `html` only.
 */
export interface CompiledEmail {
  readonly id: string
  readonly locale: string
  /** The subject line, as plain text. */
  readonly subject: string
  /** The preview text inbox lists show after the subject, as plain text. */
  readonly preheader: string
  /** The whole HTML document. */
  readonly html: string
  /** The plain-text part, for clients that don't show HTML. */
  readonly text: string
  /** The message keys the template used, for `i18n.unused-keys`. */
  readonly messageKeys: readonly string[]
}

export interface CompileEmailOptions {
  readonly locale: string
  /** The locale's messages, which `t()` reads. */
  readonly messages: Messages
  /** The sender values fixed at compile time, and the ones passed at send time. */
  readonly sender?: SenderValues
  /** The resolved theme. The built-in theme when left out. */
  readonly theme?: Theme
  /** The schema's model, to check plural and select arguments against. */
  readonly model?: Field
}

/** Languages written right to left, by their language subtag. */
const RTL = new Set(["ar", "dv", "fa", "he", "ps", "ur", "yi"])

/** Whether the locale's language is written right to left, such as `ar` or `he-IL`. */
export function isRtl(locale: string): boolean {
  return RTL.has(locale.split("-")[0] ?? "")
}

/**
 * Compiles one template in one locale into the four parts of an email:
 * 1. runs the template, giving its IR, with the theme, text direction and plural rules;
 * 2. checks its plural and select messages against the schema;
 * 3. renders the subject and preheader as lines, the body as an HTML document and as plain text;
 * 4. parses each part as mustache-core, so a bug here fails the compile, not a send.
 */
export function compileEmail<T>(
  definition: EmailDefinition<T>,
  options: CompileEmailOptions,
): CompiledEmail {
  const theme = options.theme ?? builtInTheme()
  const dir = isRtl(options.locale) ? "rtl" : "ltr"
  const used = new Set<string>()
  const ir = evaluate(definition, {
    ...options,
    theme: themeContext(theme),
    dir,
    plurals: pluralRules(options.locale),
    onMessage: (key) => used.add(key),
  })
  if (options.model) {
    const parts = [ir.subject, ...(ir.preheader ? [ir.preheader] : []), ir.body]
    checkDerived(parts, options.model, `${definition.id} (${options.locale})`)
  }
  const preheader = ir.preheader ? renderLine(ir.preheader, "preheader") : ""
  const compiled: CompiledEmail = {
    id: definition.id,
    locale: options.locale,
    subject: renderLine(ir.subject, "subject"),
    preheader,
    html: renderDocument({
      lang: options.locale,
      dir,
      subject: ir.subject,
      preheader: ir.preheader,
      body: ir.body,
      outlookClassic: true,
      ...outlookFonts(theme),
      dark: theme.dark === "authored" ? theme.roles.dark : undefined,
      ground: { canvas: theme.roles.light.canvas, ink: theme.roles.light.ink },
      container: {
        width: theme.layout.container,
        paddingBlock: theme.space.section,
        paddingInline: theme.space.gutterMobile,
      },
    }),
    text: renderTextPart(ir.body, preheader),
    messageKeys: [...used].sort(),
  }
  assertValidOutput(compiled)
  return compiled
}

/** What components see through `useTheme()`: the light palette and the other tokens. */
function themeContext(theme: Theme): ThemeContext {
  return { ...theme, roles: theme.roles.light }
}

let defaultTheme: Theme | undefined

/** The built-in theme, loaded once: it reads no files. */
function builtInTheme(): Theme {
  defaultTheme ??= loadTheme(undefined, ".")
  return defaultTheme
}

/**
 * The fonts classic Outlook gets: the body text's stack for all text, and each stack's own for the
 * elements with its class.
 */
function outlookFonts(theme: Theme): Pick<DocumentOptions, "outlookFont" | "outlookClassFonts"> {
  const { stacks, scale } = theme.typography
  const names = Object.keys(stacks) as FontStackName[]
  return {
    outlookFont: msoFontFamily(stacks[scale.body.stack]),
    outlookClassFonts: Object.fromEntries(
      names.map((name) => [fontClass(name), msoFontFamily(stacks[name])]),
    ),
  }
}

/**
 * Parses each part as mustache-core, the way the generated module will. The renderers should
 * never produce a broken template, so a failure is a bug in email-kit, reported at compile time.
 */
function assertValidOutput(email: CompiledEmail): void {
  for (const part of ["subject", "preheader", "html", "text"] as const) {
    try {
      parse(email[part])
    } catch (error) {
      throw new EmailKitError(
        "invalid-output",
        `Bug: the ${part} of ${email.id} (${email.locale}) isn't valid mustache-core: ` +
          (error as Error).message,
      )
    }
  }
}
