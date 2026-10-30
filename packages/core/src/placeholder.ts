// The typed `data` proxy (AUTH-07). At compile time `data` and every list item are proxies: a
// property access extends the path, and the JSX runtime turns a proxy into an IR placeholder.
// Anything that would need the real value (arithmetic, string methods, iteration) throws.

import { EmailKitError } from "./errors.ts"
import type { IrPlaceholder } from "./ir.ts"

declare const scalarBrand: unique symbol
declare const listBrand: unique symbol
declare const maybeBrand: unique symbol

export type Scalar = string | number | boolean

/** A required scalar field. Renders as `{{path}}`; booleans are only accepted by `<If>`. */
export interface Placeholder<T extends Scalar = Scalar> {
  readonly [scalarBrand]: T
}

/** A list field. Only `<Each of>` accepts it. */
export interface ListPlaceholder<Item> {
  readonly [listBrand]: Item
}

/** An optional or nullable field. Only `<If when>` and `<Unless when>` accept it. */
export interface MaybePlaceholder<T> {
  readonly [maybeBrand]: T
}

/** The compile-time view of data of type `T`. */
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

export interface PlaceholderInfo {
  readonly path: readonly string[]
  readonly scope: number
}

// Symbol.for, so a second copy of @email-kit/core in node_modules still recognises proxies.
const INFO = Symbol.for("email-kit.placeholder")

export function createPlaceholder(scope: number, path: readonly string[] = []): unknown {
  const info: PlaceholderInfo = { path, scope }
  // A function target so that calling a proxy reaches the `apply` trap with a clear error.
  return new Proxy(() => {}, {
    get(_target, key) {
      if (key === INFO) return info
      if (key === Symbol.toPrimitive) throw misuse(info, "used as a value")
      if (key === Symbol.iterator) throw misuse(info, "iterated or spread")
      // `then` must stay undefined, or awaiting a value that holds a proxy would hang.
      if (typeof key === "symbol" || key === "then" || key === "toJSON") return undefined
      return createPlaceholder(scope, [...path, key])
    },
    apply() {
      throw misuse(info, "called like a function")
    },
  })
}

export function placeholderInfo(value: unknown): PlaceholderInfo | undefined {
  if (typeof value !== "function") return undefined
  return (value as unknown as Record<symbol, PlaceholderInfo | undefined>)[INFO]
}

export function toIrPlaceholder(info: PlaceholderInfo): IrPlaceholder {
  return { kind: "placeholder", path: info.path, scope: info.scope }
}

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

// Scopes number the contexts sections open, so the compiler can tell which `{{.}}` a placeholder
// means. Evaluation is synchronous, so one counter per evaluation is enough. It lives on
// globalThis because the template may load a different copy of this module than the compiler
// (a second install, or a test runner's module graph).
const EVALUATION = Symbol.for("email-kit.evaluation")
const slot = globalThis as { [EVALUATION]?: { nextScope: number } | undefined }

export function withScopes<T>(run: () => T): T {
  const previous = slot[EVALUATION]
  slot[EVALUATION] = { nextScope: 1 }
  try {
    return run()
  } finally {
    slot[EVALUATION] = previous
  }
}

export function openScope(): number {
  const state = slot[EVALUATION]
  if (state === undefined) {
    throw new EmailKitError(
      "outside-evaluation",
      "<Each>, <If> and <Unless> only work while email-kit compiles a template",
    )
  }
  return state.nextScope++
}
