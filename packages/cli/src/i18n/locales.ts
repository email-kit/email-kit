import { type LocaleData, resolveLocale } from "@email-kit/runtime/locale"
import likely from "cldr-core/supplemental/likelySubtags.json" with { type: "json" }
import parents from "cldr-core/supplemental/parentLocales.json" with { type: "json" }

export type { LocaleData }

/** CLDR's parent locales, where dropping the last part is wrong: `es-AR` → `es-419`. */
const PARENTS = parents.supplemental.parentLocales.parentLocale as Readonly<Record<string, string>>
/** CLDR's likely full tag for a short one: `sr` → `sr-Cyrl-RS`, `zh-TW` → `zh-Hant-TW`. */
const LIKELY = likely.supplemental.likelySubtags as Readonly<Record<string, string>>
/** A region subtag: two letters, or three digits such as `419`. */
const REGION = /^([A-Z]{2}|\d{3})$/

/**
 * The locale data the generated module needs to resolve a requested locale, limited to the
 * project's languages so the module stays small:
 * - `parents`: CLDR's parent locales (`es-ar` → `es-419`), then the config's `locales.fallback`,
 *   which wins;
 * - `scripts`: each language's likely script (`sr` → `cyrl`), so `sr-Latn` doesn't fall back to
 *   Cyrillic `sr`;
 * - `regions`: the regions that use another script than their language (`zh-tw` → `hant`), so
 *   `zh-TW` finds `zh-Hant`.
 *
 * Every tag is lowercase, as the runtime compares them. Parents that change no resolution are
 * left out (see `pruneParents`), so an English-only project carries none; `prune: false` keeps
 * them, for tests.
 */
export function localeData(
  locales: readonly string[],
  fallback: Readonly<Record<string, string>> = {},
  options: { readonly prune?: boolean } = {},
): LocaleData {
  const languages = new Set([...locales, ...Object.keys(fallback)].map(languageOf))
  const data = {
    parents: {} as Record<string, string>,
    scripts: {} as Record<string, string>,
    regions: {} as Record<string, string>,
  }
  for (const [child, parent] of Object.entries(PARENTS)) {
    if (languages.has(languageOf(child))) data.parents[child.toLowerCase()] = parent.toLowerCase()
  }
  for (const [tag, target] of Object.entries(fallback)) {
    data.parents[tag.toLowerCase()] = target.toLowerCase()
  }
  for (const language of [...languages].sort()) {
    const script = scriptOf(LIKELY[language])
    if (script) data.scripts[language] = script
  }
  for (const [tag, maximal] of Object.entries(LIKELY)) {
    const [language, region] = tag.split("-")
    if (!language || !region || !languages.has(language) || !REGION.test(region)) continue
    const script = scriptOf(maximal)
    if (script && script !== data.scripts[language]) data.regions[tag.toLowerCase()] = script
  }
  return options.prune === false ? data : { ...data, parents: pruneParents(data, locales) }
}

/**
 * The parents that change where some tag resolves. Each is dropped in turn when every listed tag
 * still resolves to the same compiled locale without it: `en-gb` → `en-001` goes when `en-001`
 * isn't compiled, since dropping the region reaches `en` anyway. A tag that isn't listed resolves
 * by dropping parts until it reaches a listed tag, so checking the listed ones covers it.
 *
 * Languages with a region that changes the script (`zh-tw` → Hant) keep all their parents: the
 * runtime rewrites a requested tag before following parents, so the check above can't stand for
 * a tag reached part-way through.
 */
function pruneParents(data: LocaleData, locales: readonly string[]): Record<string, string> {
  const scripted = new Set(Object.keys(data.regions).map(languageOf))
  const tags = Object.keys(data.parents)
  const resolved = new Map(tags.map((tag) => [tag, resolveLocale(tag, locales, data)]))
  const parents: Record<string, string> = { ...data.parents }
  for (const tag of tags) {
    if (scripted.has(languageOf(tag))) continue
    const { [tag]: _dropped, ...rest } = parents
    const trial: LocaleData = { ...data, parents: rest }
    if (tags.every((t) => resolveLocale(t, locales, trial) === resolved.get(t))) delete parents[tag]
  }
  return parents
}

/** A tag's language, in lowercase: `pt` for `pt-BR`. */
function languageOf(tag: string): string {
  return tag.split(/[-_]/)[0]?.toLowerCase() ?? ""
}

/** The script in a full tag, in lowercase: `cyrl` for `sr-Cyrl-RS`. */
function scriptOf(tag: string | undefined): string | undefined {
  return tag?.split("-")[1]?.toLowerCase()
}
