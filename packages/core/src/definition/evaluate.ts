import { createSender, type SenderValues } from "../config/sender.ts"
import { createPlaceholder, type Data } from "../data/placeholder.ts"
import { withScopes } from "../data/scope.ts"
import { createTranslate, type Messages, type PluralSupport } from "../i18n/translate.ts"
import { type ThemeContext, withDirection, withTheme } from "../theme/context.ts"
import type { IrNode } from "../tree/ir.ts"
import { fragment } from "../tree/nodes.ts"
import type { EmailDefinition } from "./define.ts"

/** A template's subject, preheader and body as IR, for one locale. */
export interface EvaluatedEmail {
  readonly subject: IrNode
  readonly preheader: IrNode | undefined
  readonly body: IrNode
}

export interface EvaluateOptions {
  readonly locale: string
  /** The locale's messages, by key, for `t()`. */
  readonly messages: Messages
  /** The sender values from the config. Without them, reading `sender.*` throws. */
  readonly sender?: SenderValues
  /** The resolved theme, read with `useTheme()`. */
  readonly theme?: ThemeContext
  /** The locale's plural rules, for `{n, plural, …}`. Default: only `other`. */
  readonly plurals?: PluralSupport
  /** Called with each message key `t()` resolves, to find unused keys. */
  readonly onMessage?: (key: string) => void
  /** The locale's writing direction, read with `useDirection()`. Default: `ltr`. */
  readonly dir?: "ltr" | "rtl"
}

const NO_SENDER: SenderValues = { constants: {}, runtime: [] }

/**
 * Runs a template once for one locale, with `data` as placeholders, and returns its IR. The
 * direction, theme and scope counter are set for the whole run, so the subject, preheader and body
 * share them.
 */
export function evaluate<T>(
  definition: EmailDefinition<T>,
  options: EvaluateOptions,
): EvaluatedEmail {
  return withDirection(options.dir ?? "ltr", () =>
    withTheme(options.theme, () => withScopes(() => run(definition, options))),
  )
}

function run<T>(definition: EmailDefinition<T>, options: EvaluateOptions): EvaluatedEmail {
  const { locale } = options
  const data = createPlaceholder(0) as Data<T>
  const t = createTranslate(locale, options.messages, options.plurals, options.onMessage)
  const sender = createSender(options.sender ?? NO_SENDER)
  return {
    subject: fragment(definition.subject(data, t, sender)),
    preheader: definition.preheader ? fragment(definition.preheader(data, t, sender)) : undefined,
    body: fragment(definition.component({ data, t, locale, sender })),
  }
}
