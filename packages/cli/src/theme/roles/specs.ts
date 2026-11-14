import type { ThemeRole as Role } from "@email-kit/core"

/** The status kinds, each with a surface, ink, border, fill and the label on that fill. */
export const STATUSES = ["info", "success", "warning", "error"] as const

export type Status = (typeof STATUSES)[number]

/** A CSS colour for each mode. */
export interface PerMode {
  readonly light: string
  readonly dark: string
}

/** Token names to try, in order, for both modes or for each. */
export type TokenNames =
  | readonly string[]
  | { readonly light: readonly string[]; readonly dark: readonly string[] }

/** Where a role's colour comes from, when the config doesn't override it. */
export type RoleSource =
  /** The first of the tokens the theme has, else the fallback. */
  | { readonly tokens: TokenNames; readonly fallback?: PerMode }
  /**
   * A label on a fill: the token when the theme has it, else `ink` or `inverseInk` (one is light,
   * the other dark), whichever contrasts more with the fill.
   */
  | { readonly labelFor: Role; readonly tokens?: TokenNames }

/** How one role is resolved. */
export interface RoleSpec {
  readonly role: Role
  readonly source: RoleSource
  /**
   * The surface the role sits on: a translucent value is flattened onto it, and reports measure
   * the role's contrast against it. Only `pageGround` sits on nothing.
   */
  readonly over?: Role
}

const tokens = (...names: string[]): RoleSource => ({ tokens: names })

/**
 * The status colours for a theme that has none, as shadcn's defaults have only `destructive`.
 * They're Tailwind CSS v3 palette values (MIT), chosen so every pair passes the contrast checks in
 * both modes and the light fills stay out of the mid-tone band (the 800 shades, L* about 33–39).
 */
const STATUS_DEFAULTS: Readonly<
  Record<Status, Readonly<Record<"ink" | "surface" | "border" | "fill", PerMode>>>
> = {
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

/**
 * A status's five roles. Only the fill and its label come from the theme, from a token named
 * after the status (`destructive` for `error`); the others always use the defaults.
 */
function statusSpecs(status: Status): RoleSpec[] {
  const defaults = STATUS_DEFAULTS[status]
  const token = status === "error" ? "destructive" : status
  return [
    {
      role: `status.${status}.surface`,
      source: { tokens: [], fallback: defaults.surface },
      over: "canvas",
    },
    {
      role: `status.${status}.ink`,
      source: { tokens: [], fallback: defaults.ink },
      over: `status.${status}.surface`,
    },
    {
      role: `status.${status}.border`,
      source: { tokens: [], fallback: defaults.border },
      over: `status.${status}.surface`,
    },
    {
      role: `status.${status}.fill`,
      source: { tokens: [token], fallback: defaults.fill },
      over: "canvas",
    },
    {
      role: `status.${status}.onFill`,
      source: { labelFor: `status.${status}.fill`, tokens: [`${token}-foreground`] },
      over: `status.${status}.fill`,
    },
  ]
}

/**
 * Where each role comes from, in resolution order: a role's `over` surface is resolved before it,
 * and `ink` and `inverseInk` before any label computed from them. Token names are shadcn's.
 * - `pageGround` comes from `muted` in light mode, so the page isn't white like the card, and from
 *   `background` in dark mode, which is darker than the card the canvas comes from.
 * - `strongBorder` defaults to the ink. It must reach 3:1 against the canvas, shadcn's `ring` is
 *   too light for that, and a mid-grey would sit in the mid-tone band.
 * - `action.destructive.label` is computed when the theme has no `destructive-foreground`, which
 *   shadcn no longer has.
 */
export const SPECS: readonly RoleSpec[] = [
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
  {
    role: "action.destructive.label",
    source: { labelFor: "action.destructive.fill", tokens: ["destructive-foreground"] },
    over: "action.destructive.fill",
  },
  { role: "action.destructive.border", source: tokens("destructive"), over: "canvas" },
  ...STATUSES.flatMap(statusSpecs),
]

/** Every role, in resolution order. */
export const ROLES: readonly Role[] = SPECS.map((spec) => spec.role)

/**
 * The surface a role sits on, which its contrast is measured against; `undefined` for
 * `pageGround`. See `RoleSpec.over`.
 */
export function surfaceOf(role: Role): Role | undefined {
  return SPECS.find((spec) => spec.role === role)?.over
}
