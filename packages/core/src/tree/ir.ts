/**
 * What templates are made of: a tree that email-kit turns into the email's HTML and text parts.
 * JSX elements, `t()` messages and `<Each>` all give one.
 */
export type IrNode = IrElement | IrText | IrPlaceholder | IrSection | IrFragment | IrConditional

/** An HTML element. */
export interface IrElement {
  readonly kind: "element"
  readonly tag: string
  readonly attrs: Readonly<Record<string, IrAttr>>
  readonly children: readonly IrNode[]
}

/** An attribute's value: pieces of text and placeholders, written one after another. */
export type IrAttr = readonly (string | IrPlaceholder)[]

/** Literal text, escaped when it's written out. */
export interface IrText {
  readonly kind: "text"
  readonly value: string
}

/** A data value, filled in when the email is rendered: `{{path}}`. */
export interface IrPlaceholder {
  readonly kind: "placeholder"
  /** The field's path, such as `["order", "total"]`. Empty for a list item itself: `{{.}}`. */
  readonly path: readonly string[]
  /** The context the path is read in: `0` for `data`, or the `opens` of an enclosing section. */
  readonly scope: number
}

/**
 * Content shown once for each item of a list, or once when a value is truthy: `{{#path}}`. With
 * `inverted`, shown only when the value is falsy or an empty list: `{{^path}}`.
 */
export interface IrSection {
  readonly kind: "section"
  readonly inverted: boolean
  readonly path: readonly string[]
  /** The context `path` is read in, as for a placeholder. */
  readonly scope: number
  /** A new number for the context its children read in: the list item or the tested value. */
  readonly opens: number
  /**
   * The control component that made it. Plural and select sections from messages have none. The
   * compiler checks an `If` against the schema: a section over a list repeats, so an `If` on a
   * list would show its content once per item.
   */
  readonly component?: "If" | "Unless" | "Each"
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

/** Children without an element around them. */
export interface IrFragment {
  readonly kind: "fragment"
  readonly children: readonly IrNode[]
}

const KINDS = new Set(["element", "text", "placeholder", "section", "fragment", "conditional"])

/** Whether a value is an IR node. */
export function isIrNode(value: unknown): value is IrNode {
  return typeof value === "object" && value !== null && KINDS.has((value as IrNode).kind)
}
