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

/** The runtime shape: which keys exist and which are optional (the module runtime's `Shape`). */
export type Shape =
  | "scalar"
  | { readonly list: Shape }
  | { readonly fields: Readonly<Record<string, Shape>>; readonly optional: readonly string[] }

export function shapeOf(field: Field): Shape {
  if (field.type === "array") return { list: shapeOf(field.items as Field) }
  if (field.type !== "object") return "scalar"
  const properties = field.properties ?? []
  return {
    fields: Object.fromEntries(properties.map((p) => [p.name, shapeOf(p.field)])),
    optional: properties.filter((p) => !p.required).map((p) => p.name),
  }
}

function comment(text: string): string {
  return text.replace(/\*\//g, "*\\/").replace(/\s*\n\s*/g, " ")
}
