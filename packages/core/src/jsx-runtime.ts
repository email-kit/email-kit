/**
 * email-kit's JSX runtime. TypeScript and bundlers import it on their own when `jsxImportSource`
 * is `@email-kit/core`; templates don't import it.
 *
 * @packageDocumentation
 */

import { type AttrValue, type StyleValue, toAttrs } from "./tree/attributes.ts"
import type { IrNode } from "./tree/ir.ts"
import { type Child, fragment, toNodes } from "./tree/nodes.ts"

export type { AttrValue, Child, StyleValue }

/** The props of an HTML element in a template: its attributes, `style` and `children`. */
export interface IntrinsicProps {
  readonly children?: Child
  readonly style?: string | StyleValue
  readonly [attribute: string]: AttrValue | Child | StyleValue
}

// biome-ignore lint/suspicious/noExplicitAny: component props are checked by TypeScript at the call site
type Component = (props: any) => Child

/** The JSX types for templates: every element is an `IrNode`, and any HTML tag is allowed. */
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

/**
 * Turns one JSX element into IR: a component is called with its props, and an HTML tag becomes an
 * element. Compiled JSX calls it.
 */
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

/** The same as `jsx()`. Compiled JSX calls it for elements with several children. */
export const jsxs: typeof jsx = jsx

/**
 * Groups children without adding an element around them. Usually written as `<>…</>`.
 *
 * @example
 * ```tsx
 * <>
 *   <h1>Hello</h1>
 *   <p>Welcome aboard.</p>
 * </>
 * ```
 */
export function Fragment(props: { readonly children?: Child }): IrNode {
  return fragment(props.children)
}
