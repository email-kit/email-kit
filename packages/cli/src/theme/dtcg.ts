// Reads a W3C DTCG 2025.10 token file (THM-01, research 05 §12.1) into the same variables a
// shadcn theme gives: colour tokens become flat names, so `color.primary.foreground` is
// `primary-foreground` and the shadcn role mapping applies unchanged. Aliases (`{a.b}`) are
// resolved, `$type` is inherited from groups, and a colour's `hex` fallback, when the designer
// gave one, wins over conversion (research 05 §12.6). Resolver files merge their sources into one
// document first (resolver.ts).

import { EmailKitError } from "@email-kit/core/internal"

export interface DtcgVariables {
  /** Flat token name → CSS colour */
  readonly colours: Readonly<Record<string, string>>
  /** A `radius` dimension token, in px */
  readonly radiusPx: number | undefined
}

interface Token {
  readonly path: readonly string[]
  readonly type: string | undefined
  readonly value: unknown
}

// DTCG colour spaces → CSS. Components follow the Color module: hsl and hwb take hue in degrees
// and the other two as 0–100.
const SPACES: Readonly<Record<string, (c: readonly string[]) => string>> = {
  srgb: (c) => `color(srgb ${c.join(" ")}`,
  "srgb-linear": (c) => `color(srgb-linear ${c.join(" ")}`,
  "display-p3": (c) => `color(display-p3 ${c.join(" ")}`,
  "a98-rgb": (c) => `color(a98-rgb ${c.join(" ")}`,
  "prophoto-rgb": (c) => `color(prophoto-rgb ${c.join(" ")}`,
  rec2020: (c) => `color(rec2020 ${c.join(" ")}`,
  "xyz-d65": (c) => `color(xyz-d65 ${c.join(" ")}`,
  "xyz-d50": (c) => `color(xyz-d50 ${c.join(" ")}`,
  oklch: (c) => `oklch(${c.join(" ")}`,
  oklab: (c) => `oklab(${c.join(" ")}`,
  lab: (c) => `lab(${c.join(" ")}`,
  lch: (c) => `lch(${c.join(" ")}`,
  hsl: ([h, s, l]) => `hsl(${h} ${s}% ${l}%`,
  hwb: ([h, w, b]) => `hwb(${h} ${w}% ${b}%`,
}

export function readDtcg(json: string, file = "tokens.json"): DtcgVariables {
  let document: unknown
  try {
    document = JSON.parse(json)
  } catch (error) {
    throw new EmailKitError(
      "invalid-theme",
      `${file} isn't valid JSON: ${(error as Error).message}`,
    )
  }
  return readDtcgDocument(document, file)
}

/** A parsed (or merged) token document. */
export function readDtcgDocument(document: unknown, file: string): DtcgVariables {
  if (!isObject(document))
    throw new EmailKitError("invalid-theme", `${file} isn't a DTCG token file`)

  const tokens = new Map<string, Token>()
  const walk = (node: Record<string, unknown>, path: string[], inherited: string | undefined) => {
    const type = typeof node.$type === "string" ? node.$type : inherited
    if ("$value" in node) {
      tokens.set(path.join("."), { path, type, value: node.$value })
      return
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$") && key !== "$root") continue
      if (!isObject(child)) continue
      walk(child, key === "$root" ? path : [...path, key], type)
    }
  }
  walk(document, [], undefined)

  const resolve = (value: unknown, seen: readonly string[]): unknown => {
    if (typeof value !== "string") return value
    const alias = /^\{([^{}]+)\}$/.exec(value.trim())
    if (!alias) return value
    const target = alias[1] as string
    if (seen.includes(target)) {
      throw new EmailKitError(
        "invalid-theme",
        `${file}: {${[...seen, target].join("} → {")}} is a cycle`,
      )
    }
    const token = tokens.get(target)
    if (!token)
      throw new EmailKitError("invalid-theme", `${file}: the alias {${target}} points at no token`)
    return resolve(token.value, [...seen, target])
  }

  const colours: Record<string, string> = {}
  let radiusPx: number | undefined
  for (const [id, token] of tokens) {
    const value = resolve(token.value, [id])
    if (token.type === "color" || isColourObject(value)) {
      const css = toCss(value, `${file}: ${id}`)
      const [first, ...rest] = token.path
      colours[(first === "color" || first === "colors" ? rest : token.path).join("-")] = css
    } else if (token.type === "dimension" && token.path.at(-1) === "radius") {
      radiusPx = toPx(value, `${file}: ${id}`)
    }
  }
  return { colours, radiusPx }
}

function toCss(value: unknown, where: string): string {
  if (typeof value === "string") return value
  if (!isColourObject(value))
    throw new EmailKitError("invalid-colour", `${where} isn't a DTCG colour`)
  if (typeof value.hex === "string") return value.hex
  const format = SPACES[value.colorSpace]
  if (!format)
    throw new EmailKitError(
      "invalid-colour",
      `${where} uses the unknown colour space "${value.colorSpace}"`,
    )
  const components = value.components.map((c) => (c === "none" ? "none" : String(c)))
  const alpha = typeof value.alpha === "number" && value.alpha < 1 ? ` / ${value.alpha}` : ""
  return `${format(components)}${alpha})`
}

function toPx(value: unknown, where: string): number {
  if (
    isObject(value) &&
    typeof value.value === "number" &&
    (value.unit === "px" || value.unit === "rem")
  ) {
    return value.unit === "rem" ? value.value * 16 : value.value
  }
  throw new EmailKitError("invalid-theme", `${where} must be a dimension in px or rem`)
}

interface ColourObject {
  readonly colorSpace: string
  readonly components: readonly (number | "none")[]
  readonly alpha?: number
  readonly hex?: string
}

function isColourObject(value: unknown): value is ColourObject {
  return isObject(value) && typeof value.colorSpace === "string" && Array.isArray(value.components)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
