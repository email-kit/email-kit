// Pseudo-locales (P1-155, I18N-05): en-XA (accented, bracketed, longer by length) and ar-XB (right
// to left), generated from the default locale's messages. `check` always builds them in memory;
// they ship only when `locales.pseudo` asks for them.

import { pseudoMessage } from "@email-kit/core/internal"

import { pluralRules } from "./plurals.ts"

export const PSEUDO_LOCALES = ["en-XA", "ar-XB"] as const

export function isPseudo(locale: string): boolean {
  return (PSEUDO_LOCALES as readonly string[]).includes(locale)
}

/** The default locale's messages, pseudo-localised for `locale`. */
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
