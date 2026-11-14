import type { Mode } from "../roles/index.ts"

/** How serious a finding is. The check engine can change it through the checks config. */
export type Level = "error" | "warning" | "info"

/** One problem the `tokens.*` checks found in the theme. */
export interface TokenFinding {
  readonly id: `tokens.${string}`
  readonly level: Level
  /** The mode a colour finding is about. */
  readonly mode?: Mode
  /** A resolver permutation other than the selected one, such as `brand=b`. */
  readonly permutation?: string
  readonly message: string
}

/**
 * Every `tokens.*` check, with its default level and its rule in one line. The checks config, the
 * docs page and `email-kit check` use this list. A finding may carry another level than its
 * check's default: a secondary button's edge contrast, for example, is only a warning. Levels are
 * written as the checks config writes them, `warn` for `warning`.
 */
export const TOKEN_CHECKS: readonly {
  id: `tokens.${string}`
  level: "error" | "warn" | "info"
  rule: string
}[] = [
  {
    id: "tokens.action-contrast",
    level: "error",
    rule: "Action label/fill ≥ 4.5; fill/canvas ≥ 3, or a border is set.",
  },
  { id: "tokens.brand-ink", level: "error", rule: "`brandInk` on the canvas ≥ 4.5." },
  {
    id: "tokens.button-height",
    level: "error",
    rule: "Button minimum height ≥ 44 px (`sm` only for non-primary actions).",
  },
  { id: "tokens.container", level: "warn", rule: "The container width is within 480–640 px." },
  {
    id: "tokens.contrast",
    level: "error",
    rule: "Text pairs ≥ 4.5 (large text and non-text ≥ 3) in light and authored dark.",
  },
  {
    id: "tokens.dark-ground",
    level: "warn",
    rule: "The authored dark ground isn't `#000000` (aim for `#0a0a0a`–`#1a1a1a`).",
  },
  {
    id: "tokens.font-stack",
    level: "error",
    rule: "Every stack ends in a generic family and has an MSO fallback.",
  },
  {
    id: "tokens.gamut",
    level: "info",
    rule: "Out-of-gamut colours are mapped into sRGB; reports the source and the hex.",
  },
  {
    id: "tokens.gmail-fill",
    level: "info",
    rule: "Action fill YIQ ≤ 205, so Gmail Android leaves it unchanged.",
  },
  { id: "tokens.letter-spacing", level: "warn", rule: "Letter-spacing is in px." },
  { id: "tokens.light-ground", level: "info", rule: "The light ground isn't `#ffffff`." },
  {
    id: "tokens.link-contrast",
    level: "error",
    rule: "The link colour ≥ 4.5 against the canvas and the page ground in each mode.",
  },
  {
    id: "tokens.midtone",
    level: "warn",
    rule: "Grounds behind text and meaningful borders aren't in L* 40–65.",
  },
  {
    id: "tokens.min-size",
    level: "error",
    rule: "Type sizes ≥ 14 px (a warning), never < 13 px (an error).",
  },
  {
    id: "tokens.offwhite-tint",
    level: "warn",
    rule: "No near-white with a 1–3 unit channel offset.",
  },
  { id: "tokens.radius", level: "error", rule: "Radius values parse to single px values." },
  { id: "tokens.weights", level: "warn", rule: "Font weights are 400 or 700." },
]
