// Reads a shadcn/ui theme from its CSS (THM-01, research 05 §12.4): the variables in `:root`
// (light) and `.dark`, also inside `@layer base` as older versions write them. `.dark` inherits
// every variable it doesn't set, as the cascade does, and `var(--x)` references are resolved.
// `@theme inline` only maps the variables to Tailwind names, so it is skipped.

import { EmailKitError } from "@email-kit/core/internal"
import postcss from "postcss"

export interface ShadcnTheme {
  /** Variable name without `--` → CSS value, with var() resolved */
  readonly light: Readonly<Record<string, string>>
  readonly dark: Readonly<Record<string, string>> | undefined
  /** `--radius` in px (rem at a 16 px root) */
  readonly radiusPx: number | undefined
}

const LIGHT = new Set([":root", "html"])
const DARK = new Set([".dark", ":root.dark", "html.dark", '[data-theme="dark"]'])

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
    const selectors = rule.selectors.map((selector) => selector.trim())
    const target = selectors.some((s) => DARK.has(s))
      ? dark
      : selectors.some((s) => LIGHT.has(s))
        ? light
        : undefined
    if (!target) return
    if (target === dark) hasDark = true
    rule.walkDecls(/^--/, (decl) => {
      target[decl.prop.slice(2)] = decl.value.trim()
    })
  })
  if (Object.keys(light).length === 0) {
    throw new EmailKitError("invalid-theme", `${file} has no :root { --… } variables`)
  }
  const resolvedLight = resolveVars(light, file)
  const resolvedDark = hasDark ? resolveVars({ ...light, ...dark }, file) : undefined
  return { light: resolvedLight, dark: resolvedDark, radiusPx: toPx(resolvedLight.radius) }
}

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
    const value = (vars[name] ?? "").replace(
      /var\(\s*--([\w-]+)\s*(?:,\s*([^)]*))?\)/g,
      (_, ref: string, fallback: string | undefined) =>
        vars[ref] !== undefined ? resolve(ref, [...seen, name]) : (fallback ?? "").trim(),
    )
    out[name] = value
    return value
  }
  for (const name of Object.keys(vars)) resolve(name, [])
  return out
}

function toPx(value: string | undefined): number | undefined {
  const match = value === undefined ? null : /^(-?[\d.]+)(px|rem)$/.exec(value.trim())
  if (!match) return undefined
  const amount = Number(match[1])
  return match[2] === "rem" ? amount * 16 : amount
}
