import { PSEUDO_LOCALES } from "../../i18n/pseudo.ts"

import { checkKeys, isRecord, type Problems, quoted } from "./shared.ts"

/** The locale settings in a resolved config. */
export interface ConfigLocales {
  /** Every locale to compile: the default, the rest of `list`, then the pseudo-locales. */
  readonly locales: string[]
  /** Each tag in `locales.fallback`, and the compiled locale it goes to. */
  readonly localeFallback: Record<string, string>
}

/** The options inside `locales`. */
const LOCALE_KEYS: readonly string[] = ["default", "list", "fallback", "pseudo"]

/**
 * Reads `locales`: `default` and `list` give the locales to compile, `pseudo` adds generated test
 * locales, and `fallback` sends tags that aren't compiled to ones that are. Without `locales` it
 * compiles just `en`.
 */
export function readLocales(value: unknown, problems: Problems): ConfigLocales {
  if (value === undefined) return { locales: ["en"], localeFallback: {} }
  if (!isRecord(value)) {
    problems.push('locales: must be an object like { default: "en", list: ["en", "de"] }')
    return { locales: ["en"], localeFallback: {} }
  }
  checkKeys(value, LOCALE_KEYS, "locales.", problems)
  const real = readList(value.default, value.list, problems)
  const locales = [...real, ...readPseudo(value.pseudo, real, problems)]
  return { locales, localeFallback: readFallback(value.fallback, locales, problems) }
}

/** Reads `default` and `list`: the default first, then the rest of the list. */
function readList(fallback: unknown, list: unknown, problems: Problems): string[] {
  const fallbackProblem = localeProblem(fallback)
  if (typeof fallback !== "string" || fallbackProblem) {
    problems.push(`locales.default: ${fallbackProblem ?? 'must be a locale tag, such as "en"'}`)
    return ["en"]
  }
  if (list === undefined) return [fallback]
  if (!Array.isArray(list) || list.length === 0) {
    problems.push("locales.list: must be a non-empty array of locale tags")
    return [fallback]
  }
  const seen = new Set<string>()
  list.forEach((tag, index) => {
    const problem = localeProblem(tag)
    if (problem) {
      problems.push(`locales.list[${index}]: ${problem}`)
    } else if (seen.has(tag.toLowerCase())) {
      problems.push(`locales.list[${index}]: "${tag}" is listed twice`)
    }
    if (typeof tag === "string") seen.add(tag.toLowerCase())
  })
  if (!seen.has(fallback.toLowerCase())) {
    problems.push(`locales.list: must include the default locale "${fallback}"`)
  }
  return [
    fallback,
    ...list.filter((tag): tag is string => typeof tag === "string" && tag !== fallback),
  ]
}

/** Reads `pseudo`: `true` for both pseudo-locales, or a list of them. */
function readPseudo(pseudo: unknown, locales: readonly string[], problems: Problems): string[] {
  if (pseudo === undefined || pseudo === false) return []
  const chosen: unknown = pseudo === true ? [...PSEUDO_LOCALES] : pseudo
  if (!Array.isArray(chosen) || chosen.some((tag) => !PSEUDO_LOCALES.includes(tag))) {
    problems.push(`locales.pseudo: must be true, or a list of ${quoted(PSEUDO_LOCALES, "and")}`)
    return []
  }
  const clash = chosen.find((tag) => find(locales, tag))
  if (clash) {
    problems.push(
      `locales.pseudo: "${clash}" is also in locales.list; pseudo-locales are generated, not translated`,
    )
    return []
  }
  return [...new Set<string>(chosen)]
}

/** Reads `fallback`, such as `{ pt: "pt-BR" }`: from a tag that isn't compiled to one that is. */
function readFallback(
  chain: unknown,
  locales: readonly string[],
  problems: Problems,
): Record<string, string> {
  if (chain === undefined) return {}
  if (!isRecord(chain)) {
    problems.push('locales.fallback: must be an object like { pt: "pt-BR" }')
    return {}
  }
  const out: Record<string, string> = {}
  for (const [tag, target] of Object.entries(chain)) {
    const problem = localeProblem(tag)
    const to = typeof target === "string" ? find(locales, target) : undefined
    if (problem) {
      problems.push(`locales.fallback: "${tag}": ${problem}`)
    } else if (find(locales, tag)) {
      problems.push(`locales.fallback.${tag}: "${tag}" is compiled, so it never falls back`)
    } else if (!to) {
      problems.push(
        `locales.fallback.${tag}: must be one of the compiled locales (${locales.join(", ")})`,
      )
    } else {
      out[tag] = to
    }
  }
  return out
}

/** The locale in `locales` that matches `tag`, ignoring case. */
function find(locales: readonly string[], tag: string): string | undefined {
  return locales.find((locale) => locale.toLowerCase() === tag.toLowerCase())
}

/** Accepts only canonical tags (`pt-BR`, not `pt-br`): they become file names and object keys. */
function localeProblem(tag: unknown): string | undefined {
  if (typeof tag !== "string") return `${JSON.stringify(tag)} isn't a locale tag`
  let canonical: string | undefined
  try {
    canonical = Intl.getCanonicalLocales(tag)[0]
  } catch {
    return `"${tag}" isn't a BCP 47 locale tag, such as "en" or "pt-BR"`
  }
  return canonical === tag ? undefined : `write "${tag}" as "${canonical}"`
}
