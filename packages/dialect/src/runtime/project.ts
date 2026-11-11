import { isObject } from "../index.ts"
import { has } from "./shared.ts"
import type { Model } from "./types.ts"

// --- inlined into generated modules from here ---

/**
 * A copy of the data with only the fields the schema has, and `null` for missing optional fields,
 * so a tag never finds a same-named field of an outer object instead.
 */
export function project(model: Model, value: unknown): unknown {
  if (model.type === "array") {
    return Array.isArray(value) ? value.map((item) => project(model.items as Model, item)) : value
  }
  if (model.type !== "object" || !isObject(value)) return value
  const out: Record<string, unknown> = {}
  const required = model.required ?? []
  const properties = model.properties ?? {}
  for (const key of Object.keys(properties)) {
    if (has(value, key)) {
      out[key] = project(properties[key] as Model, value[key])
    } else if (required.indexOf(key) === -1) {
      out[key] = null
    }
  }
  return out
}
