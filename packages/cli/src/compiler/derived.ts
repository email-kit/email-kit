import { EmailKitError, type IrNode, type IrSection, RESERVED_KEY } from "@email-kit/core/internal"

import type { Field } from "./schema/index.ts"

/**
 * Checks sections against the schema. A plural needs a number field, and a select needs a field
 * with fixed values that include every case: the generated module sets the `_ek.plural` and
 * `_ek.select` flags from those fields, so a mismatch would render the wrong case. An `<If>` can't
 * test a list, since a section over a list repeats its content per item. `where` names the
 * template and locale in errors.
 */
export function checkDerived(nodes: readonly IrNode[], model: Field, where: string): void {
  const scopes = new Map<number, Field | undefined>([[0, model]])
  const visit = (node: IrNode): void => {
    if (node.kind === "text" || node.kind === "placeholder") return
    if (node.kind === "section") {
      scopes.set(node.opens, checkSection(node, scopes.get(node.scope), where))
    }
    for (const child of node.children) visit(child)
  }
  for (const node of nodes) visit(node)
}

/**
 * The select case a section key stands for, such as `pro-plus` for `v_pro_2d_plus`: core's
 * `selectKey()` in reverse.
 */
export function selectValue(key: string): string {
  return key
    .slice(2)
    .replace(/_([0-9a-f]+)_/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
}

/**
 * Checks a plural or select flag against its field, and gives the field the section's children
 * read in. A flag such as `_ek.plural.count.one` is only a true or false, so its children read in
 * the same field as the section. A list's children read in its item, and an `<If>`'s in the
 * field it tests.
 */
function checkSection(node: IrSection, base: Field | undefined, where: string): Field | undefined {
  const [root, flag, ...rest] = node.path
  if (root !== RESERVED_KEY || (flag !== "plural" && flag !== "select")) {
    const field = lookup(base, node.path)
    if (node.component === "If" && field?.type === "array") {
      const name = node.path.join(".")
      throw new EmailKitError(
        "list-condition",
        `${where}: <If> tests the list "${name}", so it would show its content once per item. ` +
          "Use <Each> for the items (it shows nothing for an empty or missing list) and <Unless> " +
          "for the empty case. For content around the items, such as a heading, wrap the list in " +
          "an optional object or pass a boolean field.",
      )
    }
    return field?.type === "array" ? field.items : field
  }
  const path = rest.slice(0, -1)
  const field = lookup(base, path)
  const name = path.join(".")
  if (flag === "plural") checkPlural(field, name, where)
  else checkSelect(field, name, selectValue(rest.at(-1) as string), where)
  return base
}

/** A plural needs a number field, to pick its category from. */
function checkPlural(field: Field | undefined, name: string, where: string): void {
  if (field?.type === "number" || field?.type === "integer") return
  throw new EmailKitError(
    "invalid-plural",
    `${where}: {${name}, plural} needs a number field, but "${name}" is ${field ? `a ${field.type}` : "not in the schema"}`,
  )
}

/** A select needs a field with fixed values, and each of its cases must be one of them. */
function checkSelect(field: Field | undefined, name: string, value: string, where: string): void {
  if (field?.type !== "string" || !field.enum) {
    throw new EmailKitError(
      "invalid-select",
      `${where}: {${name}, select} needs a field with fixed values, such as z.enum([…]); "${name}" is ${field ? `a free ${field.type}` : "not in the schema"}`,
    )
  }
  if (!field.enum.includes(value)) {
    throw new EmailKitError(
      "invalid-select",
      `${where}: {${name}, select} has the case "${value}", which isn't one of its values (${field.enum.join(", ")})`,
    )
  }
}

/** The field at `path` inside `field`, or `undefined` when the schema has no such field. */
function lookup(field: Field | undefined, path: readonly string[]): Field | undefined {
  let current = field
  for (const name of path) {
    current = current?.properties?.find((p) => p.name === name)?.field
  }
  return current
}
