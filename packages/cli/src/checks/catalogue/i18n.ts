// A.13 i18n (`i18n.*`): the pseudo-locales (I18N-05, research 05 ⚠5).

import type { Check } from "../types.ts"

export const I18N: readonly Check[] = [
  {
    id: "i18n.expansion",
    level: "error",
    rule: "Every template compiles in the pseudo-locales en-XA (accented, bracketed, longer by length) and ar-XB (right to left), and passes the static checks there.",
    fix: "Translations run up to three times longer and right to left: don't build copy from fragments, and don't let the layout depend on a string's length.",
    run: (context, report) => {
      for (const error of context.pseudoErrors) {
        report({
          message: `${error.template} doesn't compile in ${error.locale}: ${error.message}`,
          subject: { template: error.template, locale: error.locale },
        })
      }
    },
  },
]
