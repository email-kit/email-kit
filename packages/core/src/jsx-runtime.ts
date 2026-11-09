// email-kit's own JSX runtime, used through `/** @jsxImportSource @email-kit/core */`.

import { type AttrValue, type StyleValue, toAttrs } from "./tree/attributes.ts"
import type { IrNode } from "./tree/ir.ts"
import { type Child, fragment, toNodes } from "./tree/nodes.ts"

export type { AttrValue, Child, StyleValue }

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
