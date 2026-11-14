import type { StandardSchemaV1 } from "@email-kit/core"
import { EmailKitError } from "@email-kit/core/internal"

import type { Field } from "./schema/index.ts"

/** Sample data a template is rendered with for checks and previews. */
export interface Fixture {
  /** The fixture's name, or `generated empty`, `generated long` or `generated hostile`. */
  readonly name: string
  /** The data, which matches the template's schema. */
  readonly data: unknown
}

/**
 * The variants made from the schema: the least data allowed, the most, and text that would break
 * an email that doesn't escape it.
 */
type Kind = "empty" | "long" | "hostile"

const KINDS: readonly Kind[] = ["empty", "long", "hostile"]

/** Several words of a long name, then one long unbroken token that has to wrap. */
const LONG = `${"Featherstonehaugh ".repeat(6)}${"W".repeat(48)}`
/**
 * Markup, quotes, mustache tags, a right-to-left override and an emoji. It has no line breaks,
 * which a subject refuses at render time.
 */
const HOSTILE = '<script>alert("x")</script> & "q" \'a\' {{name}} {{{raw}}} ‮evil‬ \u{1f600}'
/** Added to the fixture's URL as a query, so its path, such as an image's `.png`, stays. */
const HOSTILE_QUERY = 'q=<script>&x="y"&z={{name}}'
/** The most items a `long` list gets, so a list without `maxItems` stays a sensible size. */
const LONG_ITEMS = 25

/** Fails the compile on a fixture the schema rejects, listing every issue in every fixture. */
export async function validateFixtures(
  schema: StandardSchemaV1,
  fixtures: Readonly<Record<string, unknown>>,
  template: string,
): Promise<void> {
  const problems: string[] = []
  for (const [name, data] of Object.entries(fixtures)) {
    for (const issue of await issuesOf(schema, data)) problems.push(`  • ${name}${issue}`)
  }
  if (problems.length > 0) {
    throw new EmailKitError(
      "invalid-fixture",
      `${template}: ${problems.length === 1 ? "a fixture doesn't" : "fixtures don't"} match the schema:\n${problems.join("\n")}`,
    )
  }
}

/**
 * The named fixtures, then the generated `empty`, `long` and `hostile` variants. A variant the
 * schema rejects, such as one that can't match a pattern, is left out: the backend couldn't send
 * that data either.
 */
export async function fixturesWithVariants(
  schema: StandardSchemaV1,
  model: Field,
  fixtures: Readonly<Record<string, unknown>>,
): Promise<Fixture[]> {
  const named = Object.entries(fixtures).map(([name, data]) => ({ name, data }))
  const out: Fixture[] = [...named]
  for (const kind of KINDS) {
    const data = generate(model, named[0]?.data, kind)
    if ((await issuesOf(schema, data)).length === 0) out.push({ name: `generated ${kind}`, data })
  }
  return out
}

/**
 * Makes a variant of `base`, the first fixture, that stays within the field's constraints. `empty`
 * gives the shortest values and leaves out optional fields; `long` and `hostile` fill every field.
 * A string with a pattern keeps the fixture's value, since a value can't be made to match it.
 */
export function generate(field: Field, base: unknown, kind: Kind): unknown {
  if (field.nullable && kind === "empty") return null
  switch (field.type) {
    case "string":
      return generateString(field, base, kind)
    case "number":
    case "integer":
      return generateNumber(field, base, kind)
    case "boolean":
      return kind === "empty" ? false : kind === "long" ? true : (base ?? true)
    case "array":
      return generateArray(field, base, kind)
    case "object":
      return generateObject(field, base, kind)
  }
}

/**
 * A string: an allowed value for an enum, the fixture's own value under a pattern, and otherwise
 * text cut and padded to the length limits. URLs keep the fixture's URL and get a query added.
 */
function generateString(field: Field, base: unknown, kind: Kind): unknown {
  if (field.enum && field.enum.length > 0) {
    if (kind === "long") return field.enum.reduce((a, b) => (b.length > a.length ? b : a))
    return typeof base === "string" && field.enum.includes(base) ? base : field.enum[0]
  }
  if (field.constraints?.pattern !== undefined) return base
  const min = constraint(field, "minLength") ?? 0
  const max = constraint(field, "maxLength")
  const fit = (text: string) => truncate(text, max).padEnd(min, "x")
  if (field.url) {
    const url = typeof base === "string" ? base : "https://example.test/"
    if (kind === "empty") return url
    const join = url.includes("?") ? "&" : "?"
    return fit(
      `${url}${join}${kind === "hostile" ? HOSTILE_QUERY : `utm_campaign=${"w".repeat(120)}`}`,
    )
  }
  if (kind === "empty") return "x".repeat(min)
  return fit(kind === "long" ? LONG : HOSTILE)
}

/** A number: the minimum when empty, the maximum or a wide number when long, else the fixture's. */
function generateNumber(field: Field, base: unknown, kind: Kind): number {
  const low = constraint(field, "minimum")
  const high = constraint(field, "maximum")
  if (kind === "empty") return low ?? 0
  if (kind === "long") return high ?? (field.type === "integer" ? 1234567 : 1234567.89)
  return typeof base === "number" ? base : (low ?? 0)
}

/**
 * A list: `minItems` items when empty, as many as allowed (at most 25) when long, and otherwise
 * as many as the fixture has. Each item is made from the fixture's first item.
 */
function generateArray(field: Field, base: unknown, kind: Kind): unknown[] {
  const items = Array.isArray(base) ? base : undefined
  const min = constraint(field, "minItems") ?? 0
  const count =
    kind === "empty"
      ? min
      : kind === "long"
        ? Math.max(min, Math.min(constraint(field, "maxItems") ?? LONG_ITEMS, LONG_ITEMS))
        : Math.max(items?.length ?? 1, min)
  return Array.from({ length: count }, () => generate(field.items as Field, items?.[0], kind))
}

/** An object: each property made from the fixture's, without the optional ones when empty. */
function generateObject(field: Field, base: unknown, kind: Kind): Record<string, unknown> {
  const record = typeof base === "object" && base !== null ? (base as Record<string, unknown>) : {}
  const out: Record<string, unknown> = {}
  for (const property of field.properties ?? []) {
    if (kind === "empty" && !property.required) continue
    out[property.name] = generate(property.field, record[property.name], kind)
  }
  return out
}

/** A numeric constraint of the field, such as `maxLength`. */
function constraint(field: Field, key: string): number | undefined {
  const value = field.constraints?.[key]
  return typeof value === "number" ? value : undefined
}

/**
 * `text` cut to at most `max` UTF-16 units, the length schemas count, without splitting a
 * character such as an emoji in two.
 */
function truncate(text: string, max: number | undefined): string {
  if (max === undefined || text.length <= max) return text
  let out = ""
  for (const char of text) {
    if (out.length + char.length > max) break
    out += char
  }
  return out
}

/** The schema's issues with `data`, each as its path and message, such as `.items[0].name: …`. */
async function issuesOf(schema: StandardSchemaV1, data: unknown): Promise<string[]> {
  const result = await schema["~standard"].validate(data)
  return (result.issues ?? []).map((issue) => {
    const path = (issue.path ?? [])
      .map((segment) => (typeof segment === "object" ? segment.key : segment))
      .map((key) => (typeof key === "number" ? `[${key}]` : `.${String(key)}`))
      .join("")
    return `${path}: ${issue.message}`
  })
}
