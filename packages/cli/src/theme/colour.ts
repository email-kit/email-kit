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

/** A CSS colour converted for email, with what the conversion had to change. */
export interface ConvertedColour {
  readonly hex: Hex
  /** Set when the colour was outside sRGB. `clamped` is what clamping each channel would give. */
  readonly outOfGamut?: { readonly clamped: Hex }
  /** Set when the colour was translucent: its alpha, and the surface it was flattened onto. */
  readonly flattened?: { readonly alpha: number; readonly over: Hex }
}

/** Maps a colour into sRGB by reducing its chroma in OKLCh, as CSS Color 4 does. */
const toSrgb = toGamut("rgb", "oklch")
const toLab = converter("lab65")
const toRgb = converter("rgb")

/**
 * Converts a CSS colour (`oklch()`, `rgb()`, `hsl()`, `color(display-p3 …)`, hex, names) to
 * 6-digit hex, since email clients need sRGB. A colour outside sRGB is mapped into it by reducing
 * its chroma in OKLCh, as CSS Color 4 does, and the plain clamp is reported too. A translucent
 * colour is flattened onto the surface it sits on, in 8-bit sRGB as mail clients do. Values are
 * snapped first, which keeps greys neutral: `oklch(1 0 0)` converts to white with float noise.
 */
export function toHex(value: string, over?: Hex): ConvertedColour {
  const colour = parse(value)
  if (!colour) {
    throw new EmailKitError("invalid-colour", `"${value}" isn't a CSS colour`)
  }
  const mapped = snap(toSrgb(colour))
  const clamped = snap(toRgb(clampRgb(colour)))
  const gamut = formatHex(clamped) !== formatHex(mapped) && {
    outOfGamut: { clamped: formatHex(clamped) as Hex },
  }
  const alpha = colour.alpha ?? 1
  if (alpha >= 1) return { hex: formatHex(mapped) as Hex, ...gamut }
  if (!over) {
    throw new EmailKitError(
      "translucent-colour",
      `"${value}" is translucent; it needs a surface to be flattened onto`,
    )
  }
  const ground = parse(over)
  if (!ground) throw new EmailKitError("invalid-colour", `"${over}" isn't a CSS colour`)
  const flat = snap(blend([snap(toRgb(ground)), { ...mapped, alpha }], "normal", "rgb"))
  return { hex: formatHex(flat) as Hex, ...gamut, flattened: { alpha, over } }
}

/** WCAG 2 contrast ratio, 1–21. */
export function contrast(a: Hex, b: Hex): number {
  return wcagContrast(a, b)
}

/** CIE L* (D65), 0–100. Forced dark mode barely changes colours in the mid-tone band near 50. */
export function lightness(hex: Hex): number {
  return toLab(hex)?.l ?? 0
}

/** YIQ brightness, 0–255. Gmail on Android leaves fills of 205 or less unchanged. */
export function yiq(hex: Hex): number {
  const [r, g, b] = channels(hex)
  return (r * 299 + g * 587 + b * 114) / 1000
}

/** The 0–255 channels of a hex colour. */
export function channels(hex: Hex): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

/** Rounds each channel to 8 bits, the precision of hex, clamped to 0–255. */
function snap(colour: Rgb): Rgb {
  const round = (channel: number) => Math.round(Math.min(1, Math.max(0, channel)) * 255) / 255
  return { mode: "rgb", r: round(colour.r), g: round(colour.g), b: round(colour.b) }
}
