// Checks the plural and select sections a message made (ADR 0003) against the schema: a plural
// needs a number field, a select a field with fixed values that include every case. The
// generated module prepares `_ek.plural` / `_ek.select` from those same field types.

import { EmailKitError, type IrNode, RESERVED_KEY } from "@email-kit/core/internal"

import type { Field } from "./schema.ts"

/** The select case a section key stands for: selectKey() in reverse. */
export function selectValue(key: string): string {
  return key
    .slice(2)
    .replace(/_([0-9a-f]+)_/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
}

function lookup(field: Field | undefined, path: readonly string[]): Field | undefined {
  let current = field
  for (const name of path) {
    current = current?.properties?.find((p) => p.name === name)?.field
  }
  return current
}

export function checkDerived(nodes: readonly IrNode[], model: Field, where: string): void {
  // The schema field each scope stands for: a list's item, or the field an <If> tests.
  const scopes = new Map<number, Field | undefined>([[0, model]])
  const visit = (node: IrNode) => {
    if (node.kind === "fragment" || node.kind === "element" || node.kind === "conditional") {
      for (const child of node.children) visit(child)
      return
    }
    if (node.kind !== "section") return
    const base = scopes.get(node.scope)
    if (node.path[0] === RESERVED_KEY && (node.path[1] === "plural" || node.path[1] === "select")) {
      const path = node.path.slice(2, -1)
      const key = node.path.at(-1) as string
      const field = lookup(base, path)
      const name = path.join(".")
      if (node.path[1] === "plural" && field?.type !== "number" && field?.type !== "integer") {
        throw new EmailKitError(
          "invalid-plural",
          `${where}: {${name}, plural} needs a number field, but "${name}" is ${field ? `a ${field.type}` : "not in the schema"}`,
        )
      }
      if (node.path[1] === "select") {
        if (field?.type !== "string" || !field.enum) {
          throw new EmailKitError(
            "invalid-select",
            `${where}: {${name}, select} needs a field with fixed values, such as z.enum([…]); "${name}" is ${field ? `a free ${field.type}` : "not in the schema"}`,
          )
        }
        const value = selectValue(key)
        if (!field.enum.includes(value)) {
          throw new EmailKitError(
            "invalid-select",
            `${where}: {${name}, select} has the case "${value}", which isn't one of its values (${field.enum.join(", ")})`,
          )
        }
      }
      scopes.set(node.opens, base)
    } else {
      const field = lookup(base, node.path)
      scopes.set(node.opens, field?.type === "array" ? field.items : field)
    }
    for (const child of node.children) visit(child)
  }
  for (const node of nodes) visit(node)
}
