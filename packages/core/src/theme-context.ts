// The resolved theme, as components see it while a template is compiled (UI-01): role colours
// for the light mode and the type, space, radius, layout and button tokens, all in px.
// Components colour things with `role("ink")`, never with a raw value. The JSX runtime writes the
// light colour inline and tags the element with a class for the role, from which the compiler
// writes the dark CSS (BLD-05, research 02 D5).

import { EmailKitError } from "./errors.ts"
import type { FontStackName, ThemeRole, TypeStep, TypeStyle } from "./theme.ts"

export interface ThemeContext {
  /** Light-mode colours, 6-digit hex */
  readonly roles: Readonly<Record<ThemeRole, string>>
  readonly typography: {
    readonly stacks: Readonly<
      Record<FontStackName, { readonly families: readonly string[]; readonly msoFallback: string }>
    >
    readonly scale: Readonly<Record<TypeStep, TypeStyle>>
  }
  readonly space: {
    readonly gutterMobile: number
    readonly gutterDesktop: number
    readonly stack: { readonly sm: number; readonly md: number; readonly lg: number }
    readonly section: number
  }
  readonly radius: Readonly<
    Record<
      "none" | "sm" | "md" | "lg" | "xl" | "full" | "button" | "card" | "badge" | "code" | "image",
      number
    >
  >
  readonly borderWidth: { readonly hairline: number; readonly strong: number }
  readonly layout: { readonly container: number }
  readonly components: {
    readonly button: Readonly<
      Record<
        "sm" | "md" | "lg",
        {
          readonly minHeight: number
          readonly padX: number
          readonly padY: number
          readonly font: TypeStep
        }
      >
    >
    readonly link: { readonly underline: boolean }
  }
}

// On globalThis, so a component package that loaded another copy of core still sees it.
const SLOT = Symbol.for("email-kit.theme")
const slot = globalThis as { [SLOT]?: ThemeContext | undefined }

export function withTheme<T>(theme: ThemeContext | undefined, run: () => T): T {
  const previous = slot[SLOT]
  slot[SLOT] = theme
  try {
    return run()
  } finally {
    slot[SLOT] = previous
  }
}

/** The theme of the template being compiled. */
export function useTheme(): ThemeContext {
  const theme = slot[SLOT]
  if (!theme) {
    throw new EmailKitError("no-theme", "useTheme() only works while email-kit compiles a template")
  }
  return theme
}

const ROLE = Symbol.for("email-kit.role")
declare const roleBrand: unique symbol

/** A theme colour for a style property: the light value inline, the dark one from CSS. */
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

// Short class prefixes for the common colour properties; others use the property name.
const PREFIXES: Readonly<Record<string, string>> = {
  color: "c",
  "background-color": "bg",
  "border-color": "bc",
}

/** `ek-c--ink`, `ek-bg--action-primary-fill`, `ek-border-top-color--hairline` */
export function roleClass(property: string, name: ThemeRole): string {
  return `ek-${PREFIXES[property] ?? property}--${name.replaceAll(".", "-")}`
}

/** The property and role a class from roleClass() stands for. */
export function parseRoleClass(
  className: string,
): { property: string; role: ThemeRole } | undefined {
  const match = /^ek-([a-z-]+?)--([A-Za-z-]+)$/.exec(className)
  if (!match) return undefined
  const prefix = match[1] as string
  const property = Object.keys(PREFIXES).find((key) => PREFIXES[key] === prefix) ?? prefix
  return { property, role: (match[2] as string).replaceAll("-", ".") as ThemeRole }
}
