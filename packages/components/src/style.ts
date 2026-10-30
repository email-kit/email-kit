// Shared style helpers. Components take every value from the theme (UI-01): sizes from the type
// scale, colours through role(), spacing from the space scale.

import { type ThemeContext, type TypeStep, useDirection, useTheme } from "@email-kit/core"

/** A non-breaking space, as an escape: keeps empty cells from collapsing in Outlook. */
export const NBSP = "\u00a0"

/**
 * The font for a type step: the family stack (multi-word names in single quotes, so the inline
 * style attribute stays valid, research 05 §7), px size and line height, and Word's exact
 * line-height rule (research 05 §2).
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

/** The attributes of a layout table: Word lays out by them (research 01 §10.5). */
export const PRESENTATION = {
  role: "presentation",
  width: "100%",
  cellpadding: "0",
  cellspacing: "0",
  border: "0",
} as const

/**
 * In a right-to-left email, a text cell carries `dir` and an explicit alignment
 * (i18n.rtl-explicit): Orange strips `dir` from tables and cells, and Outlook mishandles
 * inherited direction. Left-to-right output is unchanged.
 */
export function textCell(dir: "rtl" | "ltr" = "rtl"): {
  readonly attrs: { readonly dir?: "rtl" | "ltr" }
  readonly style: { readonly textAlign?: "right" }
} {
  return useDirection() === "rtl"
    ? { attrs: { dir }, style: { textAlign: "right" } }
    : { attrs: {}, style: {} }
}
