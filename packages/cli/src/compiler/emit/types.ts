// The portable field model (P0-10) → TypeScript types and the runtime shape used for projection.

import type { Field } from "../schema.ts"

/** Writes `export interface <name> { … }` for a template's root object. */
export function dataInterface(name: string, root: Field, description: string): string {
  return `/** ${description} */\nexport interface ${name} ${objectType(root, "")}\n`
}

function objectType(field: Field, indent: string): string {
  const properties = field.properties ?? []
  if (properties.length === 0) return "{}"
  const inner = `${indent}  `
  const lines = properties.map((property) => {
    const docs = property.field.description
      ? `${inner}/** ${comment(property.field.description)} */\n`
      : ""
    const optional = property.required ? "" : "?"
    const type = typeOf(property.field, inner)
    // `| undefined` so callers under exactOptionalPropertyTypes may pass an explicit undefined.
    return `${docs}${inner}${property.name}${optional}: ${type}${property.required ? "" : " | undefined"}`
  })
  return `{\n${lines.join("\n")}\n${indent}}`
}

function typeOf(field: Field, indent: string): string {
  let type: string
  switch (field.type) {
    case "string":
      type = field.enum ? field.enum.map((value) => JSON.stringify(value)).join(" | ") : "string"
      break
    case "number":
    case "integer":
      type = "number"
      break
    case "boolean":
      type = "boolean"
      break
    case "array": {
      const items = typeOf(field.items as Field, indent)
      type = `readonly ${/[|&]/.test(items) && !items.startsWith("{") ? `(${items})` : items}[]`
      break
    }
    case "object":
      type = objectType(field, indent)
      break
  }
  return field.nullable ? `${type} | null` : type
}

/** The runtime model (the module runtime's `Model`): types, required keys and constraints. */
export interface Model {
  readonly type: Field["type"]
  readonly nullable?: true
  readonly enum?: readonly string[]
  readonly constraints?: Readonly<Record<string, number | string>>
  readonly url?: true
  readonly items?: Model
  readonly properties?: Readonly<Record<string, Model>>
  readonly required?: readonly string[]
}

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

function comment(text: string): string {
  return text.replace(/\*\//g, "*\\/").replace(/\s*\n\s*/g, " ")
}
