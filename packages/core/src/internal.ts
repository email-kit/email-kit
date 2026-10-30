// Compiler-facing API: not for template authors, and not covered by semver until v1.

import type { EmailDefinition } from "./define.ts"
import { createTranslate, type Messages } from "./i18n.ts"
import type { IrNode } from "./ir.ts"
import { fragment } from "./jsx-runtime.ts"
import { createPlaceholder, type Data, withScopes } from "./placeholder.ts"

export { isEmailDefinition } from "./define.ts"
export { EmailKitError, isEmailKitError } from "./errors.ts"
export type { Messages } from "./i18n.ts"
export * from "./ir.ts"

export interface EvaluatedEmail {
  readonly subject: IrNode
  readonly preheader: IrNode | undefined
  readonly body: IrNode
}

export interface EvaluateOptions {
  readonly locale: string
  readonly messages: Messages
}

/** Runs a template once for one locale, with `data` as placeholders, and returns its IR. */
export function evaluate<T>(
  definition: EmailDefinition<T>,
  options: EvaluateOptions,
): EvaluatedEmail {
  return withScopes(() => {
    const data = createPlaceholder(0) as Data<T>
    const t = createTranslate(options.locale, options.messages)
    return {
      subject: fragment(definition.subject(data, t)),
      preheader: definition.preheader ? fragment(definition.preheader(data, t)) : undefined,
      body: fragment(definition.component({ data, t, locale: options.locale })),
    }
  })
}
