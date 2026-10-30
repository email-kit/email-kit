// Colour conversion for email (P1-103, research 05 §12.6): any CSS Color 4 value → CSS Color 4
// gamut mapping to sRGB (chroma reduction in OKLCh) → alpha flattened over the actual surface →
// 6-digit hex. Plus the measures the token checks need: WCAG contrast, CIE L* and YIQ.

import { EmailKitError } from "@email-kit/core/internal"
import {
  blend,
  clampRgb,
  converter,
  formatHex,
  parse,
  type Rgb,
  toGamut,
  wcagContrast,
} from "culori"

/** A 6-digit lowercase hex colour, the only colour form written into email. */
export type Hex = `#${string}`

export interface ConvertedColour {
  readonly hex: Hex
  /** The value before gamut mapping was outside sRGB; `clamped` is what naive clamping gives */
  readonly outOfGamut?: { readonly clamped: Hex }
  /** The value had alpha < 1 and was composited over `over` */
  readonly flattened?: { readonly alpha: number; readonly over: Hex }
}

const toSrgb = toGamut("rgb", "oklch")
const toLab = converter("lab65")
const toRgb = converter("rgb")

/**
 * Converts a CSS colour (`oklch()`, `rgb()`, `hsl()`, `color(display-p3 …)`, hex, names) to
 * 6-digit hex. Translucent colours need the surface they sit on.
 */
export function toHex(value: string, over?: Hex): ConvertedColour {
  const colour = parse(value)
  if (!colour) {
    throw new EmailKitError("invalid-colour", `"${value}" isn't a CSS colour`)
  }
  const mapped = snap(toSrgb(colour))
  // clampRgb returns the colour in its own mode; convert before reading channels.
  const clamped = snap(toRgb(clampRgb(colour)))
  const outOfGamut = formatHex(clamped) !== formatHex(mapped)
  const alpha = colour.alpha ?? 1
  if (alpha >= 1) {
    return {
      hex: formatHex(mapped) as Hex,
      ...(outOfGamut && { outOfGamut: { clamped: formatHex(clamped) as Hex } }),
    }
  }
  if (!over) {
    throw new EmailKitError(
      "translucent-colour",
      `"${value}" is translucent; it needs a surface to be flattened onto`,
    )
  }
  // Composite in 8-bit sRGB, as mail clients do. Snapping first keeps greys neutral:
  // oklch(1 0 0) converts to white with float noise, which would tint the result.
  const ground = parse(over)
  if (!ground) throw new EmailKitError("invalid-colour", `"${over}" isn't a CSS colour`)
  const flat = snap(blend([snap(toRgb(ground)), { ...mapped, alpha }], "normal", "rgb"))
  return {
    hex: formatHex(flat) as Hex,
    ...(outOfGamut && { outOfGamut: { clamped: formatHex(clamped) as Hex } }),
    flattened: { alpha, over },
  }
}

/** WCAG 2 contrast ratio, 1–21. */
export function contrast(a: Hex, b: Hex): number {
  return wcagContrast(a, b)
}

/** CIE L* (D65), 0–100, for the mid-tone band (research 02 C3). */
export function lightness(hex: Hex): number {
  return toLab(hex)?.l ?? 0
}

/** YIQ brightness, 0–255: Gmail Android leaves fills ≤ 205 unchanged (research 02 C6). */
export function yiq(hex: Hex): number {
  const [r, g, b] = channels(hex)
  return (r * 299 + g * 587 + b * 114) / 1000
}

/** The 0–255 channels of a hex colour. */
export function channels(hex: Hex): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function snap(colour: Rgb): Rgb {
  const round = (channel: number) => Math.round(Math.min(1, Math.max(0, channel)) * 255) / 255
  return { mode: "rgb", r: round(colour.r), g: round(colour.g), b: round(colour.b) }
}
