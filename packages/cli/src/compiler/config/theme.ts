import type { ThemeConfig } from "@email-kit/core"

import { ROLES } from "../../theme/roles.ts"

import { checkKeys, isRecord, type Problems, quoted } from "./shared.ts"

/** The options inside `theme`. */
const THEME_KEYS: readonly string[] = [
  "source",
  "input",
  "roles",
  "typography",
  "radius",
  "layout",
  "dark",
  "emit",
]

/** The values `theme.dark` takes. */
const DARK: readonly string[] = ["authored", "none"]

/**
 * Reads `theme`, checking only its shape and names. Its values, such as colours and files, are
 * checked later, when `loadTheme()` resolves it.
 */
export function readTheme(value: unknown, problems: Problems): ThemeConfig | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    problems.push('theme: must be an object like { source: "app/globals.css" }')
    return undefined
  }

  checkKeys(value, THEME_KEYS, "theme.", problems)
  if (isRecord(value.roles)) {
    for (const role of Object.keys(value.roles)) {
      if (!(ROLES as readonly string[]).includes(role)) {
        const near = ROLES.find((r) => r.toLowerCase() === role.toLowerCase())
        problems.push(`theme.roles.${role}: unknown role${near ? ` (did you mean ${near}?)` : ""}`)
      }
    }
  }

  if (value.input !== undefined) {
    if (!isRecord(value.input)) {
      problems.push('theme.input: must be an object like { brand: "acme" }')
    } else {
      for (const [name, context] of Object.entries(value.input)) {
        if (typeof context !== "string") {
          problems.push(`theme.input.${name}: must be a context name`)
        }
      }
    }
  }

  if (value.dark !== undefined && !DARK.includes(value.dark as string)) {
    problems.push(`theme.dark: must be ${quoted(DARK)}`)
  }

  if (value.radius !== undefined && (typeof value.radius !== "number" || value.radius < 0)) {
    problems.push("theme.radius: must be a number of px")
  }

  const container = isRecord(value.layout) ? value.layout.container : undefined
  if (container !== undefined && typeof container !== "number") {
    problems.push("theme.layout.container: must be a number of px")
  }
  
  return value as ThemeConfig
}
