// Choosing the compiled locale for a requested one, over CLDR data.

import { has } from "./shared.ts"

// --- inlined into generated modules from here ---

/** CLDR data for resolving a requested locale. */
export interface LocaleData {
  readonly parents: Readonly<Record<string, string>>
  readonly scripts: Readonly<Record<string, string>>
  readonly regions: Readonly<Record<string, string>>
}

export const NO_LOCALE_DATA: LocaleData = { parents: {}, scripts: {}, regions: {} }

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
