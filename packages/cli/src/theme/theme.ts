import type { FontStackName, ThemeConfig, TypeStep, TypeStyle } from "@email-kit/core"

import {
  BORDER_WIDTH,
  COMPONENTS,
  DEFAULT_RADIUS,
  DEFAULT_ROLES,
  LAYOUT,
  SPACE,
  TYPE_SCALE,
} from "./defaults.ts"
import { type FontStack, fontStacks } from "./fonts.ts"
import { type ResolvedRoles, resolveRoles } from "./roles/index.ts"
import { readSource } from "./source/index.ts"

export type { FontStack }

/**
 * A resolved theme: what components read through `useTheme()`, what the `tokens.*` checks test,
 * and what `theme.json` holds. Every size is in px.
 */
export interface Theme {
  /** Where the colours came from, for reports. */
  readonly source: string
  /** The theme files that were read, for `--watch`. */
  readonly files: readonly string[]
  /** A resolver's other inputs, such as other brands, which are checked too. */
  readonly permutations: readonly Readonly<Record<string, string>>[]
  /** The colour of each role, in light mode and, when the theme has it, dark mode. */
  readonly roles: ResolvedRoles
  readonly typography: {
    /** The font stacks text can use. */
    readonly stacks: Readonly<Record<FontStackName, FontStack>>
    /** The text styles, from `display` down to `footer`. */
    readonly scale: Readonly<Record<TypeStep, TypeStyle>>
  }
  readonly space: {
    /** The spacing steps, on a 4px grid. */
    readonly scale: readonly number[]
    /** The space beside the content on phones and on wider screens. */
    readonly gutterMobile: number
    readonly gutterDesktop: number
    /** The space between stacked blocks. */
    readonly stack: { readonly sm: number; readonly md: number; readonly lg: number }
    /** The space above and below the email's content. */
    readonly section: number
  }
  /**
   * The corner radii: a scale (`none` to `full`, which makes a pill), and the radius each kind of
   * element uses.
   */
  readonly radius: Readonly<
    Record<
      "none" | "sm" | "md" | "lg" | "xl" | "full" | "button" | "card" | "badge" | "code" | "image",
      number
    >
  >
  readonly borderWidth: { readonly hairline: number; readonly strong: number }
  readonly layout: {
    /** The content width on wide screens. */
    readonly container: number
    /** The screen width below which the layout stacks for phones. */
    readonly breakpoint: number
    /** The most columns a row may have. */
    readonly maxColumns: number
    /** The longest comfortable line of text, in characters. */
    readonly contentMaxCh: number
  }
  readonly components: {
    /** Each button size: its minimum height, padding and text style. */
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
    /** One-time codes: their text style, on the code surface. */
    readonly otp: { readonly font: TypeStep; readonly surface: "codeSurface" }
  }
  /** `authored`: the email has dark-mode CSS from the theme's dark colours. `none`: it has none. */
  readonly dark: "authored" | "none"
}

/**
 * Loads and resolves the theme: colour roles in each mode from the configured source, plus
 * typography, spacing, radius, layout and component tokens. Paths in the config are relative to
 * `dir`, the config's folder. The radius scale multiplies the base radius, as shadcn's does.
 */
export function loadTheme(config: ThemeConfig | undefined, dir: string): Theme {
  const source = readSource(config, dir)
  const roles = resolveRoles(source.tokens, {
    ...(config?.source === undefined ? DEFAULT_ROLES : {}),
    ...config?.roles,
  })
  const base = config?.radius ?? source.radiusPx ?? DEFAULT_RADIUS
  const scaled = (multiplier: number) => Math.round(base * multiplier)
  const radius = { none: 0, sm: scaled(0.6), md: scaled(0.8), lg: scaled(1), xl: scaled(1.4) }
  const steps = Object.keys(TYPE_SCALE) as TypeStep[]
  const scale = Object.fromEntries(
    steps.map((step) => [step, { ...TYPE_SCALE[step], ...config?.typography?.scale?.[step] }]),
  ) as Record<TypeStep, TypeStyle>

  return {
    source: source.label,
    files: source.files,
    permutations: source.permutations,
    roles,
    typography: { stacks: fontStacks(config?.typography?.stacks), scale },
    space: SPACE,
    radius: {
      ...radius,
      full: 9999,
      button: radius.md,
      card: radius.lg,
      badge: 9999,
      code: radius.sm,
      image: radius.md,
    },
    borderWidth: BORDER_WIDTH,
    layout: { ...LAYOUT, container: config?.layout?.container ?? LAYOUT.container },
    components: COMPONENTS,
    dark: config?.dark ?? (roles.dark ? "authored" : "none"),
  }
}
