import { EmailKitError } from "@email-kit/core/internal"
import plurals from "cldr-core/supplemental/plurals.json" with { type: "json" }

const DATA = plurals.supplemental["plurals-type-cardinal"] as Readonly<
  Record<string, Readonly<Record<string, string>>>
>

/** The CLDR release the rules come from, pinned through cldr-core, and written to the manifest. */
export const CLDR_VERSION: string = plurals.supplemental.version._cldrVersion

/** CLDR's order, which messages and reports follow. */
export const CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const
/** A plural category, such as `one` or `few`. */
export type Category = (typeof CATEGORIES)[number]

/** A locale's plural rules, both as a function and as the source the generated module embeds. */
export interface PluralRules {
  /** The CLDR locale the rules came from, such as `de` for `de-AT`. */
  readonly locale: string
  /** The categories this locale uses, in CLDR order. It always ends with `other`. */
  readonly categories: readonly Category[]
  /** A JavaScript function expression, `(n) => …`, that returns the category of a number. */
  readonly source: string
  /** The category of a number: `source`, compiled. */
  readonly category: (n: number) => Category
}

/**
 * The start of every rule function: the operands of UTS #35 for `n`. `n` is the absolute value,
 * `i` its integer digits, `v` and `w` how many fraction digits it has with and without trailing
 * zeros, and `f` and `t` those digits. `c` and `e`, the compact exponent, are always 0, since the
 * value is a plain number.
 */
const OPERANDS = [
  "  const s = String(Math.abs(n))",
  '  const dot = s.indexOf(".")',
  '  const f = dot < 0 ? "" : s.slice(dot + 1)',
  '  const t = f.replace(/0+$/, "")',
  "  const o = { n: Math.abs(n), i: Math.trunc(Math.abs(n)), v: f.length, w: t.length, f: Number(f || 0), t: Number(t || 0), c: 0, e: 0 }",
]

/** The rules for each locale asked for, compiled once. */
const cache = new Map<string, PluralRules>()

/**
 * A locale's CLDR plural rules, compiled to a small function. The generated module embeds one for
 * each locale, so a number's category doesn't depend on the ICU data of the runtime. A region uses
 * its language's rules (`de-AT` → `de`), and a language CLDR doesn't list puts every number in
 * `other`.
 */
export function pluralRules(locale: string): PluralRules {
  const cached = cache.get(locale)
  if (cached) return cached
  const parts = locale.split("-")
  const tags = parts.map((_, i) => parts.slice(0, parts.length - i).join("-"))
  const found = tags.find((tag) => DATA[tag]) ?? ""
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
    ...OPERANDS,
    ...branches.map((branch) => `  ${branch}`),
    '  return "other"',
    "}",
  ].join("\n")
  const category = new Function(`return ${source}`)() as (n: number) => Category
  const compiled: PluralRules = { locale: found || "root", categories, source, category }
  cache.set(locale, compiled)
  return compiled
}

/**
 * Compiles a CLDR plural condition to JavaScript. The syntax, from UTS #35, is `or`-joined groups
 * of `and`-joined relations such as `n % 10 = 2..4` or `i != 0,1`, over the operands
 * `n i v w f t c e`.
 */
function compileCondition(rule: string, locale: string): string {
  if (!rule) return "false"
  return rule
    .split(/\s+or\s+/)
    .map((group) => {
      const relations = group
        .split(/\s+and\s+/)
        .map((relation) => compileRelation(relation.trim(), locale))
      return `(${relations.join(" && ")})`
    })
    .join(" || ")
}

/** Compiles one relation. Only `n` can be fractional, and a range matches whole numbers only. */
function compileRelation(relation: string, locale: string): string {
  const match = /^([nivwftce])(?:\s*%\s*(\d+))?\s*(!=|=)\s*([\d.,\s]+)$/.exec(relation)
  if (!match) {
    throw new EmailKitError(
      "invalid-plural",
      `CLDR's plural rule for "${locale}" has "${relation}", which email-kit can't read`,
    )
  }
  const [, operand, modulo, op, list = ""] = match
  const value = modulo ? `(o.${operand} % ${modulo})` : `o.${operand}`
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
