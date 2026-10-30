// Semantic colour roles (THM-04, research 05 §12.5, §14.1): what templates and components colour
// things with. Each role is resolved per mode from the theme's tokens (shadcn variable names), in
// order, so a translucent value is flattened over the surface it actually sits on.

import type { ThemeRole } from "@email-kit/core"
import { EmailKitError } from "@email-kit/core/internal"

import { converter } from "culori"

import { contrast, type Hex, toHex } from "./colour.ts"

const STATUSES = ["info", "success", "warning", "error"] as const

export type Role = ThemeRole

export type Mode = "light" | "dark"

/** Token name (a shadcn variable without `--`) → CSS colour, per mode. */
export interface ColourTokens {
  readonly light: Readonly<Record<string, string>>
  readonly dark?: Readonly<Record<string, string>> | undefined
}

/** A CSS colour for both modes, or per mode. */
export type RoleOverride = string | { readonly light?: string; readonly dark?: string }

export type RoleColours = Readonly<Record<Role, Hex>>

export interface RoleNote {
  readonly role: Role
  readonly mode: Mode
  readonly kind: "gamut-mapped" | "flattened" | "default" | "computed" | "adjusted"
  readonly message: string
}

export interface ResolvedRoles {
  readonly light: RoleColours
  readonly dark: RoleColours | undefined
  readonly notes: readonly RoleNote[]
}

type TokenNames =
  | readonly string[]
  | { readonly light: readonly string[]; readonly dark: readonly string[] }

type Source =
  /** The first token that exists, else the default */
  | { readonly tokens: TokenNames; readonly fallback?: PerMode }
  /** `ink` or `inverseInk` (one is light, one dark), whichever contrasts more with the fill */
  | { readonly labelFor: Role; readonly tokens?: TokenNames }

type PerMode = { readonly light: string; readonly dark: string }

interface RoleSpec {
  readonly role: Role
  readonly source: Source
  /** The surface a translucent value is flattened onto */
  readonly over?: Role
}

const tokens = (...names: string[]): Source => ({ tokens: names })
const orDefault = (names: readonly string[], light: string, dark: string): Source => ({
  tokens: names,
  fallback: { light, dark },
})

// Status defaults where the theme has none (shadcn's defaults have only `destructive`): Tailwind
// CSS v3 palette values (MIT), chosen so every pair passes the contrast checks in both modes and
// light fills stay out of the mid-tone band (800 shades, L* ≈ 33–39).
const STATUS_DEFAULTS: Readonly<Record<string, Readonly<Record<string, PerMode>>>> = {
  info: {
    ink: { light: "#1d4ed8", dark: "#93c5fd" },
    surface: { light: "#eff6ff", dark: "#172554" },
    border: { light: "#bfdbfe", dark: "#1e40af" },
    fill: { light: "#1d4ed8", dark: "#60a5fa" },
  },
  success: {
    ink: { light: "#15803d", dark: "#86efac" },
    surface: { light: "#f0fdf4", dark: "#052e16" },
    border: { light: "#bbf7d0", dark: "#166534" },
    fill: { light: "#166534", dark: "#4ade80" },
  },
  warning: {
    ink: { light: "#b45309", dark: "#fcd34d" },
    surface: { light: "#fffbeb", dark: "#451a03" },
    border: { light: "#fde68a", dark: "#92400e" },
    fill: { light: "#92400e", dark: "#fbbf24" },
  },
  error: {
    ink: { light: "#b91c1c", dark: "#fca5a5" },
    surface: { light: "#fef2f2", dark: "#450a0a" },
    border: { light: "#fecaca", dark: "#991b1b" },
    fill: { light: "#991b1b", dark: "#f87171" },
  },
}

