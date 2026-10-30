// CLDR plural rules compiled to small functions (ADR 0003, I18N-06): the generated module embeds
// one per locale, so the category a number gets doesn't depend on the runtime's ICU. The data is
// cldr-core's, pinned, and the version goes into the manifest.

import { EmailKitError } from "@email-kit/core/internal"
import plurals from "cldr-core/supplemental/plurals.json" with { type: "json" }

const DATA = plurals.supplemental["plurals-type-cardinal"] as Readonly<
  Record<string, Readonly<Record<string, string>>>
>

/** The CLDR release the rules come from. */
export const CLDR_VERSION: string = plurals.supplemental.version._cldrVersion

/** CLDR's order, which messages and reports follow. */
export const CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const
export type Category = (typeof CATEGORIES)[number]

export interface PluralRules {
  /** The CLDR locale the rules came from: `de` for `de-AT` */
  readonly locale: string
  /** The categories this locale uses, in CLDR order; always ends with `other` */
  readonly categories: readonly Category[]
  /** A JavaScript function expression, `(n) => …`, returning the category of a number */
  readonly source: string
  readonly category: (n: number) => Category
}

const cache = new Map<string, PluralRules>()

export function pluralRules(locale: string): PluralRules {
  const cached = cache.get(locale)
  if (cached) return cached
  // de-AT → de; a language CLDR doesn't list uses root's rule: everything is `other`.
  const tags = [
    locale,
    ...locale.split("-").map((_, i, parts) => parts.slice(0, parts.length - 1 - i).join("-")),
  ]
  const found = tags.find((tag) => tag && DATA[tag]) ?? ""
  const rules = DATA[found] ?? { "pluralRule-count-other": "" }
  const branches: string[] = []
  const categories: Category[] = []
  for (const category of CATEGORIES) {
    const rule = rules[`pluralRule-count-${category}`]
    if (rule === undefined) continue
    categories.push(category)
    if (category === "other") continue
    branches.push(
      `if (${compileCondition(rule.split("@")[0]?.trim() ?? "", found)}) return "${category}"`,
    )
  }
  const source = [
    "(n) => {",
    "  const s = String(Math.abs(n))",
    '  const dot = s.indexOf(".")',
    '  const f = dot < 0 ? "" : s.slice(dot + 1)',
    '  const t = f.replace(/0+$/, "")',
    "  const o = { n: Math.abs(n), i: Math.trunc(Math.abs(n)), v: f.length, w: t.length, f: Number(f || 0), t: Number(t || 0), c: 0, e: 0 }",
    ...branches.map((branch) => `  ${branch}`),
    '  return "other"',
    "}",
  ].join("\n")
  const category = new Function(`return ${source}`)() as (n: number) => Category
  const compiled: PluralRules = { locale: found || "root", categories, source, category }
  cache.set(locale, compiled)
  return compiled
}

// CLDR plural rule syntax (UTS #35, Plural rules): or-joined and-conditions of relations such as
// `n % 10 = 2..4` or `i != 0,1`, over the operands n i v w f t c e.
function compileCondition(rule: string, locale: string): string {
  if (!rule) return "false"
  return rule
    .split(/\s+or\s+/)
    .map((and) =>
      and
        .split(/\s+and\s+/)
        .map((relation) => compileRelation(relation.trim(), locale))
        .join(" && "),
    )
    .map((and) => `(${and})`)
    .join(" || ")
}

function compileRelation(relation: string, locale: string): string {
  const match = /^([nivwftce])(?:\s*%\s*(\d+))?\s*(!=|=)\s*([\d.,\s]+)$/.exec(relation)
  if (!match) {
    throw new EmailKitError(
      "invalid-plural",
      `CLDR's plural rule for "${locale}" has "${relation}", which email-kit can't read`,
    )
  }
  const [, operand, modulo, op, list] = match as unknown as [
    string,
    string,
    string | undefined,
    string,
    string,
  ]
  const value = modulo ? `(o.${operand} % ${modulo})` : `o.${operand}`
  // Only n can be fractional; a range matches whole numbers only.
  const whole = operand === "n" ? ` && ${value} % 1 === 0` : ""
  const tests = list.split(",").map((item) => {
    const [low, high] = item.trim().split("..")
    return high === undefined
      ? `${value} === ${low}`
      : `(${value} >= ${low} && ${value} <= ${high}${whole})`
  })
  const any = tests.length === 1 ? (tests[0] as string) : `(${tests.join(" || ")})`
  return op === "=" ? any : `!(${any})`
}
