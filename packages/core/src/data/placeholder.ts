import { EmailKitError } from "../shared/errors.ts"
import type { IrPlaceholder } from "../tree/ir.ts"

declare const scalarBrand: unique symbol
declare const listBrand: unique symbol
declare const maybeBrand: unique symbol

/** A value a placeholder can stand for: text, a number or a boolean. */
export type Scalar = string | number | boolean

/**
 * A field of `data`. Templates run before any email is sent, so it stands for the value the email
 * gets when it's rendered. Place it in text or an attribute; it can't be computed with.
 */
export interface Placeholder<T extends Scalar = Scalar> {
  readonly [scalarBrand]: T
}

/** Text that is either written in the template or filled in when the email is rendered. */
export type TextValue = string | Placeholder<string>

/** A list field of `data`. Repeat content for each item with `<Each of={…}>`. */
export interface ListPlaceholder<Item> {
  readonly [listBrand]: Item
}

/**
 * A field of `data` that may be missing or `null`. Use it inside `<If when={…}>`, which passes on
 * the value when it's there.
 */
export interface MaybePlaceholder<T> {
  readonly [maybeBrand]: T
}

/**
 * The type of `data` in a template, from the schema's type: each field becomes a `Placeholder`, a
 * list becomes a `ListPlaceholder`, and an optional or nullable field becomes a `MaybePlaceholder`.
 */
export type Data<T> = [T] extends [Scalar]
  ? Placeholder<T>
  : [T] extends [readonly (infer Item)[]]
    ? ListPlaceholder<Item>
    : [T] extends [object]
      ? DataObject<T>
      : never

type DataObject<T> = {
  readonly [K in keyof T]-?: Record<never, never> extends Pick<T, K>
    ? MaybePlaceholder<NonNullable<T[K]>>
    : null extends T[K]
      ? MaybePlaceholder<NonNullable<T[K]>>
      : Data<T[K]>
}

/** Where a placeholder's value comes from. */
export interface PlaceholderInfo {
  readonly path: readonly string[]
  readonly scope: number
}

const INFO = Symbol.for("email-kit.placeholder")

/**
 * Makes a placeholder: a proxy that records the path of each field read from it, so
 * `data.order.total` gives a placeholder for `["order", "total"]`. Using it as a value throws.
 * `then` stays `undefined`, or awaiting a value that holds a placeholder would never finish.
 */
export function createPlaceholder(scope: number, path: readonly string[] = []): unknown {
  const info: PlaceholderInfo = { path, scope }

  return new Proxy(() => {}, {
    get(_target, key) {
      if (key === INFO) return info
      if (key === Symbol.toPrimitive) throw misuse(info, "used as a value")
      if (key === Symbol.iterator) throw misuse(info, "iterated or spread")
      if (typeof key === "symbol" || key === "then" || key === "toJSON") return undefined
      return createPlaceholder(scope, [...path, key])
    },
    apply() {
      throw misuse(info, "called like a function")
    },
  })
}

/** The info of a placeholder, or `undefined` for any other value. */
export function placeholderInfo(value: unknown): PlaceholderInfo | undefined {
  if (typeof value !== "function") return undefined
  return (value as unknown as Record<symbol, PlaceholderInfo | undefined>)[INFO]
}

/** The IR node for a placeholder: `{{path}}`. */
export function toIrPlaceholder(info: PlaceholderInfo): IrPlaceholder {
  return { kind: "placeholder", path: info.path, scope: info.scope }
}

/** A path as a tag, for error messages: `{{order.total}}`, or `{{.}}` for a list item. */
export function describePath(path: readonly string[]): string {
  return path.length === 0 ? "{{.}}" : `{{${path.join(".")}}}`
}

function misuse(info: PlaceholderInfo, what: string): EmailKitError {
  const name = describePath(info.path)
  const method = info.path.at(-1)
  const hint =
    what === "called like a function" && method === "map"
      ? `Use <Each of={…}> to repeat content for a list.`
      : "Templates only place data; they can't compute with it, because the value only exists at " +
        "send time. Compute the value in the backend and pass it as its own field."
  return new EmailKitError(
    "placeholder-misuse",
    `The placeholder ${name} was ${what} at compile time. ${hint}`,
  )
}
