// The colour checks of the theme (P1-110, PRD A.1 `tokens.*`), run on every mode. Findings use
// the catalogue's ids and levels, so the check engine (M1.4) can report them unchanged.

import { channels, contrast, type Hex, lightness, yiq } from "./colour.ts"
import type { Mode, ResolvedRoles, Role, RoleColours } from "./roles.ts"
import type { Theme } from "./theme.ts"

export type Level = "error" | "warning" | "info"

export interface TokenFinding {
  readonly id: `tokens.${string}`
  readonly level: Level
  /** For colour findings */
  readonly mode?: Mode
  readonly message: string
}

const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"])

/** Every tokens.* check on a resolved theme: colours per mode, then type, buttons, layout, radius. */
export function validateTheme(theme: Theme): TokenFinding[] {
  const findings = validateRoles(theme.roles)
  const add = (id: TokenFinding["id"], level: Level, message: string) =>
    findings.push({ id, level, message })

  for (const [name, stack] of Object.entries(theme.typography.stacks)) {
    const last = stack.families.at(-1) ?? ""
    if (!GENERIC.has(last)) {
      add(
        "tokens.font-stack",
        "error",
        `The ${name} stack ends in "${last}"; end it with a generic family such as sans-serif`,
      )
    }
    if (
      stack.families.every(
        (family) => GENERIC.has(family) || family.startsWith("ui-") || family.startsWith("-"),
      )
    ) {
      add(
        "tokens.font-stack",
        "error",
        `The ${name} stack has no named family for Outlook to fall back to (such as Arial)`,
      )
    }
  }
  for (const [step, type] of Object.entries(theme.typography.scale)) {
    if (type.weight !== 400 && type.weight !== 700) {
      add(
        "tokens.weights",
        "warning",
        `${step} has weight ${type.weight}; fallback fonts and Outlook render only 400 and 700`,
      )
    }
    if (type.sizePx < 13) {
      add(
        "tokens.min-size",
        "error",
        `${step} is ${type.sizePx}px; text is never smaller than 13px (iOS Mail enlarges it)`,
      )
    } else if (type.sizePx < 14) {
      add("tokens.min-size", "warning", `${step} is ${type.sizePx}px; keep text at 14px or more`)
    }
    if (!Number.isFinite(type.letterSpacingPx)) {
      add("tokens.letter-spacing", "warning", `${step} letter-spacing must be a number of px`)
    }
  }
  for (const [size, button] of Object.entries(theme.components.button)) {
    // What renders is the label's line height plus padding: min-height isn't reliable in email
    // (Outlook ignores it), so the computed height must reach 44 as well as the token.
    const height = theme.typography.scale[button.font].lineHeightPx + 2 * button.padY
    // `sm` is only for secondary actions (PRD A.1), so it may be smaller.
    if (size !== "sm" && Math.min(height, button.minHeight) < 44) {
      add(
        "tokens.button-height",
        "error",
        `The ${size} button is ${Math.min(height, button.minHeight)}px tall; touch targets need 44px`,
      )
    }
  }
  const { container } = theme.layout
  if (container < 480 || container > 640) {
    add(
      "tokens.container",
      "warning",
      `The container is ${container}px; keep it within 480–640px (600 is standard)`,
    )
  }
  for (const [name, value] of Object.entries(theme.radius)) {
    if (!Number.isFinite(value) || value < 0) {
      add("tokens.radius", "error", `The ${name} radius ${value} isn't a px value`)
    }
  }
  return findings
}

const TEXT = 4.5
const NON_TEXT = 3
const STATUSES = ["info", "success", "warning", "error"] as const
const ACTIONS = ["primary", "secondary", "destructive"] as const

/** Text on surface, each needing 4.5:1 (WCAG 1.4.3). */
const TEXT_PAIRS: readonly (readonly [Role, Role])[] = [
  ["ink", "canvas"],
  ["ink", "card"],
  ["ink", "muted"],
  ["ink", "codeSurface"],
  ["ink", "pageGround"],
  ["mutedInk", "canvas"],
  ["mutedInk", "pageGround"],
  ["subtleInk", "canvas"],
  ["inverseInk", "inverse"],
  ["onBrand", "brand"],
  ...STATUSES.flatMap((s): (readonly [Role, Role])[] => [
    [`status.${s}.ink`, `status.${s}.surface`],
    [`status.${s}.ink`, "canvas"],
    [`status.${s}.onFill`, `status.${s}.fill`],
  ]),
]

/** Grounds behind text, and borders that must reach 3:1: kept out of the mid-tone band. */
const MIDTONE_ROLES: readonly Role[] = [
  ...["pageGround", "canvas", "card", "muted", "codeSurface", "inverse", "brand"],
  "strongBorder",
  ...ACTIONS.map((a): Role => `action.${a}.fill`),
  ...STATUSES.flatMap((s): Role[] => [`status.${s}.surface`, `status.${s}.fill`]),
] as Role[]

