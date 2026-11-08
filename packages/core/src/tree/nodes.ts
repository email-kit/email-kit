// Normalises anything a template renders into IR nodes.

import { type Placeholder, placeholderInfo, toIrPlaceholder } from "../data/placeholder.ts"
import { EmailKitError } from "../shared/errors.ts"
import { type IrNode, isIrNode } from "./ir.ts"

export type Child =
  | IrNode
  | string
  | number
  | boolean
  | null
  | undefined
  | Placeholder<string>
  | Placeholder<number>
  | readonly Child[]

export function fragment(child: unknown): IrNode {
  const children = toNodes(child)
  return children.length === 1 && children[0] ? children[0] : { kind: "fragment", children }
}

export function toNodes(child: unknown, out: IrNode[] = []): IrNode[] {
  switch (typeof child) {
    case "string":
      if (child !== "") out.push({ kind: "text", value: child })
      return out

    case "number":
      out.push({ kind: "text", value: String(child) })
      return out

    case "boolean":
    case "undefined":
      return out

    case "object":
    case "function": {
      if (child === null) return out

      const info = placeholderInfo(child)
      if (info) {
        out.push(toIrPlaceholder(info))
        return out
      }

      if (typeof child === "function") {
        throw new EmailKitError(
          "function-child",
          "A function was rendered as a child. Only <Each> and <If> take a function as children.",
        )
      }

      if (Array.isArray(child)) {
        for (const item of child) toNodes(item, out)
        return out
      }

      if (isIrNode(child)) {
        out.push(child)
        return out
      }
      break
    }
  }

  throw new EmailKitError("invalid-child", `Can't render a child of type ${typeof child}`)
}