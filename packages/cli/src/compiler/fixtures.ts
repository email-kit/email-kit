// Fixtures (P1-015, AUTH-06): every named fixture is validated against the template's schema, and
// empty, long and hostile variants are generated from the schema's model, starting from the first
// fixture and staying within its constraints (research 05 §8). A variant the schema still
// rejects (a pattern, say) is left out: the backend can't send that data either.

import type { StandardSchemaV1 } from "@email-kit/core"
import { EmailKitError } from "@email-kit/core/internal"

import type { Field } from "./schema.ts"

export interface Fixture {
  /** The fixture's name, or "generated empty" and the like */
  readonly name: string
  readonly data: unknown
}

type Kind = "empty" | "long" | "hostile"

// Long: several words of a long name, then one long unbroken token that has to wrap.
const LONG = `${"Featherstonehaugh ".repeat(6)}${"W".repeat(48)}`
// Hostile: markup, quotes, mustache tags, a right-to-left override and an emoji. No CR or LF:
// those are refused in subjects at render time, by design.
const HOSTILE =
  '<script>alert("x")</script> & "q" \'a\' {{name}} {{{raw}}} \u202eevil\u202c \u{1f600}'
// Appended to the fixture's URL, so its path (an image's .png, say) stays.
const HOSTILE_QUERY = 'q=<script>&x="y"&z={{name}}'

/** Fails the compile on a fixture the schema rejects. */
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

/** The named fixtures, then the generated variants the schema accepts. */
export async function fixturesWithVariants(
  schema: StandardSchemaV1,
  model: Field,
  fixtures: Readonly<Record<string, unknown>>,
): Promise<Fixture[]> {
  const named = Object.entries(fixtures).map(([name, data]) => ({ name, data }))
  const base = named[0]?.data
  const out: Fixture[] = [...named]
  for (const kind of ["empty", "long", "hostile"] as const) {
    const data = generate(model, base, kind)
    if ((await issuesOf(schema, data)).length === 0) out.push({ name: `generated ${kind}`, data })
  }
  return out
}

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

export function generate(field: Field, base: unknown, kind: Kind): unknown {
  const c = field.constraints ?? {}
  const num = (key: string) => (typeof c[key] === "number" ? (c[key] as number) : undefined)
  if (field.nullable && kind === "empty") return null
  switch (field.type) {
    case "string": {
      if (field.enum && field.enum.length > 0) {
        if (kind === "long") return field.enum.reduce((a, b) => (b.length > a.length ? b : a))
        return typeof base === "string" && field.enum.includes(base) ? base : field.enum[0]
      }
      // A pattern can't be satisfied blindly; keep the fixture's value.
      if (c.pattern !== undefined) return base
      const min = num("minLength") ?? 0
      const max = num("maxLength")
      const fit = (text: string) => {
        const cut = max === undefined ? text : [...text].slice(0, max).join("")
        return cut.length >= min ? cut : cut.padEnd(min, "x")
      }
      if (field.url) {
        const url = typeof base === "string" ? base : "https://example.test/"
        if (kind === "empty") return url
        const join = url.includes("?") ? "&" : "?"
        if (kind === "hostile") return fit(`${url}${join}${HOSTILE_QUERY}`)
        return fit(`${url}${join}utm_campaign=${"w".repeat(120)}`)
      }
      if (kind === "empty") return "x".repeat(min)
      return fit(kind === "long" ? LONG : HOSTILE)
    }
    case "number":
    case "integer": {
      const low = num("minimum")
      const high = num("maximum")
      if (kind === "empty") return low ?? 0
      if (kind === "long") return high ?? (field.type === "integer" ? 1234567 : 1234567.89)
      return typeof base === "number" ? base : (low ?? 0)
    }
    case "boolean":
      return kind === "empty" ? false : kind === "long" ? true : (base ?? true)
    case "array": {
      const item = Array.isArray(base) ? base[0] : undefined
      const count =
        kind === "empty"
          ? (num("minItems") ?? 0)
          : kind === "long"
            ? Math.min(num("maxItems") ?? 25, 25)
            : Math.max(Array.isArray(base) ? base.length : 1, num("minItems") ?? 0)
      return Array.from({ length: count }, () => generate(field.items as Field, item, kind))
    }
    case "object": {
      const record = (typeof base === "object" && base !== null ? base : {}) as Record<
        string,
        unknown
      >
      const out: Record<string, unknown> = {}
      for (const property of field.properties ?? []) {
        // Empty leaves out every optional field; long and hostile fill them all.
        if (kind === "empty" && !property.required) continue
        out[property.name] = generate(property.field, record[property.name], kind)
      }
      return out
    }
  }
}
