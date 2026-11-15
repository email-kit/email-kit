/**
 * `@email-kit/runtime/locale`: picks the compiled locale for a requested one. The generated module
 * imports it when it has more than one locale, or `locales.fallback`.
 *
 * @packageDocumentation
 */

import { has } from "./shared.ts"

/** CLDR data for resolving a requested locale. Tags are lowercase. */
export interface LocaleData {
  /**
   * The next locale to try after one, from CLDR and the config's fallbacks: `es-mx` → `es-419`.
   */
  readonly parents: Readonly<Record<string, string>>
  /** Each language's usual script: `sr` → `cyrl`. */
  readonly scripts: Readonly<Record<string, string>>
  /** A region's script, where it differs from the language's: `zh-tw` → `hant`. */
  readonly regions: Readonly<Record<string, string>>
}

/** No CLDR data: only exact matches and dropping the last part of the tag. */
export const NO_LOCALE_DATA: LocaleData = { parents: {}, scripts: {}, regions: {} }

/**
 * Picks the compiled locale for a requested one. It tries the tag, then its parents (`pt-AO` →
 * `pt-PT` → `pt`), and falls back to the first available locale, the default.
 */
export function resolveLocale(
  requested: string | undefined,
  available: readonly string[],
  data: LocaleData = NO_LOCALE_DATA,
): string {
  const fallback = available[0] as string
  const keyOf = (tag: string) => {
    const parts = tag.toLowerCase().replace(/_/g, "-").split("-")
    const region =
      parts.length >= 2 && (parts[1] as string).length !== 4
        ? data.regions[`${parts[0]}-${parts[1]}`]
        : undefined
    return (region ? [parts[0], region, ...parts.slice(1)] : parts).join("-")
  }
  const compiled: Record<string, string> = {}
  for (const locale of available) compiled[keyOf(locale)] = locale
  let tag = requested ? keyOf(requested) : undefined
  for (let steps = 0; tag && steps < 32; steps++) {
    if (has(compiled, tag)) return compiled[tag] as string
    const next = has(data.parents, tag) ? data.parents[tag] : truncate(tag, data)
    tag = next === "und" || next === "root" ? undefined : next
  }
  return fallback
}

/**
 * The tag without its last part, or `undefined` when that would change the script: `zh-Hant`
 * doesn't fall back to `zh`, which is written in Hans.
 */
function truncate(tag: string, data: LocaleData): string | undefined {
  const parts = tag.split("-")
  parts.pop()
  while (parts.length > 0 && (parts[parts.length - 1] as string).length === 1) parts.pop()
  if (parts.length === 0) return undefined
  const script = tag.split("-")[1] as string
  const likely = data.scripts[parts[0] as string]
  if (parts.length === 1 && script.length === 4 && likely && script !== likely) return undefined
  return parts.join("-")
}
