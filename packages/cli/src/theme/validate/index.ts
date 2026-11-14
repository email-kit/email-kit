import { GENERIC_FAMILIES, isNamedFamily } from "../fonts.ts"
import type { Theme } from "../theme.ts"
import type { Level, TokenFinding } from "./catalogue.ts"
import { validateRoles } from "./colours.ts"

export { type Level, TOKEN_CHECKS, type TokenFinding } from "./catalogue.ts"
export { validateRoles } from "./colours.ts"

/** The smallest touch target, in px. */
const TOUCH_TARGET = 44

/** The container widths that read well in every client, in px. */
const CONTAINER = { min: 480, max: 640 }

/**
 * Every `tokens.*` check on a resolved theme: colours in each mode, then fonts, type, buttons,
 * layout and radius. Findings use the catalogue's ids and levels, so the check engine reports
 * them as they are.
 */
export function validateTheme(theme: Theme): TokenFinding[] {
  return [
    ...validateRoles(theme.roles),
    ...validateFonts(theme),
    ...validateType(theme),
    ...validateButtons(theme),
    ...validateLayout(theme),
  ]
}

const finding = (id: TokenFinding["id"], level: Level, message: string): TokenFinding => ({
  id,
  level,
  message,
})

/**
 * Each stack ends in a generic family, for clients without its fonts, and has a named family,
 * which classic Outlook gets: without one it falls back to Times New Roman.
 */
function validateFonts(theme: Theme): TokenFinding[] {
  return Object.entries(theme.typography.stacks).flatMap(([name, stack]) => {
    const findings: TokenFinding[] = []
    const last = stack.families.at(-1) ?? ""
    if (!GENERIC_FAMILIES.has(last)) {
      findings.push(
        finding(
          "tokens.font-stack",
          "error",
          `The ${name} stack ends in "${last}"; end it with a generic family such as sans-serif`,
        ),
      )
    }
    if (!stack.families.some(isNamedFamily)) {
      findings.push(
        finding(
          "tokens.font-stack",
          "error",
          `The ${name} stack has no named family for Outlook to fall back to (such as Arial)`,
        ),
      )
    }
    return findings
  })
}

/**
 * Each text style has a weight of 400 or 700, the only ones fallback fonts and Outlook render, a
 * size of 14px or more (13px at the least, below which iOS Mail enlarges it), and a letter-spacing
 * in px.
 */
function validateType(theme: Theme): TokenFinding[] {
  return Object.entries(theme.typography.scale).flatMap(([step, type]) => {
    const findings: TokenFinding[] = []
    if (type.weight !== 400 && type.weight !== 700) {
      findings.push(
        finding(
          "tokens.weights",
          "warning",
          `${step} has weight ${type.weight}; fallback fonts and Outlook render only 400 and 700`,
        ),
      )
    }
    if (type.sizePx < 13) {
      findings.push(
        finding(
          "tokens.min-size",
          "error",
          `${step} is ${type.sizePx}px; text is never smaller than 13px (iOS Mail enlarges it)`,
        ),
      )
    } else if (type.sizePx < 14) {
      findings.push(
        finding(
          "tokens.min-size",
          "warning",
          `${step} is ${type.sizePx}px; keep text at 14px or more`,
        ),
      )
    }
    if (!Number.isFinite(type.letterSpacingPx)) {
      findings.push(
        finding(
          "tokens.letter-spacing",
          "warning",
          `${step} letter-spacing must be a number of px`,
        ),
      )
    }
    return findings
  })
}

/**
 * Buttons other than `sm` are at least 44px tall. A button's height is its label's line height
 * plus its padding, which must reach 44px as well as `minHeight`, since classic Outlook ignores
 * `min-height`. `sm` buttons are for secondary actions, so they may be smaller.
 */
function validateButtons(theme: Theme): TokenFinding[] {
  return Object.entries(theme.components.button).flatMap(([size, button]) => {
    const padded = theme.typography.scale[button.font].lineHeightPx + 2 * button.padY
    const height = Math.min(padded, button.minHeight)
    if (size === "sm" || height >= TOUCH_TARGET) return []
    return [
      finding(
        "tokens.button-height",
        "error",
        `The ${size} button is ${height}px tall; touch targets need ${TOUCH_TARGET}px`,
      ),
    ]
  })
}

/** The container is 480–640px wide, and every radius is a px value. */
function validateLayout(theme: Theme): TokenFinding[] {
  const findings: TokenFinding[] = []
  const { container } = theme.layout
  if (container < CONTAINER.min || container > CONTAINER.max) {
    findings.push(
      finding(
        "tokens.container",
        "warning",
        `The container is ${container}px; keep it within ${CONTAINER.min}–${CONTAINER.max}px (600 is standard)`,
      ),
    )
  }
  for (const [name, value] of Object.entries(theme.radius)) {
    if (!Number.isFinite(value) || value < 0) {
      findings.push(
        finding("tokens.radius", "error", `The ${name} radius ${value} isn't a px value`),
      )
    }
  }
  return findings
}
