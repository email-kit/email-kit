import { channels, contrast, type Hex, lightness, yiq } from "../colour.ts"
import {
  type Mode,
  type ResolvedRoles,
  type Role,
  type RoleColours,
  STATUSES,
} from "../roles/index.ts"
import type { Level, TokenFinding } from "./catalogue.ts"

/** The contrast text needs (WCAG 1.4.3). */
const TEXT = 4.5

/** The contrast large text and non-text, such as a button's edge, need (WCAG 1.4.11). */
const NON_TEXT = 3

const ACTIONS = ["primary", "secondary", "destructive"] as const

/** Text on the surfaces it's read on, each pair needing 4.5:1. */
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
  ...(["pageGround", "canvas", "card", "muted", "codeSurface", "inverse", "brand"] as const),
  "strongBorder",
  ...ACTIONS.map((a): Role => `action.${a}.fill`),
  ...STATUSES.flatMap((s): Role[] => [`status.${s}.surface`, `status.${s}.fill`]),
]

/** The L* band forced dark mode barely changes: a ground in it stays mid-grey, and so does text. */
const MIDTONE = { min: 40, max: 65 }

/** The YIQ brightness above which Gmail on Android darkens a fill in its dark mode. */
const GMAIL_FILL_YIQ = 205

/** The colour checks in each mode, plus a note for each colour mapped into sRGB. */
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

/**
 * The colour checks for one mode:
 * - text and labels reach 4.5:1, and a button stands out from the canvas by its fill or border;
 * - in light mode, grounds behind text and meaningful borders stay out of L* 40–65, which forced
 *   dark mode barely changes, so they'd end up unreadable there;
 * - in dark mode, grounds aren't pure black, which makes light text blur (halation);
 * - no near-white with a 1–3 unit channel offset, which turns vivid in Yahoo's dark mode.
 */
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
      const message = `${pair("link", surface)} is ${value.toFixed(2)}:1; links need ${TEXT}:1`
      add("tokens.link-contrast", "error", message)
    }
  }

  for (const action of ACTIONS) {
    const fill: Role = `action.${action}.fill`
    const label: Role = `action.${action}.label`
    const border: Role = `action.${action}.border`
    const labelRatio = ratio(label, fill)
    if (labelRatio < TEXT) {
      const message = `${pair(label, fill)} is ${labelRatio.toFixed(2)}:1; labels need ${TEXT}:1`
      add("tokens.action-contrast", "error", message)
    }
    const edge = Math.max(ratio(fill, "canvas"), ratio(border, "canvas"))
    if (edge < NON_TEXT) {
      add(
        "tokens.action-contrast",
        action === "secondary" ? "warning" : "error",
        `The ${action} button's fill ${c[fill]} and border ${c[border]} reach only ${edge.toFixed(2)}:1 on canvas ${c.canvas}; one needs ${NON_TEXT}:1`,
      )
    }
    const brightness = yiq(c[fill])
    if (brightness > GMAIL_FILL_YIQ) {
      add(
        "tokens.gmail-fill",
        "info",
        `The ${action} fill ${c[fill]} is light (YIQ ${Math.round(brightness)} > ${GMAIL_FILL_YIQ}): Gmail Android may darken it`,
      )
    }
  }

  const brandInk = ratio("brandInk", "canvas")
  if (brandInk < TEXT) {
    const message = `${pair("brandInk", "canvas")} is ${brandInk.toFixed(2)}:1; text needs ${TEXT}:1`
    add("tokens.brand-ink", "error", message)
  }

  if (mode === "light") {
    for (const role of MIDTONE_ROLES) {
      const l = lightness(c[role])
      if (l >= MIDTONE.min && l <= MIDTONE.max) {
        add(
          "tokens.midtone",
          "warning",
          `${role} ${c[role]} has L* ${l.toFixed(0)}, inside the ${MIDTONE.min}–${MIDTONE.max} band that forced dark mode can't separate`,
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

  const seen = new Set<Hex>()
  for (const [role, hex] of Object.entries(c) as [Role, Hex][]) {
    if (seen.has(hex)) continue
    seen.add(hex)
    const spread = offWhiteTint(hex)
    if (spread !== undefined) {
      add(
        "tokens.offwhite-tint",
        "warning",
        `${role} ${hex} is a near-white with a ${spread}-unit tint; use a neutral (R = G = B)`,
      )
    }
  }
  return findings
}

/**
 * The spread between the channels of a near-white (every channel 0xf0 or more) that's off neutral
 * by 1–3 units, or `undefined` for any other colour.
 */
function offWhiteTint(hex: Hex): number | undefined {
  const [r, g, b] = channels(hex)
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  return Math.min(r, g, b) >= 0xf0 && spread >= 1 && spread <= 3 ? spread : undefined
}
