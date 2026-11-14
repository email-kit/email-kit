import type { ThemeRole, ThemeVariables, TypeStep, TypeStyle } from "@email-kit/core"

import type { RoleOverride } from "./roles/index.ts"
import type { Theme } from "./theme.ts"

/** How reports name the default theme. */
export const DEFAULT_SOURCE = "email-kit default (shadcn neutral, adjusted for email)"

/**
 * The theme for a project that configures no source: shadcn/ui's neutral theme (MIT), adjusted so
 * a new project starts without findings. Its muted ink is #707070, the nearest to shadcn's #737373
 * that reaches 4.5:1 on the page ground. Its destructive red is darker, out of the mid-tone band,
 * and its secondary-button border reaches 3:1.
 */
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

/**
 * The roles the default theme sets itself. shadcn's `border` is too light to outline a secondary
 * button, which needs 3:1 against the canvas.
 */
export const DEFAULT_ROLES: Readonly<Partial<Record<ThemeRole, RoleOverride>>> = {
  "action.secondary.border": "oklch(0.556 0 0)",
}

/** The base radius in px when neither the config nor the source gives one: shadcn's 0.625rem. */
export const DEFAULT_RADIUS = 10

const style = (
  stack: TypeStyle["stack"],
  sizePx: number,
  lineHeightPx: number,
  weight: number,
  letterSpacingPx = 0,
): TypeStyle => ({ stack, sizePx, lineHeightPx, weight, letterSpacingPx })

/** The default type scale: body 16/24, headings about 1.25× apart, nothing under 14px. */
export const TYPE_SCALE: Readonly<Record<TypeStep, TypeStyle>> = {
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

/** The spacing, on a 4px grid. */
export const SPACE: Theme["space"] = {
  scale: [0, 4, 8, 12, 16, 24, 32, 40, 48, 64],
  gutterMobile: 16,
  gutterDesktop: 32,
  stack: { sm: 8, md: 16, lg: 24 },
  section: 32,
}

/** The border widths. */
export const BORDER_WIDTH: Theme["borderWidth"] = { hairline: 1, strong: 2 }

/** The layout. Only the container width can be configured. */
export const LAYOUT: Theme["layout"] = {
  container: 600,
  breakpoint: 480,
  maxColumns: 3,
  contentMaxCh: 75,
}

/**
 * The component tokens. Buttons are 44px tall at `md`, the minimum touch target: a 24px line
 * height plus 10px of padding above and below. `sm` buttons are for secondary actions.
 */
export const COMPONENTS: Theme["components"] = {
  button: {
    sm: { minHeight: 36, padX: 16, padY: 7, font: "bodySm" },
    md: { minHeight: 44, padX: 24, padY: 10, font: "button" },
    lg: { minHeight: 52, padX: 32, padY: 14, font: "button" },
  },
  link: { underline: true },
  otp: { font: "otp", surface: "codeSurface" },
}
