// Theme colours in styles. Components colour things with `role("ink")`, never with a raw value.
// The JSX runtime writes the light colour inline and tags the element with a class for the role, from which the compiler writes the dark CSS.

import type { ThemeRole } from "./theme.ts"

const ROLE = Symbol.for("email-kit.role")
declare const roleBrand: unique symbol

const PREFIXES: Readonly<Record<string, string>> = {
  color: "c",
  "background-color": "bg",
  "border-color": "bc",
}

export interface RoleColour {
  readonly [roleBrand]: ThemeRole
}

export function role(name: ThemeRole): RoleColour {
  return { [ROLE]: name } as unknown as RoleColour
}

export function roleOf(value: unknown): ThemeRole | undefined {
  return typeof value === "object" && value !== null
    ? ((value as Record<symbol, ThemeRole | undefined>)[ROLE] ?? undefined)
    : undefined
}

export function roleClass(property: string, name: ThemeRole): string {
  return `ek-${PREFIXES[property] ?? property}--${name.replaceAll(".", "-")}`
}

export function parseRoleClass(
  className: string,
): { property: string; role: ThemeRole } | undefined {
  const match = /^ek-([a-z-]+?)--([A-Za-z-]+)$/.exec(className)
  if (!match) return undefined
  const prefix = match[1] as string
  const property = Object.keys(PREFIXES).find((key) => PREFIXES[key] === prefix) ?? prefix
  return { property, role: (match[2] as string).replaceAll("-", ".") as ThemeRole }
}