/** Resolution order matters: a role's `over` surface is resolved before it. */
const SPECS: readonly RoleSpec[] = [
  // Light: not white, so from muted (research 05 ⚠8). Dark: the background, darker than the card
  // the canvas comes from (research 05 §12.5).
  {
    role: "pageGround",
    source: {
      tokens: { light: ["muted", "accent"], dark: ["background"] },
      fallback: { light: "#f5f5f5", dark: "#0a0a0a" },
    },
  },
  { role: "canvas", source: tokens("card", "background"), over: "pageGround" },
  { role: "card", source: tokens("card", "background"), over: "canvas" },
  { role: "muted", source: tokens("muted"), over: "canvas" },
  { role: "codeSurface", source: tokens("muted", "secondary"), over: "canvas" },
  { role: "inverse", source: tokens("foreground"), over: "canvas" },
  { role: "ink", source: tokens("card-foreground", "foreground"), over: "canvas" },
  { role: "mutedInk", source: tokens("muted-foreground"), over: "canvas" },
  { role: "subtleInk", source: tokens("muted-foreground"), over: "canvas" },
  { role: "inverseInk", source: tokens("background"), over: "inverse" },
  { role: "link", source: tokens("primary"), over: "canvas" },
  { role: "hairline", source: tokens("border"), over: "canvas" },
  { role: "divider", source: tokens("border"), over: "canvas" },
  // The 3:1 boundary (WCAG 1.4.11). shadcn's ring is too light for that, and a mid-grey would sit
  // in the mid-tone band (research 02 C3), so it defaults to the ink.
  { role: "strongBorder", source: tokens("card-foreground", "foreground"), over: "canvas" },
  { role: "brand", source: tokens("primary"), over: "canvas" },
  { role: "onBrand", source: { labelFor: "brand", tokens: ["primary-foreground"] }, over: "brand" },
  { role: "brandInk", source: tokens("primary"), over: "canvas" },
  { role: "action.primary.fill", source: tokens("primary"), over: "canvas" },
  {
    role: "action.primary.label",
    source: { labelFor: "action.primary.fill", tokens: ["primary-foreground"] },
    over: "action.primary.fill",
  },
  { role: "action.primary.border", source: tokens("primary"), over: "canvas" },
  { role: "action.secondary.fill", source: tokens("secondary"), over: "canvas" },
  {
    role: "action.secondary.label",
    source: { labelFor: "action.secondary.fill", tokens: ["secondary-foreground"] },
    over: "action.secondary.fill",
  },
  { role: "action.secondary.border", source: tokens("border"), over: "canvas" },
  { role: "action.destructive.fill", source: tokens("destructive"), over: "canvas" },
  // shadcn has no destructive-foreground any more: compute it (research 05 §12.5).
  {
    role: "action.destructive.label",
    source: { labelFor: "action.destructive.fill", tokens: ["destructive-foreground"] },
    over: "action.destructive.fill",
  },
  { role: "action.destructive.border", source: tokens("destructive"), over: "canvas" },
  ...STATUSES.flatMap((status): RoleSpec[] => {
    const defaults = STATUS_DEFAULTS[status] as Readonly<Record<string, PerMode>>
    const own = status === "error" ? "destructive" : status
    const pick = (part: string): PerMode => defaults[part] as PerMode
    return [
      {
        role: `status.${status}.surface`,
        source: orDefault([], pick("surface").light, pick("surface").dark),
        over: "canvas",
      },
      {
        role: `status.${status}.ink`,
        source: orDefault([], pick("ink").light, pick("ink").dark),
        over: `status.${status}.surface`,
      },
      {
        role: `status.${status}.border`,
        source: orDefault([], pick("border").light, pick("border").dark),
        over: `status.${status}.surface`,
      },
      {
        role: `status.${status}.fill`,
        source: orDefault([own], pick("fill").light, pick("fill").dark),
        over: "canvas",
      },
      {
        role: `status.${status}.onFill`,
        source: { labelFor: `status.${status}.fill`, tokens: [`${own}-foreground`] },
        over: `status.${status}.fill`,
      },
    ]
  }),
]

/** Every role, in resolution order. */
export const ROLES: readonly Role[] = SPECS.map((spec) => spec.role)

export function resolveRoles(
  theme: ColourTokens,
  overrides: Readonly<Partial<Record<Role, RoleOverride>>> = {},
): ResolvedRoles {
  const notes: RoleNote[] = []
  const light = adjustInks(
    "light",
    resolveMode("light", theme.light, overrides, notes),
    overrides,
    notes,
  )
  const dark = theme.dark
    ? adjustInks("dark", resolveMode("dark", theme.dark, overrides, notes), overrides, notes)
    : undefined
  return { light, dark, notes }
}