export function validateRoles(roles: ResolvedRoles): TokenFinding[] {
  const findings: TokenFinding[] = []
  for (const mode of ["light", "dark"] as const) {
    const colours = roles[mode]
    if (colours) findings.push(...validateMode(mode, colours))
  }
  for (const note of roles.notes) {
    if (note.kind === "gamut-mapped") {
      findings.push({ id: "tokens.gamut", level: "info", mode: note.mode, message: note.message })
    }
  }
  return findings
}

function validateMode(mode: Mode, c: RoleColours): TokenFinding[] {
  const findings: TokenFinding[] = []
  const add = (id: TokenFinding["id"], level: Level, message: string) =>
    findings.push({ id, level, mode, message })
  const ratio = (a: Role, b: Role) => contrast(c[a], c[b])
  const pair = (a: Role, b: Role) => `${a} ${c[a]} on ${b} ${c[b]}`

  for (const [text, surface] of TEXT_PAIRS) {
    const value = ratio(text, surface)
    if (value < TEXT) {
      const id = text === "onBrand" ? "tokens.brand-ink" : "tokens.contrast"
      add(id, "error", `${pair(text, surface)} is ${value.toFixed(2)}:1; text needs ${TEXT}:1`)
    }
  }

  for (const surface of ["canvas", "pageGround"] as const) {
    const value = ratio("link", surface)
    if (value < TEXT) {
      add(
        "tokens.link-contrast",
        "error",
        `${pair("link", surface)} is ${value.toFixed(2)}:1; links need ${TEXT}:1`,
      )
    }
  }

  for (const action of ACTIONS) {
    const fill: Role = `action.${action}.fill`
    const label: Role = `action.${action}.label`
    const border: Role = `action.${action}.border`
    const labelRatio = ratio(label, fill)
    if (labelRatio < TEXT) {
      add(
        "tokens.action-contrast",
        "error",
        `${pair(label, fill)} is ${labelRatio.toFixed(2)}:1; labels need ${TEXT}:1`,
      )
    }
    // The button must stand out from the canvas by its fill or its border (WCAG 1.4.11).
    const edge = Math.max(ratio(fill, "canvas"), ratio(border, "canvas"))
    if (edge < NON_TEXT) {
      add(
        "tokens.action-contrast",
        action === "secondary" ? "warning" : "error",
        `The ${action} button's fill ${c[fill]} and border ${c[border]} reach only ${edge.toFixed(2)}:1 on canvas ${c.canvas}; one needs ${NON_TEXT}:1`,
      )
    }
    if (yiq(c[fill]) > 205) {
      add(
        "tokens.gmail-fill",
        "info",
        `The ${action} fill ${c[fill]} is light (YIQ ${Math.round(yiq(c[fill]))} > 205): Gmail Android may darken it`,
      )
    }
  }

  const brandInk = ratio("brandInk", "canvas")
  if (brandInk < TEXT) {
    add(
      "tokens.brand-ink",
      "error",
      `${pair("brandInk", "canvas")} is ${brandInk.toFixed(2)}:1; text needs ${TEXT}:1`,
    )
  }

  // Forced dark mode barely moves colours near L* 50 (research 02 C3), so text on a mid-tone
  // ground, or a mid-tone boundary, ends up unreadable there. It concerns the light design.
  if (mode === "light") {
    for (const role of MIDTONE_ROLES) {
      const l = lightness(c[role])
      if (l >= 40 && l <= 65) {
        add(
          "tokens.midtone",
          "warning",
          `${role} ${c[role]} has L* ${l.toFixed(0)}, inside the 40–65 band that forced dark mode can't separate`,
        )
      }
    }
    if (c.pageGround === "#ffffff") {
      add(
        "tokens.light-ground",
        "info",
        "The light page ground is #ffffff; an off-white separates the canvas better",
      )
    }
  } else {
    for (const role of ["pageGround", "canvas"] as const) {
      if (c[role] === "#000000") {
        add(
          "tokens.dark-ground",
          "warning",
          `The dark ${role} is #000000; use #0a0a0a–#1a1a1a to avoid halation`,
        )
      }
    }
  }

  // A near-white with a 1–3 unit channel offset turns vivid in Yahoo's dark mode (research 02 C1).
  const seen = new Set<Hex>()
  for (const [role, hex] of Object.entries(c) as [Role, Hex][]) {
    if (seen.has(hex)) continue
    seen.add(hex)
    const [r, g, b] = channels(hex)
    const spread = Math.max(r, g, b) - Math.min(r, g, b)
    if (Math.min(r, g, b) >= 0xf0 && spread >= 1 && spread <= 3) {
      add(
        "tokens.offwhite-tint",
        "warning",
        `${role} ${hex} is a near-white with a ${spread}-unit tint; use a neutral (R = G = B)`,
      )
    }
  }
  return findings
}
