import { type Field, MARKER_KEY } from "./model.ts"

/**
 * A field as canonical JSON Schema: always written the same way, whichever library the schema
 * came from. Nullable is `type: [t, "null"]`, keys come in a fixed order, and `required` is left
 * out when nothing is required.
 */
export function emitJsonSchema(field: Field): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (field.description !== undefined) out.description = field.description
  out.type = field.nullable ? [field.type, "null"] : field.type
  if (field.enum) out.enum = field.nullable ? [...field.enum, null] : field.enum
  if (field.format !== undefined) out.format = field.format
  Object.assign(out, field.constraints)
  if (field.items) out.items = emitJsonSchema(field.items)
  if (field.properties) {
    out.properties = Object.fromEntries(
      field.properties.map((p) => [p.name, emitJsonSchema(p.field)]),
    )
    const required = field.properties.filter((p) => p.required).map((p) => p.name)
    if (required.length > 0) out.required = required
  }
  if (field.secret || field.url || field.formatted) {
    out[MARKER_KEY] = {
      ...(field.secret && { secret: true }),
      ...(field.url && { url: true }),
      ...(field.formatted && { formatted: field.formatted }),
    }
  }
  return out
}
