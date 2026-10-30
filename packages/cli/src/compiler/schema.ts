// Standard Schema → the portable data model (R4) → canonical JSON Schema 2020-12 (P0-10).
//
// Libraries emit different JSON Schema for the same shape (nullable as `type: [t, "null"]` or
// `anyOf`, integer bounds, open or closed objects, property order), so the compiler reads their
// output into one small model and writes its own schema.json from it. Anything outside the model
// is reported, never passed through.

import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

import type { StandardSchemaV1 } from "@email-kit/core"
import { EmailKitError, isEmailKitError } from "@email-kit/core/internal"

export type FieldType = "string" | "number" | "integer" | "boolean" | "array" | "object"

/** One field in the portable model: what every target language can represent. */
export interface Field {
  readonly type: FieldType
  readonly nullable: boolean
  readonly description?: string
  /** string fields: allowed values */
  readonly enum?: readonly string[]
  /** string fields: a format hint for caller-formatted values (I18N-07) */
  readonly format?: string
  /** minLength, maxLength, pattern, minimum, maximum, multipleOf, minItems, maxItems… */
  readonly constraints?: Readonly<Record<string, number | string>>
  readonly items?: Field
  readonly properties?: readonly Property[]
  readonly secret?: true
  readonly url?: true
}

export interface Property {
  readonly name: string
  readonly required: boolean
  readonly field: Field
}

export interface SchemaIssue {
  /** Where in the data, like `items[].price`; empty for the root */
  readonly path: string
  readonly message: string
}

export interface PortableSchema {
  readonly model: Field | undefined
  /** Canonical JSON Schema 2020-12, when there are no issues */
  readonly jsonSchema: Readonly<Record<string, unknown>> | undefined
  readonly issues: readonly SchemaIssue[]
}

/** The vendor extension keyword carrying email-kit field markers. */
export const MARKER_KEY = "x-email-kit"

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const UNION = "Unions aren't portable: use one type, optionally nullable"
const COMBINATORS: readonly (readonly [string, string])[] = [
  ["prefixItems", "Tuples (prefixItems) aren't portable: use an object with named fields"],
  ["allOf", "Intersections that don't merge into one object (allOf) aren't portable"],
  ["$ref", "Recursive or shared definitions ($ref) aren't portable"],
  ["$defs", "Recursive or shared definitions ($defs) aren't portable"],
  ["not", 'The JSON Schema keyword "not" isn\'t portable'],
  ["if", "Conditional schemas (if/then/else) aren't portable"],
]
const MAX_SAFE = Number.MAX_SAFE_INTEGER
const ANNOTATIONS = new Set([
  "$schema",
  "$comment",
  "title",
  "description",
  "examples",
  "deprecated",
  "readOnly",
  "writeOnly",
  MARKER_KEY,
])
const CONSTRAINTS: Readonly<Record<string, ReadonlySet<string>>> = {
  string: new Set(["minLength", "maxLength", "pattern"]),
  number: new Set(["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"]),
  integer: new Set(["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"]),
  array: new Set(["minItems", "maxItems"]),
  object: new Set(),
  boolean: new Set(),
}
const STRUCTURE: Readonly<Record<string, ReadonlySet<string>>> = {
  string: new Set(["type", "enum", "const", "format"]),
  number: new Set(["type"]),
  integer: new Set(["type"]),
  boolean: new Set(["type"]),
  array: new Set(["type", "items"]),
  object: new Set([
    ...["type", "properties", "required", "additionalProperties"],
    ...["propertyNames", "patternProperties"],
  ]),
}

/** Reads a template's schema into the portable model and checks it (`source.schema-portable`). */
export async function readSchema(
  schema: StandardSchemaV1,
  options: { readonly resolveFrom: string },
): Promise<PortableSchema> {
  const issues: SchemaIssue[] = []
  const models: Partial<Record<"input" | "output", Field>> = {}
  for (const io of ["input", "output"] as const) {
    let json: unknown
    try {
      json = await toJsonSchema(schema, io, options.resolveFrom)
    } catch (error) {
      if (isEmailKitError(error)) throw error
      issues.push({ path: "", message: `JSON Schema conversion failed: ${firstLine(error)}` })
      break
    }
    const model = toField(json, "", issues)
    if (model) models[io] = model
  }
  const { input, output } = models
  if (output && output.type !== "object") {
    issues.push({
      path: "",
      message: "The schema must be an object (z.object, type({…}), v.object)",
    })
  } else if (output?.nullable) {
    issues.push({ path: "", message: "The schema root can't be nullable" })
  }
  if (input && output && JSON.stringify(emit(input)) !== JSON.stringify(emit(output))) {
    issues.push({
      path: "",
      message:
        "The schema's input and output types differ (defaults, transforms or coercions). Data " +
        "reaches the template as sent, so the schema must not change it",
    })
  }
  const unique = dedupe(issues)
  return {
    model: output,
    jsonSchema:
      output && unique.length === 0
        ? { $schema: "https://json-schema.org/draft/2020-12/schema", ...emit(output) }
        : undefined,
    issues: unique,
  }
}

