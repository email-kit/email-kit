import { EmailKitError } from "@email-kit/core/internal"

import { isObject, lengthToPx, pxOf } from "../shared.ts"

/** What a DTCG token file gives a theme. */
export interface DtcgVariables {
  /** The colour tokens: flat token name → CSS colour, named as shadcn's variables are. */
  readonly colours: Readonly<Record<string, string>>
  /** The value of a dimension token named `radius`, in px. */
  readonly radiusPx: number | undefined
}

/** One token: its path in the document, its own or inherited `$type`, and its `$value`. */
interface Token {
  readonly path: readonly string[]
  readonly type: string | undefined
  readonly value: unknown
}

/** A DTCG colour value: components in a colour space, with an optional alpha and hex fallback. */
interface ColourObject {
  readonly colorSpace: string
  readonly components: readonly (number | "none")[]
  readonly alpha?: number
  readonly hex?: string
}

/** The colour spaces CSS writes as `color(<space> …)`. */
const PREDEFINED = new Set([
  ...["srgb", "srgb-linear", "display-p3", "a98-rgb", "prophoto-rgb", "rec2020"],
  ...["xyz-d65", "xyz-d50"],
])

/** The colour spaces with a CSS function of their own, such as `oklch(…)`. */
const FUNCTIONS = new Set(["oklch", "oklab", "lab", "lch"])

/** Reads a W3C DTCG 2025.10 token file. See `readDtcgDocument()`. */
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

/**
 * Reads a parsed token document, or the one a resolver merged, into the same variables a shadcn
 * theme gives. Colour tokens get flat names, so `color.primary.foreground` is `primary-foreground`
 * and the shadcn role mapping applies unchanged. Aliases (`{a.b}`) are resolved, `$type` is
 * inherited from groups, and a colour's `hex` fallback, when the designer gave one, wins over
 * converting its value.
 */
export function readDtcgDocument(document: unknown, file: string): DtcgVariables {
  if (!isObject(document)) {
    throw new EmailKitError("invalid-theme", `${file} isn't a DTCG token file`)
  }
  const tokens = collectTokens(document)

  /** Follows an alias such as `{color.primary}` to the value it ends at. */
  const resolve = (value: unknown, seen: readonly string[]): unknown => {
    const alias = typeof value === "string" ? /^\{([^{}]+)\}$/.exec(value.trim()) : null
    if (!alias) return value
    const target = alias[1] as string
    if (seen.includes(target)) {
      throw new EmailKitError(
        "invalid-theme",
        `${file}: {${[...seen, target].join("} → {")}} is a cycle`,
      )
    }
    const token = tokens.get(target)
    if (!token) {
      throw new EmailKitError("invalid-theme", `${file}: the alias {${target}} points at no token`)
    }
    return resolve(token.value, [...seen, target])
  }

  const colours: Record<string, string> = {}
  let radiusPx: number | undefined
  for (const [id, token] of tokens) {
    const value = resolve(token.value, [id])
    if (token.type === "color" || isColourObject(value)) {
      colours[flatName(token.path)] = toCss(value, `${file}: ${id}`)
    } else if (token.type === "dimension" && token.path.at(-1) === "radius") {
      radiusPx = toPx(value, `${file}: ${id}`)
    }
  }
  return { colours, radiusPx }
}

/**
 * Every token in a document, by its dotted path. Anything with a `$value` is a token, and anything
 * else is a group. A group's `$type` applies to the tokens inside it, and a `$root` token takes
 * its group's own path.
 */
function collectTokens(document: Record<string, unknown>): Map<string, Token> {
  const tokens = new Map<string, Token>()
  const walk = (node: Record<string, unknown>, path: string[], inherited: string | undefined) => {
    const type = typeof node.$type === "string" ? node.$type : inherited
    if ("$value" in node) {
      tokens.set(path.join("."), { path, type, value: node.$value })
      return
    }
    for (const [key, child] of Object.entries(node)) {
      if ((key.startsWith("$") && key !== "$root") || !isObject(child)) continue
      walk(child, key === "$root" ? path : [...path, key], type)
    }
  }
  walk(document, [], undefined)
  return tokens
}

/** A colour token as a shadcn variable name: `color.primary.foreground` → `primary-foreground`. */
function flatName(path: readonly string[]): string {
  const [first, ...rest] = path
  return (first === "color" || first === "colors" ? rest : path).join("-")
}

/** A colour value as CSS: a string as it is, or a colour object's hex or components. */
function toCss(value: unknown, where: string): string {
  if (typeof value === "string") return value
  if (!isColourObject(value)) {
    throw new EmailKitError("invalid-colour", `${where} isn't a DTCG colour`)
  }
  if (typeof value.hex === "string") return value.hex
  const components = value.components.map(String)
  const alpha = typeof value.alpha === "number" && value.alpha < 1 ? ` / ${value.alpha}` : ""
  const css = cssColour(value.colorSpace, components, alpha)
  if (css === undefined) {
    throw new EmailKitError(
      "invalid-colour",
      `${where} uses the unknown colour space "${value.colorSpace}"`,
    )
  }
  return css
}

/**
 * A colour's components in a colour space as CSS, or `undefined` for a space CSS doesn't have. As
 * in CSS Color, `hsl` and `hwb` take the hue in degrees and their other two components as 0–100.
 */
function cssColour(
  space: string,
  components: readonly string[],
  alpha: string,
): string | undefined {
  if (PREDEFINED.has(space)) return `color(${space} ${components.join(" ")}${alpha})`
  if (FUNCTIONS.has(space)) return `${space}(${components.join(" ")}${alpha})`
  if (space === "hsl" || space === "hwb") {
    const [hue, a, b] = components
    return `${space}(${hue} ${a}% ${b}%${alpha})`
  }
  return undefined
}

/**
 * A dimension in px: a DTCG `{ value, unit }` in px or rem, or a length string such as `8px`, as
 * older token files write it.
 */
function toPx(value: unknown, where: string): number {
  if (isObject(value) && typeof value.value === "number") {
    if (value.unit === "px" || value.unit === "rem") return pxOf(value.value, value.unit)
  }
  const px = typeof value === "string" ? lengthToPx(value) : undefined
  if (px !== undefined) return px
  throw new EmailKitError("invalid-theme", `${where} must be a dimension in px or rem`)
}

function isColourObject(value: unknown): value is ColourObject {
  return isObject(value) && typeof value.colorSpace === "string" && Array.isArray(value.components)
}
