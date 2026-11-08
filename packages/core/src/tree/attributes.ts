// Turns JSX props into IR attributes: strings, placeholders, messages and inline styles with theme colours.

import {
  describePath,
  type Placeholder,
  placeholderInfo,
  toIrPlaceholder,
} from "../data/placeholder.ts"
import { EmailKitError } from "../shared/errors.ts"
import { useTheme } from "../theme/context.ts"
import { type RoleColour, roleClass, roleOf } from "../theme/role.ts"
import { type IrAttr, type IrNode, isIrNode } from "./ir.ts"
import { toNodes } from "./nodes.ts"

export type AttrValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Placeholder<string>
  | Placeholder<number>
  | IrNode

export type StyleValue = Readonly<Record<string, string | number | RoleColour>>

export function toAttrs(
  tag: string,
  attributes: Readonly<Record<string, unknown>>,
): Record<string, IrAttr> {
  const attrs: Record<string, IrAttr> = {}
  const roleClasses: string[] = []
  
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue
    
    if (name === "style" && typeof value === "object" && !isIrNode(value)) {
      const { css, classes } = styleText(tag, value as StyleValue)
      attrs[name] = [css]
      roleClasses.push(...classes)
    } else {
      attrs[name] = attrParts(tag, name, value)
    }
  }
  
  if (roleClasses.length > 0) {
    const own = attrs.class ?? []
    attrs.class = [...own, ...(own.length > 0 ? [" "] : []), roleClasses.join(" ")]
  }
  return attrs
}

function attrParts(tag: string, name: string, value: unknown): IrAttr {
  if (value === true) return []
  if (typeof value === "string") return [value]
  if (typeof value === "number") return [String(value)]
  
  const info = placeholderInfo(value)
  if (info) return [toIrPlaceholder(info)]
  if (isIrNode(value)) {
    // A translated message used as an attribute (alt, title): text and placeholders only.
    return toNodes(value).flatMap((node) => {
      const parts = node.kind === "fragment" ? node.children : [node]
      return parts.map((part) => {
        if (part.kind === "text") return part.value
        if (part.kind === "placeholder") return part
        throw new EmailKitError(
          "invalid-attribute",
          `<${tag} ${name}> can only hold text and placeholders, not <${part.kind}>`,
        )
      })
    })
  }

  throw new EmailKitError("invalid-attribute", `<${tag} ${name}> can't be a ${typeof value}`)
}

function styleText(tag: string, style: StyleValue): { css: string; classes: string[] } {
  const classes: string[] = []
  const css = Object.entries(style)
    .map(([key, value]) => {
      const info = placeholderInfo(value)
      if (info) {
        throw new EmailKitError(
          "data-dependent-style",
          `<${tag} style> uses the placeholder ${describePath(info.path)}. Styles are fixed at ` +
            "compile time; choose between styles with <If> instead.",
        )
      }
      const property = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
      const name = roleOf(value)
      if (name) {
        classes.push(roleClass(property, name))
        return `${property}:${useTheme().roles[name]}`
      }
      return `${property}:${value as string | number}`
    }).join(";")
    
  return { css, classes }
}