async function toJsonSchema(
  schema: StandardSchemaV1,
  io: "input" | "output",
  resolveFrom: string,
): Promise<unknown> {
  const standard = schema["~standard"] as StandardSchemaV1.Props & {
    readonly jsonSchema?: Record<typeof io, (options: { target: string }) => unknown>
  }
  if (standard.jsonSchema) return standard.jsonSchema[io]({ target: "draft-2020-12" })
  if (standard.vendor === "valibot") {
    // Valibot 1.5 has no ~standard.jsonSchema; its official converter is installed by the user.
    let path: string
    try {
      path = createRequire(resolveFrom).resolve("@valibot/to-json-schema")
    } catch {
      throw new EmailKitError(
        "missing-converter",
        "Valibot schemas need @valibot/to-json-schema: install it as a devDependency",
      )
    }
    const converter = (await import(pathToFileURL(path).href)) as {
      toJsonSchema: (schema: unknown, config: Record<string, unknown>) => unknown
    }
    return converter.toJsonSchema(schema, {
      target: "draft-2020-12",
      typeMode: io,
      errorMode: "throw",
      // Refinements are allowed as TS-only checks, as Zod and ArkType treat them (P0-10).
      ignoreActions: ["check"],
    })
  }
  throw new EmailKitError(
    "unsupported-schema",
    `A "${standard.vendor}" schema can't be converted to JSON Schema. Use Zod 4, ArkType 2 or ` +
      "Valibot with @valibot/to-json-schema",
  )
}

