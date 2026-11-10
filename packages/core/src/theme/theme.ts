type Action = "primary" | "secondary" | "destructive"
type Status = "info" | "success" | "warning" | "error"

/**
 * A colour's job in the email, used with `role()`. Each role has a light colour and, when the
 * theme has dark colours, a dark one.
 *
 * - Surfaces: `pageGround` (around the email), `canvas` (the email's background), `card`,
 *   `muted` (quiet panels), `codeSurface` (behind codes), `inverse` (a dark block on light).
 * - Text: `ink` (body text), `mutedInk`, `subtleInk`, `inverseInk` (text on `inverse`), `link`.
 * - Lines: `hairline` (thin borders), `divider`, `strongBorder` (borders that must stand out).
 * - Brand: `brand` (a brand fill), `onBrand` (text on it), `brandInk` (text in the brand colour).
 * - Buttons: `action.<primary | secondary | destructive>.<fill | label | border>`.
 * - Messages: `status.<info | success | warning | error>.<ink | surface | border | fill | onFill>`.
 */
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

/**
 * A text style in the theme's type scale: `display` (the largest), `h1`–`h3`, `lead` (an intro
 * paragraph), `body`, `bodySm`, `caption`, `footer`, `button`, `code`, `otp` (one-time codes)
 * and `wordmark` (a text logo).
 */
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

/** A font family list: `sans`, `serif` or `mono`. */
export type FontStackName = "sans" | "serif" | "mono"

/** One step of the type scale. Sizes are in pixels. */
export interface TypeStyle {
  readonly stack: FontStackName
  readonly sizePx: number
  readonly lineHeightPx: number
  readonly weight: number
  readonly letterSpacingPx: number
}

/**
 * Theme colours written in the config, named like shadcn's CSS variables without the `--`:
 * `{ light: { primary: "oklch(0.2 0 0)", background: "#fff" }, dark: { … } }`.
 */
export interface ThemeVariables {
  readonly light: Readonly<Record<string, string>>
  readonly dark?: Readonly<Record<string, string>>
  /** The base corner radius as a CSS length, such as `"0.625rem"`. */
  readonly radius?: string
}

/** The theme in email-kit.config.ts. Everything is optional. */
export interface ThemeConfig {
  /**
   * Where the colours come from:
   * - a shadcn CSS file (`"app/globals.css"`);
   * - DTCG token files per mode (`{ light: "tokens/light.tokens.json", dark: "…" }`);
   * - the variables themselves (`{ light: { primary: "oklch(0.2 0 0)" }, dark: { … } }`);
   * - a DTCG resolver (`"tokens/theme.resolver.json"`): its modifier with `light` and `dark`
   *   contexts gives the two modes, and `input` picks the others.
   *
   * Default: email-kit's built-in neutral theme.
   */
  readonly source?: string | { readonly light: string; readonly dark?: string } | ThemeVariables
  
  /**
   * For a `.resolver.json` source only: the context to use for each of its other modifiers, such
   * as `{ brand: "acme" }`.
   */
  readonly input?: Readonly<Record<string, string>>
  
  /**
   * Colours for particular roles, replacing what the source gives. A value is a CSS colour or a
   * `{token}` from the source, for both modes or per mode:
   * `{ link: "#2563eb", brand: { light: "{primary}", dark: "#93c5fd" } }`.
   */
  readonly roles?: Readonly<
    Partial<Record<ThemeRole, string | { readonly light?: string; readonly dark?: string }>>
  >
  
  readonly typography?: {
  
    /**
     * Font families for each stack, ending in a generic family such as `sans-serif`. Classic
     * Outlook uses the last named family.
     */
    readonly stacks?: Readonly<Partial<Record<FontStackName, readonly string[]>>>
  
    /** Changes to steps of the type scale: `{ h1: { sizePx: 32 } }`. */
    readonly scale?: Readonly<Partial<Record<TypeStep, Partial<TypeStyle>>>>
  }
  
  /**
   * The base corner radius in pixels. The other radii are scaled from it. Default: the source's
   * radius, or `10`.
   */
  readonly radius?: number
  
  readonly layout?: {
    /** The email's content width in pixels. Default: `600`. */
    readonly container?: number
  }
  
  /**
   * `"authored"` writes dark-mode CSS from the source's dark colours. `"none"` writes no dark
   * mode. Default: `"authored"` when the source has dark colours, otherwise `"none"`.
   */
  readonly dark?: "authored" | "none"
  
  /** Also write the resolved theme to `theme.json` in the output folder. Default: `false`. */
  readonly emit?: boolean
}
