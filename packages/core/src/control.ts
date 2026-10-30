// Control flow (AUTH-08): data-dependent branches and lists become mustache-core sections.
// Conditions that don't depend on data are plain JavaScript and are decided at compile time.

import { EmailKitError } from "./errors.ts"
import type { IrNode } from "./ir.ts"
import { type Child, toNodes } from "./jsx-runtime.ts"
import {
  createPlaceholder,
  type Data,
  type ListPlaceholder,
  type MaybePlaceholder,
  openScope,
  type Placeholder,
  placeholderInfo,
} from "./placeholder.ts"

/**
 * Content for some renderers only (UI-22): `mso` (Outlook's Word engine), `notMso` (every other
 * client), `htmlOnly` (the HTML part) or `textOnly` (the plain-text part).
 */
export function Conditional(props: {
  readonly when: "mso" | "notMso" | "htmlOnly" | "textOnly"
  readonly children?: Child
}): IrNode {
  return { kind: "conditional", when: props.when, children: toNodes(props.children) }
}

/** Repeats its content for each item of a list field: `{{#items}}…{{/items}}`. */
export function Each<Item>(props: {
  readonly of: ListPlaceholder<Item>
  readonly children: (item: Data<Item>) => Child
}): IrNode {
  return section("Each", props.of, props.children, "item")
}

/**
 * Renders its content when an optional field is present (or a boolean is true):
 * `{{#field}}…{{/field}}`. With a function child, the function receives the field as required.
 */
export function If<T>(props: {
  readonly when: MaybePlaceholder<T>
  readonly children: Child | ((value: Data<T>) => Child)
}): IrNode
export function If(props: { readonly when: Placeholder<boolean>; readonly children: Child }): IrNode
export function If(props: { readonly when: unknown; readonly children: unknown }): IrNode {
  return section("If", props.when, props.children, "if")
}

/** Renders its content when an optional field is missing (or a boolean is false): `{{^field}}`. */
export function Unless(props: {
  readonly when: MaybePlaceholder<unknown> | Placeholder<boolean> | ListPlaceholder<unknown>
  readonly children: Child
}): IrNode {
  return section("Unless", props.when, props.children, "unless")
}

function section(
  component: string,
  when: unknown,
  children: unknown,
  mode: "item" | "if" | "unless",
): IrNode {
  const info = placeholderInfo(when)
  if (!info) {
    throw new EmailKitError(
      "static-condition",
      `<${component}> needs a field from data. For conditions known at compile time, use plain ` +
        "JavaScript: {condition && …}",
    )
  }
  const opens = openScope()
  // <Each> children get the item: `{{.}}` in the new scope. <If> children get the field itself;
  // a named field still resolves by name inside the section, but `{{.}}` must move to the new
  // scope, since the section pushes the value it tests.
  const value = mode === "item" || info.path.length === 0 ? createPlaceholder(opens) : when
  const content =
    typeof children === "function" && !placeholderInfo(children) ? children(value) : children
  return {
    kind: "section",
    inverted: mode === "unless",
    path: info.path,
    scope: info.scope,
    opens,
    children: toNodes(content),
  }
}
