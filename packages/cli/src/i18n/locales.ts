// The locale data a generated module needs to resolve a requested locale (I18N-04): CLDR's parent
// locales, the likely script of each language, and the regions that use another script, filtered
// to the project's languages. Explicit fallbacks from the config override CLDR's parents.

import likely from "cldr-core/supplemental/likelySubtags.json" with { type: "json" }
import parents from "cldr-core/supplemental/parentLocales.json" with { type: "json" }

export interface LocaleData {
  /** A lowercase tag → the next tag to try; `und` stops at the default */
  readonly parents: Readonly<Record<string, string>>
  /** A language → its likely script, lowercase: `sr` → `cyrl` */
  readonly scripts: Readonly<Record<string, string>>
  /** `language-region` → the script it implies when it differs from the language's: `zh-tw` → `hant` */
  readonly regions: Readonly<Record<string, string>>
}

const PARENTS = parents.supplemental.parentLocales.parentLocale as Readonly<Record<string, string>>
const LIKELY = likely.supplemental.likelySubtags as Readonly<Record<string, string>>

export function localeData(
  locales: readonly string[],
  fallback: Readonly<Record<string, string>> = {},
): LocaleData {
  const language = (tag: string) => tag.split(/[-_]/)[0]?.toLowerCase() ?? ""
  const languages = new Set([...locales, ...Object.keys(fallback)].map(language))
  const scriptOf = (tag: string | undefined) => tag?.split("-")[1]?.toLowerCase()
  const out = {
    parents: {} as Record<string, string>,
    scripts: {} as Record<string, string>,
    regions: {} as Record<string, string>,
  }
  for (const [child, parent] of Object.entries(PARENTS)) {
    if (languages.has(language(child))) out.parents[child.toLowerCase()] = parent.toLowerCase()
  }
  for (const [tag, target] of Object.entries(fallback))
    out.parents[tag.toLowerCase()] = target.toLowerCase()
  for (const lang of [...languages].sort()) {
    const script = scriptOf(LIKELY[lang])
    if (script) out.scripts[lang] = script
  }
  for (const [tag, maximal] of Object.entries(LIKELY)) {
    const [lang, region] = tag.split("-")
    if (!lang || !region || !languages.has(lang) || !/^([A-Z]{2}|\d{3})$/.test(region)) continue
    const script = scriptOf(maximal)
    if (script && script !== out.scripts[lang]) out.regions[tag.toLowerCase()] = script
  }
  return out
}
