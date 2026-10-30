// The resolved theme (P1-100 to P1-108): colour roles per mode from the configured source, plus
// typography, spacing, radius, layout and component tokens, all in px. Defaults follow research
// 05 (§1 layout, §2 typography, §6 buttons, §12.4 radius, §14.1 schema).

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import type {
  FontStackName,
  ThemeConfig,
  ThemeRole,
  ThemeVariables,
  TypeStep,
  TypeStyle,
} from "@email-kit/core"
import { EmailKitError } from "@email-kit/core/internal"

import { readDtcg } from "./dtcg.ts"
import { type ColourTokens, type ResolvedRoles, type RoleOverride, resolveRoles } from "./roles.ts"
import { readShadcnCss } from "./shadcn.ts"

export interface FontStack {
  /** Families in order, ending in a generic family */
  readonly families: readonly string[]
  /** The family Outlook's Word engine gets instead of falling back to Times New Roman */
  readonly msoFallback: string
}

export interface Theme {
  /** Where the colours came from, for reports */
  readonly source: string
  /** The theme files that were read, for --watch */
  readonly files: readonly string[]
  readonly roles: ResolvedRoles
  readonly typography: {
    readonly stacks: Readonly<Record<FontStackName, FontStack>>
    readonly scale: Readonly<Record<TypeStep, TypeStyle>>
  }
  readonly space: {
    readonly scale: readonly number[]
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
  readonly layout: {
    readonly container: number
    readonly breakpoint: number
    readonly maxColumns: number
    readonly contentMaxCh: number
  }
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
    readonly otp: { readonly font: TypeStep; readonly surface: "codeSurface" }
  }
  readonly dark: "authored" | "none"
}

// The default when a project configures no source: shadcn/ui's neutral theme (MIT), adjusted for
// email so a new project starts without findings: muted ink that passes on the page ground, a
// darker destructive red (out of the mid-tone band, research 02 C3), and a secondary-button
// border that reaches 3:1.
export const DEFAULT_VARIABLES: ThemeVariables = {
  radius: "0.625rem",
  light: {
    background: "oklch(1 0 0)",
    foreground: "oklch(0.145 0 0)",
    card: "oklch(1 0 0)",
    "card-foreground": "oklch(0.145 0 0)",
    primary: "oklch(0.205 0 0)",
    "primary-foreground": "oklch(0.985 0 0)",
    secondary: "oklch(0.97 0 0)",
    "secondary-foreground": "oklch(0.205 0 0)",
    muted: "oklch(0.97 0 0)",
    // shadcn's #737373 is 4.35:1 on the #f5f5f5 page ground; #707070 is the nearest that passes.
    "muted-foreground": "#707070",
    accent: "oklch(0.97 0 0)",
    destructive: "#991b1b",
    border: "oklch(0.922 0 0)",
  },
  dark: {
    background: "oklch(0.145 0 0)",
    foreground: "oklch(0.985 0 0)",
    card: "oklch(0.205 0 0)",
    "card-foreground": "oklch(0.985 0 0)",
    primary: "oklch(0.922 0 0)",
    "primary-foreground": "oklch(0.205 0 0)",
    secondary: "oklch(0.269 0 0)",
    "secondary-foreground": "oklch(0.985 0 0)",
    muted: "oklch(0.269 0 0)",
    "muted-foreground": "oklch(0.708 0 0)",
    accent: "oklch(0.269 0 0)",
    destructive: "oklch(0.704 0.191 22.216)",
    border: "oklch(1 0 0 / 10%)",
  },
}

const DEFAULT_ROLES: Readonly<Partial<Record<ThemeRole, RoleOverride>>> = {
  "action.secondary.border": "oklch(0.556 0 0)",
}

const STACKS: Readonly<Record<FontStackName, readonly string[]>> = {
  sans: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
  serif: ["Georgia", "Times New Roman", "serif"],
  mono: [
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Consolas",
    "Liberation Mono",
    "Courier New",
    "monospace",
  ],
}

const GENERIC = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-monospace",
  "ui-sans-serif",
  "ui-serif",
])

const style = (
  stack: FontStackName,
  sizePx: number,
  lineHeightPx: number,
  weight: number,
  letterSpacingPx = 0,
): TypeStyle => ({
  stack,
  sizePx,
  lineHeightPx,
  weight,
  letterSpacingPx,
})

// Body 16/24, headings about 1.25× apart, everything ≥ 14 px (research 05 §2).
const SCALE: Readonly<Record<TypeStep, TypeStyle>> = {
  display: style("sans", 36, 44, 700),
  h1: style("sans", 28, 36, 700),
  h2: style("sans", 22, 30, 700),
  h3: style("sans", 18, 26, 700),
  lead: style("sans", 18, 28, 400),
  body: style("sans", 16, 24, 400),
  bodySm: style("sans", 14, 22, 400),
  caption: style("sans", 14, 20, 400),
  footer: style("sans", 14, 20, 400),
  button: style("sans", 16, 24, 700),
  code: style("mono", 14, 20, 400),
  otp: style("mono", 28, 36, 700, 6),
  wordmark: style("sans", 20, 28, 700),
}

