import type { Field } from "../schema/index.ts"

/** Writes `export interface <name> { … }` for a template's root object. */
export function dataInterface(name: string, root: Field, description: string): string {
  return `/** ${docText(description)} */\nexport interface ${name} ${objectType(root, "")}\n`
}

/**
 * The runtime model `render()` and `validate()` check data against, written into the module as
 * JSON: each field's type, required keys and constraints. Descriptions and markers other than
 * `url` aren't needed at send time, so they're left out.
 */
export interface Model {
  readonly type: Field["type"]
  readonly nullable?: true
  readonly enum?: readonly string[]
  readonly constraints?: Readonly<Record<string, number | string>>
  /** The value must be an `https://` URL. */
  readonly url?: true
  readonly items?: Model
  readonly properties?: Readonly<Record<string, Model>>
  readonly required?: readonly string[]
}

/** A field as the runtime model. */
export function modelOf(field: Field): Model {
  const required = (field.properties ?? []).filter((p) => p.required).map((p) => p.name)
  return {
    type: field.type,
    ...(field.nullable && { nullable: true }),
    ...(field.enum && { enum: field.enum }),
    ...(field.constraints && { constraints: field.constraints }),
    ...(field.url && { url: true }),
    ...(field.items && { items: modelOf(field.items) }),
    ...(field.properties && {
      properties: Object.fromEntries(field.properties.map((p) => [p.name, modelOf(p.field)])),
    }),
    ...(required.length > 0 && { required }),
  }
}

/**
 * Text for a `/** … *\/` comment: on one line, and with `*\/` broken up so the text can't end the
 * comment early.
 */
export function docText(text: string): string {
  return text.replace(/\*\//g, "*\\/").replace(/\s*\n\s*/g, " ")
}

/** How to format each kind of caller-formatted field, written into its doc for the backend. */
const FORMATTED: Readonly<Record<string, string>> = {
  date: "A date, formatted for the recipient: Intl.DateTimeFormat(locale, { dateStyle, timeZone }).",
  time: "A time, formatted for the recipient: Intl.DateTimeFormat(locale, { timeStyle, timeZone }).",
  "date-time":
    "A date and time, formatted for the recipient with their time zone: Intl.DateTimeFormat(locale, { dateStyle, timeStyle, timeZone }).",
  money:
    'An amount, formatted for the recipient: Intl.NumberFormat(locale, { style: "currency", currency }).',
  number: "A number, formatted for the recipient: Intl.NumberFormat(locale).",
  percent:
    'A percentage, formatted for the recipient: Intl.NumberFormat(locale, { style: "percent" }).',
}

/**
 * An object type, each property with its description and formatting note as its doc. An optional
 * property also accepts `undefined`, so callers under `exactOptionalPropertyTypes` can pass one.
 */
function objectType(field: Field, indent: string): string {
  const properties = field.properties ?? []
  if (properties.length === 0) return "{}"
  const inner = `${indent}  `
  const lines = properties.map(({ name, required, field: property }) => {
    const notes = [property.description, property.formatted && FORMATTED[property.formatted]]
    const doc = notes.filter(Boolean).join(" ")
    const docs = doc ? `${inner}/** ${docText(doc)} */\n` : ""
    const type = typeOf(property, inner)
    return required
      ? `${docs}${inner}${name}: ${type}`
      : `${docs}${inner}${name}?: ${type} | undefined`
  })
  return `{\n${lines.join("\n")}\n${indent}}`
}

/** A field's TypeScript type, with `| null` when it's nullable. */
function typeOf(field: Field, indent: string): string {
  const type = baseType(field, indent)
  return field.nullable ? `${type} | null` : type
}

function baseType(field: Field, indent: string): string {
  switch (field.type) {
    case "string":
      return field.enum ? field.enum.map((value) => JSON.stringify(value)).join(" | ") : "string"
    case "number":
    case "integer":
      return "number"
    case "boolean":
      return "boolean"
    case "array": {
      const items = field.items as Field
      const type = typeOf(items, indent)
      return `readonly ${isUnion(items) ? `(${type})` : type}[]`
    }
    case "object":
      return objectType(field, indent)
  }
}

/**
 * Whether a field's type is written as a union, so it needs parentheses as an array's item type:
 * `readonly (string | null)[]`, not `readonly string | null[]`.
 */
function isUnion(field: Field): boolean {
  return field.nullable || (field.type === "string" && (field.enum?.length ?? 0) > 1)
}
