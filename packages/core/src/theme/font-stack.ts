import type { FontStackName } from "./theme.ts"

const STACK = Symbol.for("email-kit.font-stack")
declare const stackBrand: unique symbol

/** A font stack from the theme, as `font()` gives it. Use it as `fontFamily` in `style`. */
export interface FontStackValue {
  readonly [stackBrand]: FontStackName
}

/**
 * Uses a font stack from the theme as `fontFamily`. It's written as the stack's families. When it
 * isn't the stack of the `body` step, the element also gets the class `fontClass()` gives, so
 * classic Outlook can give it the stack's own fallback family.
 */
export function fontStack(name: FontStackName): FontStackValue {
  return { [STACK]: name } as unknown as FontStackValue
}

/** The stack name in a value made with `fontStack()`, or `undefined` for any other value. */
export function fontStackOf(value: unknown): FontStackName | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<symbol, FontStackName | undefined>)[STACK]
    : undefined
}

/** The class that marks an element as using a font stack, such as `ek-font--mono`. */
export function fontClass(name: FontStackName): string {
  return `ek-font--${name}`
}

/**
 * The CSS `font-family` value for a list of families. Names with spaces get single quotes, since
 * the value is written inside a double-quoted `style` attribute.
 */
export function familyList(families: readonly string[]): string {
  return families.map((family) => (/\s/.test(family) ? `'${family}'` : family)).join(", ")
}
