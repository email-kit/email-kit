import { RESERVED_KEY } from "@email-kit/core/internal"

import {
  FIELD_NAME,
  type Field,
  type FieldType,
  MARKER_KEY,
  type Property,
  type SchemaIssue,
} from "./model.ts"

type Json = Record<string, unknown>
type Mutable<T> = { -readonly [K in keyof T]: T[K] }
/** Adds an issue at the current path, and gives `undefined` to return. */
type Fail = (message: string) => undefined

/** The kinds `formatted()` can mark. */
const FORMATTED: readonly string[] = ["date", "time", "date-time", "money", "number", "percent"]
const UNION = "Unions aren't portable: use one type, optionally nullable"
/** Keywords that combine schemas in ways the model can't represent, each with its message. */
const COMBINATORS: readonly (readonly [string, string])[] = [
  ["prefixItems", "Tuples (prefixItems) aren't portable: use an object with named fields"],
  ["allOf", "Intersections that don't merge into one object (allOf) aren't portable"],
  ["$ref", "Recursive or shared definitions ($ref) aren't portable"],
  ["$defs", "Recursive or shared definitions ($defs) aren't portable"],
  ["not", 'The JSON Schema keyword "not" isn\'t portable'],
  ["if", "Conditional schemas (if/then/else) aren't portable"],
]
/** Keywords that describe a field without changing which data is valid: any type may have them. */
const ANNOTATIONS = new Set([
  ...["$schema", "$comment", "title", "description", "examples", "deprecated"],
  ...["readOnly", "writeOnly", MARKER_KEY],
])
const BOUNDS = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"]
/** The constraints each type keeps, which fixtures and checks use. */
const CONSTRAINTS: Readonly<Record<FieldType, readonly string[]>> = {
  string: ["minLength", "maxLength", "pattern"],
  number: BOUNDS,
  integer: BOUNDS,
  array: ["minItems", "maxItems"],
  object: [],
  boolean: [],
}
/** The keywords that give each type its shape. Any other keyword isn't portable. */
const STRUCTURE: Readonly<Record<FieldType, readonly string[]>> = {
  string: ["type", "enum", "const", "format"],
  number: ["type"],
  integer: ["type"],
  boolean: ["type"],
  array: ["type", "items"],
  object: [
    ...["type", "properties", "required", "additionalProperties"],
    ...["propertyNames", "patternProperties"],
  ],
}

/**
 * Reads one JSON Schema node into a field, adding an issue for anything outside the model. Nullable
 * is read in each library's spelling: `anyOf` or `oneOf` with `{ type: "null" }`, or
 * `type: [t, "null"]`. A union of literals becomes an enum, as ArkType writes `"a" | "b" | null`.
 * Integer bounds at the safe-integer range are dropped, since Zod adds them to every integer.
 */
export function toField(json: unknown, path: string, issues: SchemaIssue[]): Field | undefined {
  const fail: Fail = (message) => {
    issues.push({ path, message })
    return undefined
  }
  if (!isRecord(json)) return fail("Not a JSON Schema object")
  const union = ["anyOf", "oneOf"].find((key) => Array.isArray(json[key]))
  if (union) return fromUnion(json, union, path, issues)
  for (const [keyword, message] of COMBINATORS) {
    if (keyword in json) return fail(message)
  }
  const shape = readShape(json, fail)
  if (!shape) return undefined
  const { type, nullable, values } = shape
  checkKeywords(json, type, fail)

  const field: Mutable<Field> = { type, nullable }
  if (typeof json.description === "string") field.description = json.description
  if (values) field.enum = values
  if (type === "string" && typeof json.format === "string") field.format = json.format
  const constraints = readConstraints(json, type)
  if (constraints) field.constraints = constraints
  readMarker(json[MARKER_KEY], field, fail)

  if (type === "array") {
    if (json.items === undefined || Array.isArray(json.items)) {
      return fail("Arrays need one item schema (tuples aren't portable)")
    }
    const items = toField(json.items, `${path}[]`, issues)
    if (items) field.items = items
  }
  if (type === "object") {
    if (
      typeof json.additionalProperties === "object" ||
      "propertyNames" in json ||
      "patternProperties" in json
    ) {
      fail("Maps with dynamic keys (records) aren't portable: list the keys as properties")
    }
    field.properties = readProperties(json, path, issues)
  }
  return field
}

/**
 * An `anyOf` or `oneOf`. Only two kinds are portable: all literals, which become an enum, and one
 * schema or `null`, which becomes that field, nullable. Keywords beside the union, such as a
 * description, apply to the result.
 */
function fromUnion(
  schema: Json,
  key: string,
  path: string,
  issues: SchemaIssue[],
): Field | undefined {
  const { [key]: options, ...outer } = schema
  const choices = options as unknown[]
  const literals = choices.map(literalValues)
  if (literals.every((values) => values !== undefined)) {
    return toField({ ...outer, enum: literals.flat() }, path, issues)
  }
  const rest = choices.filter((choice) => !isNullSchema(choice))
  if (rest.length !== 1 || rest.length === choices.length) {
    issues.push({ path, message: UNION })
    return undefined
  }
  const inner = toField({ ...(rest[0] as object), ...outer }, path, issues)
  return inner && { ...inner, nullable: true }
}