function resolveMode(
  mode: Mode,
  values: Readonly<Record<string, string>>,
  overrides: Readonly<Partial<Record<Role, RoleOverride>>>,
  notes: RoleNote[],
): RoleColours {
  const out: Partial<Record<Role, Hex>> = {}
  for (const spec of SPECS) {
    const over = spec.over ? out[spec.over] : undefined
    const override = overrides[spec.role]
    const overridden = reference(
      typeof override === "string" ? override : override?.[mode],
      values,
      spec.role,
      mode,
    )
    const source = spec.source
    const names = namesFor(source.tokens, mode)
    const token = names.find((name) => values[name] !== undefined)
    const value = overridden ?? (token !== undefined ? values[token] : undefined)

    if (value === undefined && "labelFor" in source) {
      const fill = out[source.labelFor] as Hex
      const ink = out.ink as Hex
      const inverse = out.inverseInk as Hex
      out[spec.role] = contrast(ink, fill) >= contrast(inverse, fill) ? ink : inverse
      notes.push({
        role: spec.role,
        mode,
        kind: "computed",
        message: `${spec.role} is ${out[spec.role]}, the more readable of ink and inverseInk on ${source.labelFor}`,
      })
      continue
    }
    const fallback = "fallback" in source ? source.fallback?.[mode] : undefined
    const css = value ?? fallback
    if (css === undefined) {
      throw new EmailKitError(
        "unresolved-role",
        `The ${mode} theme has no value for the role ${spec.role}: set --${names[0]} in the theme, or override the role`,
      )
    }
    if (value === undefined) {
      notes.push({
        role: spec.role,
        mode,
        kind: "default",
        message: `${spec.role} uses the email-kit default ${css}`,
      })
    }
    const converted = toHex(normalise(css), over)
    out[spec.role] = converted.hex
    if (converted.outOfGamut) {
      notes.push({
        role: spec.role,
        mode,
        kind: "gamut-mapped",
        message: `${spec.role} ${css} is outside sRGB: mapped to ${converted.hex} (clamping would give ${converted.outOfGamut.clamped})`,
      })
    }
    if (converted.flattened) {
      notes.push({
        role: spec.role,
        mode,
        kind: "flattened",
        message: `${spec.role} ${css} is translucent: flattened over ${spec.over} (${over}) to ${converted.hex}`,
      })
    }
  }
  return out as RoleColours
}

const toOklch = converter("oklch")
const MUTED_INKS = ["mutedInk", "subtleInk"] as const

/**
 * THM-11: secondary text often sits just under 4.5:1 (shadcn's #737373 is 4.35:1 on its own
 * #f5f5f5 page ground, research 05 ⚠8). Move it to the nearest lightness that passes on the
 * canvas and the page ground, keeping hue and chroma. An explicit override is never adjusted.
 */
function adjustInks(
  mode: Mode,
  colours: RoleColours,
  overrides: Readonly<Partial<Record<Role, RoleOverride>>>,
  notes: RoleNote[],
): RoleColours {
  const out = { ...colours }
  for (const role of MUTED_INKS) {
    if (overrides[role] !== undefined) continue
    const surfaces = [out.canvas, out.pageGround]
    const passes = (hex: Hex) => surfaces.every((surface) => contrast(hex, surface) >= 4.5)
    if (passes(out[role])) continue
    const { l, c = 0, h = 0 } = toOklch(out[role]) ?? { l: 0.5 }
    const step = mode === "light" ? -0.005 : 0.005
    for (let lightness = l + step; lightness > 0 && lightness < 1; lightness += step) {
      const candidate = toHex(`oklch(${lightness.toFixed(4)} ${c} ${h})`).hex
      if (passes(candidate)) {
        const before = out[role]
        out[role] = candidate
        const worst = Math.min(...surfaces.map((surface) => contrast(before, surface)))
        notes.push({
          role,
          mode,
          kind: "adjusted",
          message:
            `${role} ${before} is ${worst.toFixed(2)}:1 on the ${mode} canvas or page ground; adjusted to ` +
            `${candidate}, the nearest lightness that reaches 4.5:1 (override the role to choose another)`,
        })
        break
      }
    }
  }
  return out
}

// An override can name a token from the source: "{primary}", or a DTCG path "{color.brand.500}".
function reference(
  value: string | undefined,
  values: Readonly<Record<string, string>>,
  role: Role,
  mode: Mode,
): string | undefined {
  const match = value === undefined ? null : /^\{([\w.-]+)\}$/.exec(value.trim())
  if (!match) return value
  const name = (match[1] as string).replace(/^colou?rs?\./, "").replaceAll(".", "-")
  const found = values[name]
  if (found === undefined) {
    throw new EmailKitError(
      "unresolved-role",
      `The override for ${role} names {${match[1]}}, but the ${mode} theme has no token "${name}"`,
    )
  }
  return found
}

function namesFor(names: TokenNames | undefined, mode: Mode): readonly string[] {
  if (names === undefined) return []
  return "light" in names ? names[mode] : names
}

// shadcn before Tailwind v4 wrote bare HSL channels: `--background: 0 0% 100%`.
function normalise(css: string): string {
  return /^-?[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%(\s*\/\s*[\d.]+%?)?$/.test(css.trim())
    ? `hsl(${css})`
    : css
}
