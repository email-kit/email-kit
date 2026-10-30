// Theme config types (CFG-04, THM-01, THM-04). The compiler resolves them; templates and
// components see the result through roles, never through raw values.

type Action = "primary" | "secondary" | "destructive"
type Status = "info" | "success" | "warning" | "error"

/** A semantic colour role (THM-04, research 05 §12.5). */
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

/** A type-scale step (THM-05). */
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
  /** 400 or 700: fallback fonts and Outlook have nothing else (research 05 §2) */
  readonly weight: number
  readonly letterSpacingPx: number
}

/** Theme variables, as in shadcn: name without `--` → CSS colour. */
export interface ThemeVariables {
  readonly light: Readonly<Record<string, string>>
  readonly dark?: Readonly<Record<string, string>>
  /** shadcn's `--radius`, such as `"0.625rem"` or `"10px"` */
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
  /**
   * For a resolver source: the context of each modifier besides light/dark, such as
   * `{ brand: "acme" }`. Default: each modifier's default. Every permutation is checked.
   */
  readonly input?: Readonly<Record<string, string>>
  /** Override a role with a CSS colour, or `"{token}"` from the source; for both modes or one. */
  readonly roles?: Readonly<
    Partial<Record<ThemeRole, string | { readonly light?: string; readonly dark?: string }>>
  >
  readonly typography?: {
    /** Families, ending in a generic one; the last named family is Outlook's fallback */
    readonly stacks?: Readonly<Partial<Record<FontStackName, readonly string[]>>>
    readonly scale?: Readonly<Partial<Record<TypeStep, Partial<TypeStyle>>>>
  }
  /** Radius in px. Default: the source's `--radius`, else 10 (shadcn). */
  readonly radius?: number
  readonly layout?: {
    /** The content width in px, 480–640. Default: 600 */
    readonly container?: number
  }
  /** `authored` writes the theme's dark palette into the email. Default: `authored` if the source has one */
  readonly dark?: "authored" | "none"
  /** Also write the resolved theme to `<out>/theme.json` (THM-12). Default: `false` */
  readonly emit?: boolean
}
