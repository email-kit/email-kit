export type IrNode = IrElement | IrText | IrPlaceholder | IrSection | IrFragment | IrConditional

export interface IrElement {
  readonly kind: "element"
  readonly tag: string
  readonly attrs: Readonly<Record<string, IrAttr>>
  readonly children: readonly IrNode[]
}

export type IrAttr = readonly (string | IrPlaceholder)[]

export interface IrText {
  readonly kind: "text"
  readonly value: string
}

export interface IrPlaceholder {
  readonly kind: "placeholder"
  readonly path: readonly string[]
  readonly scope: number
}
export interface IrSection {
  readonly kind: "section"
  readonly inverted: boolean
  readonly path: readonly string[]
  readonly scope: number
  readonly opens: number
  readonly children: readonly IrNode[]
}

/**
 * Content for some renderers only: `mso` for Outlook's Word engine, `notMso` for every
 * other client, `htmlOnly` for the HTML part, `textOnly` for the plain-text part.
 */
export interface IrConditional {
  readonly kind: "conditional"
  readonly when: "mso" | "notMso" | "htmlOnly" | "textOnly"
  readonly children: readonly IrNode[]
}

export interface IrFragment {
  readonly kind: "fragment"
  readonly children: readonly IrNode[]
}

const KINDS = new Set(["element", "text", "placeholder", "section", "fragment", "conditional"])

export function isIrNode(value: unknown): value is IrNode {
  return typeof value === "object" && value !== null && KINDS.has((value as IrNode).kind)
}
