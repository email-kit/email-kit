import { converter } from "culori"

import { contrast, type Hex, toHex } from "../colour.ts"
import type { Mode, RoleColours, RoleNote, RoleOverrides } from "./index.ts"

const toOklch = converter("oklch")

/** The secondary text roles, which are adjusted when they fall just short of 4.5:1. */
const MUTED_INKS = ["mutedInk", "subtleInk"] as const

/** The contrast text needs, WCAG 1.4.3. */
const TEXT_CONTRAST = 4.5

/** How far each step moves the OKLCh lightness while looking for a passing value. */
const STEP = 0.005

/**
 * Secondary text often sits just under 4.5:1: shadcn's #737373 is 4.35:1 on its own #f5f5f5 page
 * ground. This moves it to the nearest lightness that passes on the canvas and the page ground,
 * darker in light mode and lighter in dark mode, keeping hue and chroma. An explicit override is
 * never adjusted, and each adjustment adds a note.
 */
export function adjustInks(
  mode: Mode,
  colours: RoleColours,
  overrides: RoleOverrides,
  notes: RoleNote[],
): RoleColours {
  const out = { ...colours }
  const surfaces = [out.canvas, out.pageGround]
  const passes = (hex: Hex) => surfaces.every((surface) => contrast(hex, surface) >= TEXT_CONTRAST)
  for (const role of MUTED_INKS) {
    if (overrides[role] !== undefined || passes(out[role])) continue
    const before = out[role]
    const adjusted = nearestPassing(before, mode === "light" ? -STEP : STEP, passes)
    if (!adjusted) continue
    out[role] = adjusted
    const worst = Math.min(...surfaces.map((surface) => contrast(before, surface)))
    notes.push({
      role,
      mode,
      kind: "adjusted",
      message:
        `${role} ${before} is ${worst.toFixed(2)}:1 on the ${mode} canvas or page ground; adjusted to ` +
        `${adjusted}, the nearest lightness that reaches 4.5:1 (override the role to choose another)`,
    })
  }
  return out
}

/** The first colour that passes, stepping the lightness from `hex` by `step`; none past 0 or 1. */
function nearestPassing(
  hex: Hex,
  step: number,
  passes: (candidate: Hex) => boolean,
): Hex | undefined {
  const { l, c = 0, h = 0 } = toOklch(hex) ?? { l: 0.5 }
  for (let lightness = l + step; lightness > 0 && lightness < 1; lightness += step) {
    const candidate = toHex(`oklch(${lightness.toFixed(4)} ${c} ${h})`).hex
    if (passes(candidate)) return candidate
  }
  return undefined
}
