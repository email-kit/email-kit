import type { FontStackName } from "@email-kit/core"

/** A resolved font stack. */
export interface FontStack {
  /** The families in order, ending in a generic family such as `sans-serif`. */
  readonly families: readonly string[]
  /**
   * The one family classic Outlook gets: the stack's last installed font. Outlook's Word engine
   * reads only the first family of a stack and, when that font is missing, falls back to Times New
   * Roman instead of trying the next one.
   */
  readonly msoFallback: string
}

/** The default stacks: system fonts first, then fonts installed almost everywhere. */
export const DEFAULT_STACKS: Readonly<Record<FontStackName, readonly string[]>> = {
  sans: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
  serif: ["Georgia", "Times New Roman", "serif"],
  mono: [
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Consolas",
    "Liberation Mono",
    "Courier New",
    "monospace",
  ],
}

/** The generic families every client knows. A stack must end in one of them. */
export const GENERIC_FAMILIES: ReadonlySet<string> = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
])

/**
 * Whether a family names an installed font, which Outlook can use. Generic families, `ui-*`
 * keywords such as `ui-monospace`, and the system-font aliases `-apple-system` and
 * `BlinkMacSystemFont` don't: they name no font on Windows.
 */
export function isNamedFamily(family: string): boolean {
  return (
    !GENERIC_FAMILIES.has(family) &&
    !family.startsWith("ui-") &&
    !family.startsWith("-") &&
    family !== "BlinkMacSystemFont"
  )
}

/**
 * The theme's stacks: each one from the config, or the default. Outlook gets a stack's last named
 * family, or Arial when it has none, which the `tokens.font-stack` check reports.
 */
export function fontStacks(
  configured: Readonly<Partial<Record<FontStackName, readonly string[]>>> = {},
): Record<FontStackName, FontStack> {
  const names = Object.keys(DEFAULT_STACKS) as FontStackName[]
  return Object.fromEntries(
    names.map((name) => {
      const families = configured[name] ?? DEFAULT_STACKS[name]
      return [name, { families, msoFallback: families.filter(isNamedFamily).at(-1) ?? "Arial" }]
    }),
  ) as Record<FontStackName, FontStack>
}