function toField(json: unknown, path: string, issues: SchemaIssue[]): Field | undefined {
  const fail = (message: string): undefined => {
    issues.push({ path, message })
    return undefined
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return fail("Not a JSON Schema object")
  }
  const schema = json as Record<string, unknown>

  // Nullable, in each library's spelling: anyOf/oneOf with {type: "null"}, or type: [t, "null"].
  for (const key of ["anyOf", "oneOf"]) {
    const options = schema[key]
    if (!Array.isArray(options)) continue
    const { [key]: _, ...outer } = schema
    // A union of literals is an enum (ArkType writes 'a' | 'b' | null this way).
    const literals = options.map(literalValues)
    if (literals.every((values) => values !== undefined)) {
      return toField({ ...outer, enum: literals.flat() }, path, issues)
    }
    const rest = options.filter((option) => !isNullSchema(option))
    if (rest.length !== 1 || rest.length === options.length) return fail(UNION)
    const inner = toField({ ...(rest[0] as object), ...outer }, path, issues)
    return inner && { ...inner, nullable: true }
  }

  for (const [keyword, message] of COMBINATORS) {
    if (keyword in schema) return fail(message)
  }

  let nullable = false
  let type = schema.type
  if (Array.isArray(type)) {
    nullable = type.includes("null")
    const rest = type.filter((t) => t !== "null")
    if (rest.length !== 1) return fail(UNION)
    type = rest[0]
  }
  let values: unknown[] | undefined = Array.isArray(schema.enum)
    ? schema.enum
    : "const" in schema
      ? [schema.const]
      : undefined
  if (values?.includes(null)) {
    nullable = true
    values = values.filter((value) => value !== null)
  }
  if (values && !values.every((value) => typeof value === "string")) {
    return fail("Only string enums and literals are portable")
  }
  if (type === undefined && values) type = "string"
  if (type === undefined) {
    return fail(
      "A field with no JSON type isn't portable (any, unknown, or a type JSON Schema can't " +
        "express, such as Date or bigint)",
    )
  }
  if (typeof type !== "string" || !(type in STRUCTURE)) {
    return fail(`The type ${JSON.stringify(type)} isn't portable`)
  }
  const fieldType = type as FieldType

  if ("default" in schema) {
    fail(
      "Default values aren't portable: the backend sends every value (other runtimes can't fill it)",
    )
  }
  const allowed = STRUCTURE[fieldType] as ReadonlySet<string>
  const constraintKeys = CONSTRAINTS[fieldType] as ReadonlySet<string>
  for (const key of Object.keys(schema)) {
    if (key === "default") continue
    if (!ANNOTATIONS.has(key) && !allowed.has(key) && !constraintKeys.has(key)) {
      fail(`The JSON Schema keyword "${key}" isn't portable`)
    }
  }

  const field: { -readonly [K in keyof Field]: Field[K] } = { type: fieldType, nullable }
  if (typeof schema.description === "string") field.description = schema.description
  if (values) field.enum = values as string[]
  if (fieldType === "string" && typeof schema.format === "string") field.format = schema.format

  const constraints: Record<string, number | string> = {}
  for (const key of [...constraintKeys].sort()) {
    const value = schema[key]
    if (typeof value !== "number" && typeof value !== "string") continue
    // Zod bounds every integer by the safe range; that's implied by every target language.
    if (fieldType === "integer" && Math.abs(Number(value)) === MAX_SAFE) continue
    constraints[key] = value
  }
  if (Object.keys(constraints).length > 0) field.constraints = constraints

  const marker = schema[MARKER_KEY]
  if (marker !== undefined) {
    const { secret, url, ...unknown } =
      typeof marker === "object" && marker !== null ? (marker as Record<string, unknown>) : {}
    if (Object.keys(unknown).length > 0 || typeof marker !== "object") {
      fail(`Unknown ${MARKER_KEY} marker ${JSON.stringify(marker)}`)
    }
    if (secret === true) field.secret = true
    if (url === true) {
      if (fieldType !== "string") fail("Only string fields can be url fields")
      field.url = true
    }
  }

  if (fieldType === "array") {
    if (schema.items === undefined || Array.isArray(schema.items)) {
      return fail("Arrays need one item schema (tuples aren't portable)")
    }
    const items = toField(schema.items, `${path}[]`, issues)
    if (items) field.items = items
  }

  if (fieldType === "object") {
    if (
      typeof schema.additionalProperties === "object" ||
      "propertyNames" in schema ||
      "patternProperties" in schema
    ) {
      fail("Maps with dynamic keys (records) aren't portable: list the keys as properties")
    }
    const properties = (schema.properties ?? {}) as Record<string, unknown>
    const required = new Set(Array.isArray(schema.required) ? schema.required : [])
    field.properties = Object.entries(properties).flatMap(([name, value]) => {
      const childPath = path ? `${path}.${name}` : name
      if (!NAME.test(name)) {
        issues.push({
          path: childPath,
          message: `The field name "${name}" isn't portable: use letters, digits and _`,
        })
        return []
      }
      const child = toField(value, childPath, issues)
      return child ? [{ name, required: required.has(name), field: child }] : []
    })
  }
  return field
}

function emit(field: Field): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (field.description !== undefined) out.description = field.description
  out.type = field.nullable ? [field.type, "null"] : field.type
  if (field.enum) out.enum = field.nullable ? [...field.enum, null] : field.enum
  if (field.format !== undefined) out.format = field.format
  Object.assign(out, field.constraints)
  if (field.items) out.items = emit(field.items)
  if (field.properties) {
    out.properties = Object.fromEntries(field.properties.map((p) => [p.name, emit(p.field)]))
    const required = field.properties.filter((p) => p.required).map((p) => p.name)
    if (required.length > 0) out.required = required
  }
  if (field.secret || field.url) {
    out[MARKER_KEY] = { ...(field.secret && { secret: true }), ...(field.url && { url: true }) }
  }
  return out
}

// The values of a pure literal schema ({const}, {enum}, {type: "null"}), or undefined.
function literalValues(value: unknown): unknown[] | undefined {
  if (isNullSchema(value)) return [null]
  if (typeof value !== "object" || value === null) return undefined
  const { const: constant, enum: values, type, ...rest } = value as Record<string, unknown>
  if (Object.keys(rest).length > 0 || (type !== undefined && typeof type !== "string")) {
    return undefined
  }
  if (constant !== undefined) return [constant]
  return Array.isArray(values) ? values : undefined
}

function isNullSchema(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).type === "null" &&
    Object.keys(value).length === 1
  )
}

function dedupe(issues: readonly SchemaIssue[]): SchemaIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.path}\0${issue.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? ""
}
