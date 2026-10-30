// The intermediate tree (IR) that templates evaluate to at compile time (JSX-01, JSX-04).
// Prototype (P0-03): MSO conditionals and html-only / text-only branches arrive with P1-033.

export type IrNode = IrElement | IrText | IrPlaceholder | IrSection | IrFragment

export interface IrElement {
  readonly kind: "element"
  readonly tag: string
  /** Attribute values in source order. An empty list is a boolean attribute. */
  readonly attrs: Readonly<Record<string, IrAttr>>
  readonly children: readonly IrNode[]
}

/** An attribute value: static strings and placeholders, concatenated. */
export type IrAttr = readonly (string | IrPlaceholder)[]

export interface IrText {
  readonly kind: "text"
  readonly value: string
}

/** A data field filled in at send time: `{{path}}`. */
export interface IrPlaceholder {
  readonly kind: "placeholder"
  /** Name segments; empty for the current item (`{{.}}`). */
  readonly path: readonly string[]
  /** The scope the path is relative to: 0 for `data`, or the section that introduced the item. */
  readonly scope: number
}

/** `{{#path}}…{{/path}}`, or `{{^path}}…{{/path}}` when inverted. */
export interface IrSection {
  readonly kind: "section"
  readonly inverted: boolean
  readonly path: readonly string[]
  readonly scope: number
  /** The scope this section opens for its children. */
  readonly opens: number
  readonly children: readonly IrNode[]
}

export interface IrFragment {
  readonly kind: "fragment"
  readonly children: readonly IrNode[]
}

const KINDS = new Set(["element", "text", "placeholder", "section", "fragment"])

export function isIrNode(value: unknown): value is IrNode {
  return typeof value === "object" && value !== null && KINDS.has((value as IrNode).kind)
}
