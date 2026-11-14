import { EmailKitError } from "@email-kit/core/internal"
import postcss from "postcss"

import { lengthToPx } from "../shared.ts"

/** The variables of a shadcn/ui theme. */
export interface ShadcnTheme {
  /** The light variables: name without `--` → CSS value, with `var()` resolved. */
  readonly light: Readonly<Record<string, string>>
  /** The dark variables, with each light one `.dark` doesn't set; `undefined` without `.dark`. */
  readonly dark: Readonly<Record<string, string>> | undefined
  /** `--radius` in px, when it's a px or rem length. */
  readonly radiusPx: number | undefined
}

/** The selectors whose variables are the light theme. */
const LIGHT = new Set([":root", "html"])

/** The selectors whose variables are the dark theme. */
const DARK = new Set([".dark", ":root.dark", "html.dark", '[data-theme="dark"]'])

/**
 * Reads a shadcn/ui theme from its CSS: the variables in `:root` for light and `.dark` for dark,
 * also inside `@layer base`, as older versions write them. `.dark` inherits every variable it
 * doesn't set, as the cascade does, and `var(--x)` references are resolved. `@theme inline` only
 * maps the variables to Tailwind names, so it's skipped.
 */
export function readShadcnCss(css: string, file = "theme.css"): ShadcnTheme {
  let root: postcss.Root
  try {
    root = postcss.parse(css, { from: file })
  } catch (error) {
    throw new EmailKitError("invalid-theme", `${file} isn't valid CSS: ${(error as Error).message}`)
  }
  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}
  let hasDark = false
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && (rule.parent as postcss.AtRule).name === "theme") return
    const mode = modeOf(rule.selectors)
    if (!mode) return
    if (mode === "dark") hasDark = true
    const target = mode === "dark" ? dark : light
    rule.walkDecls(/^--/, (decl) => {
      target[decl.prop.slice(2)] = decl.value.trim()
    })
  })
  if (Object.keys(light).length === 0) {
    throw new EmailKitError("invalid-theme", `${file} has no :root { --… } variables`)
  }
  const resolvedLight = resolveVars(light, file)
  const resolvedDark = hasDark ? resolveVars({ ...light, ...dark }, file) : undefined
  return { light: resolvedLight, dark: resolvedDark, radiusPx: lengthToPx(resolvedLight.radius) }
}

/** Which theme a rule's variables belong to, by its selectors. A dark selector wins. */
function modeOf(selectors: readonly string[]): "light" | "dark" | undefined {
  const trimmed = selectors.map((selector) => selector.trim())
  if (trimmed.some((selector) => DARK.has(selector))) return "dark"
  if (trimmed.some((selector) => LIGHT.has(selector))) return "light"
  return undefined
}

/**
 * Resolves each variable's `var()` references: to the variable's own value when it's set,
 * otherwise to the fallback, which is resolved in turn. A cycle is an error.
 */
function resolveVars(vars: Readonly<Record<string, string>>, file: string): Record<string, string> {
  const out: Record<string, string> = {}
  const resolve = (name: string, seen: readonly string[]): string => {
    if (out[name] !== undefined) return out[name]
    if (seen.includes(name)) {
      throw new EmailKitError(
        "invalid-theme",
        `${file}: --${[...seen, name].join(" → --")} is a cycle`,
      )
    }
    const expand = (value: string): string =>
      replaceVars(value, (ref, fallback) =>
        vars[ref] !== undefined ? resolve(ref, [...seen, name]) : expand(fallback),
      )
    out[name] = expand(vars[name] ?? "")
    return out[name]
  }
  for (const name of Object.keys(vars)) resolve(name, [])
  return out
}

/**
 * Replaces each `var(--name, fallback)` in a value with what `replace` gives for it. The closing
 * bracket is found by counting, so a fallback can hold brackets of its own, such as
 * `var(--brand, oklch(0.5 0.2 250))`. The fallback is `""` when there's none.
 */
function replaceVars(value: string, replace: (name: string, fallback: string) => string): string {
  let out = ""
  let rest = value
  for (let start = rest.indexOf("var("); start !== -1; start = rest.indexOf("var(")) {
    const end = closingBracket(rest, start + 3)
    if (end === -1) break
    const match = /^\s*--([\w-]+)\s*(?:,([\s\S]*))?$/.exec(rest.slice(start + 4, end))
    out += rest.slice(0, start)
    out += match ? replace(match[1] as string, (match[2] ?? "").trim()) : rest.slice(start, end + 1)
    rest = rest.slice(end + 1)
  }
  return out + rest
}

/** The index of the bracket that closes the one at `open`, or -1 when it's never closed. */
function closingBracket(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++
    else if (text[i] === ")" && --depth === 0) return i
  }
  return -1
}
