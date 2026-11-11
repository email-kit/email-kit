import { type ThemeContext, type TypeStep, useDirection, useTheme } from "@email-kit/core"

/** A non-breaking space. An empty cell holds one, or Outlook collapses it. */
export const NBSP = "\u00a0"

/**
 * The inline styles for a step of the theme's type scale: font family, size, line height, weight
 * and letter spacing, plus the rule that makes classic Outlook keep the line height exactly.
 *
 * @param step - The type-scale step, such as `"body"` or `"caption"`.
 * @param theme - The theme, when you already have it from `useTheme()`.
 *
 * @example
 * ```tsx
 * <p style={{ ...font("caption"), color: role("mutedInk") }}>Sent to ada@example.com</p>
 * ```
 */
export function font(
  step: TypeStep,
  theme: ThemeContext = useTheme(),
): Record<string, string | number> {
  const type = theme.typography.scale[step]
  const families = theme.typography.stacks[type.stack].families
  return {
    fontFamily: families.map((family) => (/\s/.test(family) ? `'${family}'` : family)).join(", "),
    fontSize: `${type.sizePx}px`,
    lineHeight: `${type.lineHeightPx}px`,
    fontWeight: type.weight,
    ...(type.letterSpacingPx !== 0 && { letterSpacing: `${type.letterSpacingPx}px` }),
    msoLineHeightRule: "exactly",
  }
}

/**
 * The attributes of a table used for layout: not announced as a table by screen readers, full
 * width, with no gaps or borders. Classic Outlook lays tables out by these, not by CSS.
 */
export const PRESENTATION = {
  role: "presentation",
  width: "100%",
  cellpadding: "0",
  cellspacing: "0",
  border: "0",
} as const

/**
 * The attributes and style for a text cell. In a right-to-left email, the cell gets its own `dir`
 * and right alignment, since some clients drop `dir` from tables and classic Outlook doesn't
 * inherit it reliably. In a left-to-right email, both are empty.
 *
 * @param dir - The direction of the cell's text in a right-to-left email: `"ltr"` for content such
 *   as a one-time code.
 */
export function textCell(dir: "rtl" | "ltr" = "rtl"): {
  readonly attrs: { readonly dir?: "rtl" | "ltr" }
  readonly style: { readonly textAlign?: "right" }
} {
  return useDirection() === "rtl"
    ? { attrs: { dir }, style: { textAlign: "right" } }
    : { attrs: {}, style: {} }
}
