// Theme config types

type Action = "primary" | "secondary" | "destructive"
type Status = "info" | "success" | "warning" | "error"

/** A semantic colour role. */
export type ThemeRole =
  | "pageGround"
  | "canvas"
  | "card"
  | "muted"
  | "codeSurface"
  | "inverse"
  | "ink"
  | "mutedInk"
  | "subtleInk"
  | "inverseInk"
  | "link"
  | "hairline"
  | "divider"
  | "strongBorder"
  | "brand"
  | "onBrand"
  | "brandInk"
  | `action.${Action}.${"fill" | "label" | "border"}`
  | `status.${Status}.${"ink" | "surface" | "border" | "fill" | "onFill"}`

/** A type-scale step. */
export type TypeStep =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "lead"
  | "body"
  | "bodySm"
  | "caption"
  | "footer"
  | "button"
  | "code"
  | "otp"
  | "wordmark"

export type FontStackName = "sans" | "serif" | "mono"

export interface TypeStyle {
  readonly stack: FontStackName
  readonly sizePx: number
  readonly lineHeightPx: number
  readonly weight: number
  readonly letterSpacingPx: number
}

export interface ThemeVariables {
  readonly light: Readonly<Record<string, string>>
  readonly dark?: Readonly<Record<string, string>>
  readonly radius?: string
}

export interface ThemeConfig {
  /**
   * Where the colours come from:
   * - a shadcn CSS file (`"app/globals.css"`);
   * - DTCG token files per mode (`{ light: "tokens/light.tokens.json", dark: "…" }`);
   * - the variables themselves (`{ light: { primary: "oklch(0.2 0 0)" }, dark: { … } }`);
   * - a DTCG resolver (`"tokens/theme.resolver.json"`): its modifier with `light` and `dark`
   *   contexts gives the two modes, and `input` picks the others.
   * Default: email-kit's built-in neutral theme.
   */

  readonly source?: string | { readonly light: string; readonly dark?: string } | ThemeVariables
  readonly input?: Readonly<Record<string, string>>
  readonly roles?: Readonly<Partial<Record<ThemeRole, string | { readonly light?: string; readonly dark?: string }>>>
  
  readonly typography?: {
    readonly stacks?: Readonly<Partial<Record<FontStackName, readonly string[]>>>
    readonly scale?: Readonly<Partial<Record<TypeStep, Partial<TypeStyle>>>>
  }

  readonly radius?: number
  readonly layout?: {
    readonly container?: number
  }

  readonly dark?: "authored" | "none"
  readonly emit?: boolean
}
