// email-kit's own JSX runtime (JSX-01), used through `/** @jsxImportSource @email-kit/core */`.
// Components run once at compile time; the result is an IR tree, not a virtual DOM.

import { EmailKitError } from "./errors.ts"
import { type IrAttr, type IrNode, isIrNode } from "./ir.ts"
import { describePath, type Placeholder, placeholderInfo, toIrPlaceholder } from "./placeholder.ts"

/** Anything a template can render. `false`, `null` and `undefined` render nothing. */
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

export type AttrValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Placeholder<string>
  | Placeholder<number>
  | IrNode

export type StyleValue = Readonly<Record<string, string | number>>

export interface IntrinsicProps {
  readonly children?: Child
  readonly style?: string | StyleValue
  readonly [attribute: string]: AttrValue | Child | StyleValue
}

// biome-ignore lint/suspicious/noExplicitAny: component props are checked by TypeScript at the call site
type Component = (props: any) => Child

export declare namespace JSX {
  type Element = IrNode
  type ElementType = string | Component
  interface ElementChildrenAttribute {
    // biome-ignore lint/complexity/noBannedTypes: the shape TypeScript expects here
    children: {}
  }
  interface IntrinsicElements {
    [tag: string]: IntrinsicProps
  }
}

export function jsx(type: string | Component, props: Readonly<Record<string, unknown>>): IrNode {
  if (typeof type === "function") return fragment(type(props))
  const { children, ...attributes } = props
  return {
    kind: "element",
    tag: type,
    attrs: toAttrs(type, attributes),
    children: toNodes(children),
  }
}

export const jsxs: typeof jsx = jsx

export function Fragment(props: { readonly children?: Child }): IrNode {
  return fragment(props.children)
}

/** Normalises any child into one IR node. */
export function fragment(child: unknown): IrNode {
  const children = toNodes(child)
  return children.length === 1 && children[0] ? children[0] : { kind: "fragment", children }
}

export function toNodes(child: unknown, out: IrNode[] = []): IrNode[] {
  if (child === null || child === undefined || typeof child === "boolean") return out
  const info = placeholderInfo(child)
  if (info) {
    out.push(toIrPlaceholder(info))
  } else if (Array.isArray(child)) {
    for (const item of child) toNodes(item, out)
  } else if (typeof child === "string") {
    if (child !== "") out.push({ kind: "text", value: child })
  } else if (typeof child === "number") {
    out.push({ kind: "text", value: String(child) })
  } else if (isIrNode(child)) {
    out.push(child)
  } else if (typeof child === "function") {
    throw new EmailKitError(
      "function-child",
      "A function was rendered as a child. Only <Each> and <If> take a function as children.",
    )
  } else {
    throw new EmailKitError("invalid-child", `Can't render a child of type ${typeof child}`)
  }
  return out
}

function toAttrs(
  tag: string,
  attributes: Readonly<Record<string, unknown>>,
): Record<string, IrAttr> {
  const attrs: Record<string, IrAttr> = {}
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue
    if (name === "style" && typeof value === "object" && !isIrNode(value)) {
      attrs[name] = [styleText(tag, value as StyleValue)]
    } else {
      attrs[name] = attrParts(tag, name, value)
    }
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

function styleText(tag: string, style: StyleValue): string {
  return Object.entries(style)
    .map(([property, value]) => {
      const info = placeholderInfo(value)
      if (info) {
        throw new EmailKitError(
          "data-dependent-style",
          `<${tag} style> uses the placeholder ${describePath(info.path)}. Styles are fixed at ` +
            "compile time; choose between styles with <If> instead.",
        )
      }
      return `${property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`
    })
    .join(";")
}
