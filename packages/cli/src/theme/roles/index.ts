import type { ThemeRole } from "@email-kit/core"
import { EmailKitError } from "@email-kit/core/internal"

import { contrast, type Hex, toHex } from "../colour.ts"
import { adjustInks } from "./adjust.ts"
import { SPECS, type TokenNames } from "./specs.ts"

export { ROLES, STATUSES, type Status, surfaceOf } from "./specs.ts"

/** A colour's job in the email, such as `canvas`, `ink` or `action.primary.fill`. */
export type Role = ThemeRole

export type Mode = "light" | "dark"

/** A theme's colour tokens per mode: a token name (a shadcn variable without `--`) → CSS colour. */
export interface ColourTokens {
  readonly light: Readonly<Record<string, string>>
  readonly dark?: Readonly<Record<string, string>> | undefined
}

/**
 * The config's colour for a role: a CSS colour or a `{token}` from the theme, for both modes or
 * per mode.
 */
export type RoleOverride = string | { readonly light?: string; readonly dark?: string }

/** The config's colours for some roles. */
export type RoleOverrides = Readonly<Partial<Record<Role, RoleOverride>>>

/** Every role's colour in one mode, as 6-digit hex. */
export type RoleColours = Readonly<Record<Role, Hex>>

/** How a role's colour was arrived at, when it isn't simply the theme's token. */
export interface RoleNote {
  readonly role: Role
  readonly mode: Mode
  /**
   * - `gamut-mapped`: the colour was outside sRGB and was mapped into it;
   * - `flattened`: the colour was translucent and was flattened onto its surface;
   * - `default`: the theme had no token for it, so email-kit's default was used;
   * - `computed`: a label chosen as the more readable of `ink` and `inverseInk`;
   * - `adjusted`: secondary text moved to reach 4.5:1.
   */
  readonly kind: "gamut-mapped" | "flattened" | "default" | "computed" | "adjusted"
  readonly message: string
}

/** Every role's colour in each mode, and how the colours were arrived at. */
export interface ResolvedRoles {
  readonly light: RoleColours
  /** `undefined` when the theme has no dark colours. */
  readonly dark: RoleColours | undefined
  readonly notes: readonly RoleNote[]
}

/**
 * Resolves the semantic colour roles that templates and components colour things with, in each
 * mode, from the theme's tokens (shadcn variable names) and the config's overrides. Roles are
 * resolved in order, so a translucent value is flattened onto the surface it actually sits on.
 * Then secondary text that falls just short of 4.5:1 is adjusted.
 */
export function resolveRoles(theme: ColourTokens, overrides: RoleOverrides = {}): ResolvedRoles {
  const notes: RoleNote[] = []
  const resolve = (mode: Mode, tokens: Readonly<Record<string, string>>) =>
    adjustInks(mode, resolveMode(mode, tokens, overrides, notes), overrides, notes)
  const light = resolve("light", theme.light)
  const dark = theme.dark ? resolve("dark", theme.dark) : undefined
  return { light, dark, notes }
}

/**
 * Every role's colour in one mode: the override, else the first of its tokens the theme has, else
 * a computed label or the default. Each colour is converted to hex over the surface it sits on.
 */
function resolveMode(
  mode: Mode,
  tokens: Readonly<Record<string, string>>,
  overrides: RoleOverrides,
  notes: RoleNote[],
): RoleColours {
  const out: Partial<Record<Role, Hex>> = {}
  for (const { role, source, over: surface } of SPECS) {
    const note = (kind: RoleNote["kind"], message: string) =>
      notes.push({ role, mode, kind, message })
    const override = overrides[role]
    const names = namesFor(source.tokens, mode)
    const value =
      reference(typeof override === "string" ? override : override?.[mode], tokens, role, mode) ??
      names.map((name) => tokens[name]).find((token) => token !== undefined)

    if (value === undefined && "labelFor" in source) {
      const fill = out[source.labelFor] as Hex
      const [ink, inverse] = [out.ink as Hex, out.inverseInk as Hex]
      out[role] = contrast(ink, fill) >= contrast(inverse, fill) ? ink : inverse
      note(
        "computed",
        `${role} is ${out[role]}, the more readable of ink and inverseInk on ${source.labelFor}`,
      )
      continue
    }
    const css = value ?? ("fallback" in source ? source.fallback?.[mode] : undefined)
    if (css === undefined) {
      throw new EmailKitError(
        "unresolved-role",
        `The ${mode} theme has no value for the role ${role}: set --${names[0]} in the theme, or override the role`,
      )
    }
    if (value === undefined) note("default", `${role} uses the email-kit default ${css}`)
    const ground = surface ? out[surface] : undefined
    const converted = toHex(normalise(css), ground)
    out[role] = converted.hex
    if (converted.outOfGamut) {
      note(
        "gamut-mapped",
        `${role} ${css} is outside sRGB: mapped to ${converted.hex} (clamping would give ${converted.outOfGamut.clamped})`,
      )
    }
    if (converted.flattened) {
      note(
        "flattened",
        `${role} ${css} is translucent: flattened over ${surface} (${ground}) to ${converted.hex}`,
      )
    }
  }
  return out as RoleColours
}

/**
 * An override's CSS colour. One that names a token, `{primary}` or a DTCG path such as
 * `{color.brand.500}`, gives that token's value in this mode.
 */
function reference(
  value: string | undefined,
  tokens: Readonly<Record<string, string>>,
  role: Role,
  mode: Mode,
): string | undefined {
  const match = value === undefined ? null : /^\{([\w.-]+)\}$/.exec(value.trim())
  if (!match) return value
  const path = match[1] as string
  const name = path.replace(/^colou?rs?\./, "").replaceAll(".", "-")
  const found = tokens[name]
  if (found === undefined) {
    throw new EmailKitError(
      "unresolved-role",
      `The override for ${role} names {${path}}, but the ${mode} theme has no token "${name}"`,
    )
  }
  return found
}

/** The token names to try in a mode. */
function namesFor(names: TokenNames | undefined, mode: Mode): readonly string[] {
  if (names === undefined) return []
  return "light" in names ? names[mode] : names
}

/** Wraps bare HSL channels in `hsl()`, as shadcn wrote them before Tailwind v4: `0 0% 100%`. */
function normalise(css: string): string {
  return /^-?[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%(\s*\/\s*[\d.]+%?)?$/.test(css.trim())
    ? `hsl(${css})`
    : css
}