/** Loads and resolves the theme. Paths in the config are relative to `dir` (the config's folder). */
export function loadTheme(config: ThemeConfig | undefined, dir: string): Theme {
  const { tokens, radiusPx, source, files } = readSource(config?.source, dir)
  const overrides = {
    ...(config?.source === undefined ? DEFAULT_ROLES : {}),
    ...config?.roles,
  } as Readonly<Record<string, RoleOverride>>
  const roles = resolveRoles(tokens, overrides)
  const base = config?.radius ?? radiusPx ?? 10
  // shadcn's radius scale is multiplicative (research 05 §12.4).
  const r = (multiplier: number) => Math.round(base * multiplier)
  const radius = { none: 0, sm: r(0.6), md: r(0.8), lg: r(1), xl: r(1.4), full: 9999 }
  const stacks = Object.fromEntries(
    (Object.keys(STACKS) as FontStackName[]).map((name) => {
      const families = config?.typography?.stacks?.[name] ?? STACKS[name]
      const named = families.filter((family) => !GENERIC.has(family))
      return [name, { families, msoFallback: named.at(-1) ?? "Arial" }]
    }),
  ) as Record<FontStackName, FontStack>
  const scale = Object.fromEntries(
    (Object.keys(SCALE) as TypeStep[]).map((step) => [
      step,
      { ...SCALE[step], ...config?.typography?.scale?.[step] },
    ]),
  ) as Record<TypeStep, TypeStyle>

  return {
    source,
    files,
    roles,
    typography: { stacks, scale },
    space: {
      scale: [0, 4, 8, 12, 16, 24, 32, 40, 48, 64],
      gutterMobile: 16,
      gutterDesktop: 32,
      stack: { sm: 8, md: 16, lg: 24 },
      section: 32,
    },
    radius: {
      ...radius,
      button: radius.md,
      card: radius.lg,
      badge: radius.full,
      code: radius.sm,
      image: radius.md,
    },
    borderWidth: { hairline: 1, strong: 2 },
    layout: {
      container: config?.layout?.container ?? 600,
      breakpoint: 480,
      maxColumns: 3,
      contentMaxCh: 75,
    },
    components: {
      // 44 px tall with a 16/24 label: (44 − 24) / 2 = 10 px vertical padding (research 05 §6).
      button: {
        sm: { minHeight: 36, padX: 16, padY: 7, font: "bodySm" },
        md: { minHeight: 44, padX: 24, padY: 10, font: "button" },
        lg: { minHeight: 52, padX: 32, padY: 14, font: "button" },
      },
      link: { underline: true },
      otp: { font: "otp", surface: "codeSurface" },
    },
    dark: config?.dark ?? (roles.dark ? "authored" : "none"),
  }
}

function readSource(
  source: ThemeConfig["source"],
  dir: string,
): { tokens: ColourTokens; radiusPx: number | undefined; source: string; files: string[] } {
  if (source === undefined) {
    return fromVariables(
      DEFAULT_VARIABLES,
      "email-kit default (shadcn neutral, adjusted for email)",
    )
  }
  if (typeof source === "string") {
    const file = resolve(dir, source)
    const text = read(file, source)
    if (source.endsWith(".css")) {
      const theme = readShadcnCss(text, source)
      return { tokens: theme, radiusPx: theme.radiusPx, source, files: [file] }
    }
    const tokens = readDtcg(text, source)
    return { tokens: { light: tokens.colours }, radiusPx: tokens.radiusPx, source, files: [file] }
  }
  if (typeof source.light === "string") {
    const light = readDtcg(read(resolve(dir, source.light), source.light), source.light)
    const darkFile = (source as { dark?: string }).dark
    const dark = darkFile ? readDtcg(read(resolve(dir, darkFile), darkFile), darkFile) : undefined
    return {
      tokens: { light: light.colours, dark: dark?.colours },
      radiusPx: light.radiusPx,
      source: darkFile ? `${source.light} + ${darkFile}` : source.light,
      files: [resolve(dir, source.light), ...(darkFile ? [resolve(dir, darkFile)] : [])],
    }
  }
  return fromVariables(source as ThemeVariables, "theme.source (variables)")
}

function fromVariables(variables: ThemeVariables, label: string) {
  const match = variables.radius ? /^([\d.]+)(px|rem)$/.exec(variables.radius.trim()) : null
  const radiusPx = match ? Number(match[1]) * (match[2] === "rem" ? 16 : 1) : undefined
  return {
    tokens: { light: variables.light, dark: variables.dark },
    radiusPx,
    source: label,
    files: [],
  }
}

function read(file: string, label: string): string {
  try {
    return readFileSync(file, "utf8")
  } catch {
    throw new EmailKitError("invalid-theme", `The theme source ${label} can't be read`)
  }
}
