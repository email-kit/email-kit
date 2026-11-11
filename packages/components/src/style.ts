import {
  type FontStackValue,
  type RoleColour,
  role,
  type ThemeContext,
  type ThemeRole,
  type TypeStep,
  useDirection,
  useTheme,
} from "@email-kit/core"
import { fontStack } from "@email-kit/core/internal"

/** A non-breaking space. An empty cell holds one, or Outlook collapses it. */
export const NBSP = "\u00a0"

/**
 * The inline styles for a step of the theme's type scale: font family, size, line height, weight
 * and letter spacing, plus the rule that makes classic Outlook keep the line height exactly. If the
 * step's font stack isn't the body text's, classic Outlook still gets a font from that stack.
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
): Record<string, string | number | FontStackValue> {
  const type = theme.typography.scale[step]
  return {
    fontFamily: fontStack(type.stack),
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

/**
 * The attributes and style for a block of text, such as a paragraph or a heading: no margin, a
 * step of the type scale, a theme colour, and the right-to-left handling of `textCell()`. Spread
 * `attrs` onto the element, and add to `style` after spreading it.
 *
 * @param step - The type-scale step.
 * @param colour - The role of the text colour, such as `"ink"`.
 * @param dir - As for `textCell()`: `"ltr"` for content that reads left to right in any language.
 *
 * @example
 * ```tsx
 * const text = textBlock("body", "ink")
 * <p {...text.attrs} style={{ ...text.style, fontWeight: 700 }}>{props.title}</p>
 * ```
 */
export function textBlock(
  step: TypeStep,
  colour: ThemeRole,
  dir: "rtl" | "ltr" = "rtl",
): {
  readonly attrs: { readonly dir?: "rtl" | "ltr" }
  readonly style: Readonly<Record<string, string | number | RoleColour | FontStackValue>>
} {
  const cell = textCell(dir)
  return {
    attrs: cell.attrs,
    style: { margin: "0", ...cell.style, ...font(step), color: role(colour) },
  }
}
