// Compiler-facing API: not for template authors, and not covered by semver until v1.

import type { EmailDefinition } from "./define.ts"
import { createTranslate, type Messages } from "./i18n.ts"
import type { IrNode } from "./ir.ts"
import { fragment } from "./jsx-runtime.ts"
import { createPlaceholder, type Data, withScopes } from "./placeholder.ts"
import { createPlatform, type PlatformValues } from "./platform.ts"
import { type ThemeContext, withDirection, withTheme } from "./theme-context.ts"

export { isEmailDefinition } from "./define.ts"
export { EmailKitError, isEmailKitError } from "./errors.ts"
export type { Messages } from "./i18n.ts"
export * from "./ir.ts"
export {
  PLATFORM_KEYS,
  type PlatformKey,
  type PlatformValues,
  RESERVED_KEY,
} from "./platform.ts"
export { parseRoleClass, roleClass, type ThemeContext } from "./theme-context.ts"

export interface EvaluatedEmail {
  readonly subject: IrNode
  readonly preheader: IrNode | undefined
  readonly body: IrNode
}

export interface EvaluateOptions {
  readonly locale: string
  readonly messages: Messages
  readonly platform?: PlatformValues
  /** The resolved theme components read with useTheme() */
  readonly theme?: ThemeContext
  /** The locale's writing direction, read with useDirection(). Default: `ltr` */
  readonly dir?: "ltr" | "rtl"
}

/** Runs a template once for one locale, with `data` as placeholders, and returns its IR. */
export function evaluate<T>(
  definition: EmailDefinition<T>,
  options: EvaluateOptions,
): EvaluatedEmail {
  return withDirection(options.dir ?? "ltr", () =>
    withTheme(options.theme, () =>
      withScopes(() => {
        const data = createPlaceholder(0) as Data<T>
        const t = createTranslate(options.locale, options.messages)
        const platform = createPlatform(options.platform ?? { constants: {}, runtime: [] })
        return {
          subject: fragment(definition.subject(data, t, platform)),
          preheader: definition.preheader
            ? fragment(definition.preheader(data, t, platform))
            : undefined,
          body: fragment(definition.component({ data, t, locale: options.locale, platform })),
        }
      }),
    ),
  )
}