/**
 * The field's type, whether it's nullable, and its allowed values. `type: [t, "null"]`, and `null`
 * among the enum or const values, both mean nullable. Values without a type are a string enum.
 */
function readShape(
  schema: Json,
  fail: Fail,
): { type: FieldType; nullable: boolean; values?: string[] } | undefined {
  let nullable = false
  let type = schema.type
  if (Array.isArray(type)) {
    nullable = type.includes("null")
    const rest = type.filter((t) => t !== "null")
    if (rest.length !== 1) return fail(UNION)
    type = rest[0]
  }
  let values = Array.isArray(schema.enum)
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
  return { type: type as FieldType, nullable, ...(values && { values: values as string[] }) }
}

/**
 * Fails on `default`, since every runtime must receive the same data, and on any keyword the type
 * doesn't allow.
 */
function checkKeywords(schema: Json, type: FieldType, fail: Fail): void {
  if ("default" in schema) {
    fail(
      "Default values aren't portable: the backend sends every value (other runtimes can't fill it)",
    )
  }
  for (const key of Object.keys(schema)) {
    if (key === "default" || ANNOTATIONS.has(key)) continue
    if (STRUCTURE[type].includes(key) || CONSTRAINTS[type].includes(key)) continue
    fail(`The JSON Schema keyword "${key}" isn't portable`)
  }
}

/** The type's constraints that the schema sets, sorted by name, or `undefined` when none are. */
function readConstraints(
  schema: Json,
  type: FieldType,
): Record<string, number | string> | undefined {
  const constraints: Record<string, number | string> = {}
  for (const key of [...CONSTRAINTS[type]].sort()) {
    const value = schema[key]
    if (typeof value !== "number" && typeof value !== "string") continue
    if (type === "integer" && Math.abs(Number(value)) === Number.MAX_SAFE_INTEGER) continue
    constraints[key] = value
  }
  return Object.keys(constraints).length > 0 ? constraints : undefined
}

/**
 * Reads the `x-email-kit` marker that `secret`, `url` and `formatted()` add, onto the field. `url`
 * and `formatted` are for string fields only.
 */
function readMarker(marker: unknown, field: Mutable<Field>, fail: Fail): void {
  if (marker === undefined) return
  const { secret, url, formatted, ...unknown } = isRecord(marker) ? marker : {}
  if (!isRecord(marker) || Object.keys(unknown).length > 0) {
    fail(`Unknown ${MARKER_KEY} marker ${JSON.stringify(marker)}`)
  }
  if (secret === true) field.secret = true
  if (url === true) {
    if (field.type !== "string") fail("Only string fields can be url fields")
    field.url = true
  }
  if (formatted !== undefined) {
    if (field.type !== "string") {
      fail("Only string fields can be formatted: the backend formats them as text")
    }
    if (typeof formatted !== "string" || !FORMATTED.includes(formatted)) {
      fail(`formatted must be one of ${FORMATTED.join(", ")}`)
    }
    field.formatted = formatted as string
  }
}

/**
 * An object's properties, in schema order. A name must be usable in every language and as a
 * mustache-core tag, and `_ek` is reserved for the values email-kit adds at send time.
 */
function readProperties(schema: Json, path: string, issues: SchemaIssue[]): Property[] {
  const properties = isRecord(schema.properties) ? schema.properties : {}
  const required = new Set(Array.isArray(schema.required) ? schema.required : [])
  return Object.entries(properties).flatMap(([name, value]) => {
    const childPath = path ? `${path}.${name}` : name
    if (!FIELD_NAME.test(name)) {
      issues.push({
        path: childPath,
        message: `The field name "${name}" isn't portable: use letters, digits and _`,
      })
      return []
    }
    if (name === RESERVED_KEY) {
      issues.push({
        path: childPath,
        message: `The field name "${RESERVED_KEY}" is reserved for values email-kit adds at send time`,
      })
      return []
    }
    const child = toField(value, childPath, issues)
    return child ? [{ name, required: required.has(name), field: child }] : []
  })
}

/** The values of a literal-only schema (`const`, `enum` or `type: "null"`), or `undefined`. */
function literalValues(value: unknown): unknown[] | undefined {
  if (isNullSchema(value)) return [null]
  if (!isRecord(value)) return undefined
  const { const: constant, enum: values, type, ...rest } = value
  if (Object.keys(rest).length > 0 || (type !== undefined && typeof type !== "string")) {
    return undefined
  }
  if (constant !== undefined) return [constant]
  return Array.isArray(values) ? values : undefined
}

/** Whether a schema is exactly `{ type: "null" }`. */
function isNullSchema(value: unknown): boolean {
  return isRecord(value) && value.type === "null" && Object.keys(value).length === 1
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
