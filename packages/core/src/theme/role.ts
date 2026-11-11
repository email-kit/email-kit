import type { ThemeRole } from "./theme.ts"

const ROLE = Symbol.for("email-kit.role")
declare const roleBrand: unique symbol

const PREFIXES: Readonly<Record<string, string>> = {
  color: "c",
  "background-color": "bg",
  "border-color": "bc",
}

/** A theme colour made with `role()`. Use it as a colour value in `style`. */
export interface RoleColour {
  readonly [roleBrand]: ThemeRole
}

/**
 * Uses a colour from the theme by its role, such as `"ink"` for body text or `"link"` for links,
 * rather than a fixed colour value. The email gets the light colour, and switches to the dark
 * colour in email clients that support dark mode.
 *
 * Use it as a colour value in `style`.
 *
 * @param name - The colour's role in the theme.
 *
 * @example
 * ```tsx
 * <p style={{ color: role("mutedInk"), borderColor: role("hairline") }}>…</p>
 * ```
 */
export function role(name: ThemeRole): RoleColour {
  return { [ROLE]: name } as unknown as RoleColour
}

/** The role name in a value made with `role()`, or `undefined` for any other value. */
export function roleOf(value: unknown): ThemeRole | undefined {
  return typeof value === "object" && value !== null
    ? ((value as Record<symbol, ThemeRole | undefined>)[ROLE] ?? undefined)
    : undefined
}

/**
 * The class that marks an element as using a role for a style property, such as `ek-c--mutedInk`
 * for `color` or `ek-bg--action-primary-fill` for `background-color`. The dark-mode CSS targets it.
 */
export function roleClass(property: string, name: ThemeRole): string {
  return `ek-${PREFIXES[property] ?? property}--${name.replaceAll(".", "-")}`
}

/** Reads a class made by `roleClass()` back into its property and role. */
export function parseRoleClass(
  className: string,
): { property: string; role: ThemeRole } | undefined {
  const match = /^ek-([a-z-]+?)--([A-Za-z-]+)$/.exec(className)
  if (!match) return undefined
  const prefix = match[1] as string
  const property = Object.keys(PREFIXES).find((key) => PREFIXES[key] === prefix) ?? prefix
  return { property, role: (match[2] as string).replaceAll("-", ".") as ThemeRole }
}
