import { isObject } from "../index.ts"
import type { Model } from "./types.ts"

// --- inlined into generated modules from here ---

/** The flag name for a select value, safe in a tag: `"pro-plan"` → `v_pro_2d_plan`. */
export function selectKey(value: string): string {
  return `v_${value.replace(/[^A-Za-z0-9]/gu, (c) => `_${(c.codePointAt(0) as number).toString(16)}_`)}`
}

type Tree = Record<string, unknown>
/** The data key that holds the flags, and the sender values passed at send time. */
export const EK = "_ek"

/**
 * Adds the plural and select flags that compiled messages test, under `_ek` on each object in the
 * data: `{ plural: { count: { one: true, exact_1: true } }, select: { plan: { v_pro: true } } }`.
 * Flags from outer objects are copied in, so a list item can test a field of its parent.
 */
export function prepare(
  model: Model,
  value: unknown,
  category: (n: number) => string,
  inherited: { readonly plural: Tree; readonly select: Tree } = { plural: {}, select: {} },
): void {
  if (model.type === "array") {
    if (Array.isArray(value))
      for (const item of value) prepare(model.items as Model, item, category, inherited)
    return
  }
  if (model.type !== "object" || !isObject(value)) return
  const plural: Tree = { ...inherited.plural }
  const select: Tree = { ...inherited.select }
  collect(model, value, plural, select, category)
  if (Object.keys(plural).length > 0 || Object.keys(select).length > 0)
    value[EK] = { plural, select }
  const properties = model.properties ?? {}
  for (const key of Object.keys(properties)) {
    prepare(properties[key] as Model, value[key], category, { plural, select })
  }
}

function collect(
  model: Model,
  value: Record<string, unknown>,
  plural: Tree,
  select: Tree,
  category: (n: number) => string,
): void {
  const properties = model.properties ?? {}
  for (const key of Object.keys(properties)) {
    const field = properties[key] as Model
    const v = value[key]
    if (
      (field.type === "number" || field.type === "integer") &&
      typeof v === "number" &&
      Number.isFinite(v)
    ) {
      const entry: Tree = { [category(v)]: true }
      if (Number.isSafeInteger(v) && v >= 0) entry[`exact_${v}`] = true
      plural[key] = entry
    } else if (field.type === "string" && field.enum && typeof v === "string") {
      select[key] = { [selectKey(v)]: true }
    } else if (field.type === "object" && isObject(v)) {
      const p: Tree = isObject(plural[key]) ? { ...(plural[key] as Tree) } : {}
      const s: Tree = isObject(select[key]) ? { ...(select[key] as Tree) } : {}
      collect(field, v, p, s, category)
      plural[key] = p
      select[key] = s
    }
  }
}
