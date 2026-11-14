import { pseudoMessage } from "@email-kit/core/internal"

import { pluralRules } from "./plurals.ts"

/**
 * The pseudo-locales, made from the default locale's messages: `en-XA` is accented, bracketed and
 * longer, and `ar-XB` is right to left. `check` always builds them in memory, and they ship only
 * when `locales.pseudo` asks for them.
 */
export const PSEUDO_LOCALES = ["en-XA", "ar-XB"] as const

/** Whether a locale is one of the pseudo-locales, which are generated, never translated. */
export function isPseudo(locale: string): boolean {
  return (PSEUDO_LOCALES as readonly string[]).includes(locale)
}

/**
 * The default locale's messages, pseudo-localised for `locale`. Placeholders and ICU syntax are
 * kept; a plural gets every category the pseudo-locale uses, so `ar-XB` has all six of Arabic's.
 */
export function pseudoMessages(
  messages: Readonly<Record<string, string>>,
  locale: string,
): Record<string, string> {
  const mode = locale === "ar-XB" ? "rtl" : "expand"
  const { categories } = pluralRules(locale)
  return Object.fromEntries(
    Object.entries(messages).map(([key, source]) => [
      key,
      pseudoMessage(source, mode, categories, `Message "${key}" in locale "${locale}"`),
    ]),
  )
}
