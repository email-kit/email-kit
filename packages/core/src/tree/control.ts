// Control flow: data-dependent branches and lists become mustache-core sections.
// Conditions that don't depend on data are plain JavaScript and are decided at compile time.

import {
  createPlaceholder,
  type Data,
  type ListPlaceholder,
  type MaybePlaceholder,
  type Placeholder,
  placeholderInfo,
} from "../data/placeholder.ts"
import { openScope } from "../data/scope.ts"
import { EmailKitError } from "../shared/errors.ts"
import type { IrNode } from "./ir.ts"
import { type Child, toNodes } from "./nodes.ts"

/**
 * Shows its content in only some versions of the email.
 *
 * - `"mso"`: only in classic Outlook for Windows, which renders email with Microsoft Word.
 * - `"notMso"`: in every email client except classic Outlook.
 * - `"htmlOnly"`: only in the HTML version, never in the plain-text version.
 * - `"textOnly"`: only in the plain-text version, never in the HTML version.
 *
 * @example
 * ```tsx
 * <Conditional when="textOnly">View this email online: {platform.siteUrl}</Conditional>
 * ```
 */
export function Conditional(props: {
  readonly when: "mso" | "notMso" | "htmlOnly" | "textOnly"
  readonly children?: Child
}): IrNode {
  return { kind: "conditional", when: props.when, children: toNodes(props.children) }
}

/**
 * Repeats its content once for each item of a list field in `data`. An empty list renders
 * nothing; pair it with `<Unless>` to show a message instead.
 *
 * The child is a function that receives the current item. It runs once, while the template
 * compiles, not once per item: the item stands for "the current item", and the real items are
 * filled in when the email is rendered.
 *
 * @param props.of - A list field from `data`, such as `data.items`.
 * @param props.children - A function from the current item to the content to repeat.
 *
 * @example
 * ```tsx
 * <Each of={data.items}>
 *   {(item) => <p>{item.name}: {item.price}</p>}
 * </Each>
 * ```
 */
export function Each<Item>(props: {
  readonly of: ListPlaceholder<Item>
  readonly children: (item: Data<Item>) => Child
}): IrNode {
  return section("Each", props.of, props.children, "item")
}

/**
 * Shows its content only when an optional field in `data` has a value. Missing, `null`, `""`
 * and `0` count as no value.
 *
 * The child can be a function: it receives the field as required, so you can use its parts
 * without checking for a missing value.
 *
 * Use `<If>` for conditions on data. For conditions you know while writing the template, use
 * plain JavaScript: `{showFooter && <Footer />}`.
 *
 * @param props.when - An optional field from `data`, such as `data.coupon`.
 * @param props.children - The content to show, or a function from the field to that content.
 *
 * @example
 * ```tsx
 * <If when={data.coupon}>
 *   {(coupon) => <p>Your code: {coupon.code}</p>}
 * </If>
 * ```
 */
export function If<T>(props: {
  readonly when: MaybePlaceholder<T>
  readonly children: Child | ((value: Data<T>) => Child)
}): IrNode
/**
 * Shows its content only when a boolean field in `data` is `true`.
 *
 * @param props.when - A boolean field from `data`, such as `data.isNewCustomer`.
 * @param props.children - The content to show.
 *
 * @example
 * ```tsx
 * <If when={data.isNewCustomer}>
 *   <p>Welcome! Here is 10% off your first order.</p>
 * </If>
 * ```
 */
export function If(props: { readonly when: Placeholder<boolean>; readonly children: Child }): IrNode
export function If(props: { readonly when: unknown; readonly children: unknown }): IrNode {
  return section("If", props.when, props.children, "if")
}

/**
 * Shows its content only when a field in `data` has no value: the opposite of `<If>`.
 * Missing, `null`, `false`, `""`, `0` and an empty list count as no value.
 *
 * @param props.when - An optional, boolean or list field from `data`.
 * @param props.children - The content to show.
 *
 * @example
 * ```tsx
 * <Unless when={data.orders}>
 *   <p>You haven't ordered anything yet.</p>
 * </Unless>
 * ```
 */
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
