import { resolve } from "node:path"

import type { ThemeConfig, ThemeVariables } from "@email-kit/core"
import { EmailKitError } from "@email-kit/core/internal"

import { DEFAULT_SOURCE, DEFAULT_VARIABLES } from "../defaults.ts"
import type { ColourTokens } from "../roles/index.ts"
import { lengthToPx, readText } from "../shared.ts"
import { readDtcg, readDtcgDocument } from "./dtcg.ts"
import {
  inputLabel,
  type Modifier,
  permutations,
  type Resolver,
  readResolver,
  resolveTokens,
} from "./resolver.ts"
import { readShadcnCss } from "./shadcn.ts"

/** `theme.source` as a DTCG token file for each mode. */
type FilePair = { readonly light: string; readonly dark?: string }

/** What a theme source gives: its colours in each mode and its radius. */
export interface Source {
  /** The colour tokens, by shadcn variable name, in each mode. */
  readonly tokens: ColourTokens
  /** The source's base radius in px, when it has one. */
  readonly radiusPx: number | undefined
  /** Where the colours came from, for reports: the configured path, or a description. */
  readonly label: string
  /** The files that were read, for `--watch`. */
  readonly files: readonly string[]
  /** For a resolver, its other permutations, which are checked too. Empty for any other source. */
  readonly permutations: readonly Readonly<Record<string, string>>[]
}

/**
 * Reads the configured `theme.source`, relative to `dir`, the config's folder:
 * - nothing: email-kit's default theme;
 * - a `.resolver.json` file: a DTCG resolver, with `theme.input` choosing the contexts;
 * - a `.css` file: a shadcn/ui theme;
 * - any other file: a DTCG token file, with light colours only;
 * - `{ light, dark }` paths: a DTCG token file per mode;
 * - `{ light, dark }` objects: the variables themselves.
 */
export function readSource(config: ThemeConfig | undefined, dir: string): Source {
  const source = config?.source
  if (typeof source === "string" && source.endsWith(".resolver.json")) {
    return fromResolver(readResolver(resolve(dir, source), source), config?.input ?? {})
  }
  if (config?.input !== undefined) {
    throw new EmailKitError("invalid-theme", "theme.input only applies to a .resolver.json source")
  }
  if (source === undefined) return fromVariables(DEFAULT_VARIABLES, DEFAULT_SOURCE)
  if (typeof source === "string") return fromFile(resolve(dir, source), source)
  if (isFilePair(source)) return fromFilePair(source, dir)
  return fromVariables(source, "theme.source (variables)")
}

/** A shadcn CSS file, or a DTCG token file with light colours only. */
function fromFile(file: string, label: string): Source {
  const text = readText(file, label)
  if (label.endsWith(".css")) {
    const theme = readShadcnCss(text, label)
    return { tokens: theme, radiusPx: theme.radiusPx, label, files: [file], permutations: [] }
  }
  const { colours, radiusPx } = readDtcg(text, label)
  return { tokens: { light: colours }, radiusPx, label, files: [file], permutations: [] }
}

/** A DTCG token file for each mode. The radius comes from the light one. */
function fromFilePair(source: FilePair, dir: string): Source {
  const read = (path: string) => readDtcg(readText(resolve(dir, path), path), path)
  const light = read(source.light)
  const dark = source.dark ? read(source.dark) : undefined
  const paths = source.dark ? [source.light, source.dark] : [source.light]
  return {
    tokens: { light: light.colours, dark: dark?.colours },
    radiusPx: light.radiusPx,
    label: paths.join(" + "),
    files: paths.map((path) => resolve(dir, path)),
    permutations: [],
  }
}

/** Variables written in the config, or email-kit's defaults. */
function fromVariables(variables: ThemeVariables, label: string): Source {
  return {
    tokens: { light: variables.light, dark: variables.dark },
    radiusPx: lengthToPx(variables.radius),
    label,
    files: [],
    permutations: [],
  }
}

/**
 * The colours from a resolver for the selected input, in each mode: email-kit chooses the light
 * and dark contexts itself. The selected permutation, with defaults filled in, is left out of the
 * other permutations that get checked.
 */
function fromResolver(resolver: Resolver, input: Readonly<Record<string, string>>): Source {
  const mode = modeModifier(resolver)
  const entries = Object.entries(input)
  const inputFor = (modifier: Modifier) =>
    entries.find(([key]) => key.toLowerCase() === modifier.name.toLowerCase())?.[1]
  if (mode && inputFor(mode) !== undefined) {
    throw new EmailKitError(
      "invalid-theme",
      `theme.input.${mode.name}: email-kit resolves both light and dark; leave it out`,
    )
  }
  const files = new Set<string>()
  const read = (context: "light" | "dark") => {
    const result = resolveTokens(resolver, mode ? { ...input, [mode.name]: context } : input)
    for (const file of result.files) files.add(file)
    return readDtcgDocument(result.document, `${resolver.label} (${context})`)
  }
  const light = read("light")
  const dark = mode ? read("dark") : undefined
  const selected = inputLabel(
    Object.fromEntries(
      resolver.modifiers
        .filter((modifier) => modifier !== mode)
        .map((modifier) => [modifier.name, inputFor(modifier) ?? modifier.default ?? ""]),
    ),
  )
  const chosen = inputLabel(input)
  return {
    tokens: { light: light.colours, dark: dark?.colours },
    radiusPx: light.radiusPx,
    label: chosen ? `${resolver.label} (${chosen})` : resolver.label,
    files: [...files],
    permutations: permutations(resolver, mode?.name).filter((p) => inputLabel(p) !== selected),
  }
}

/** The modifier whose contexts include `light` and `dark`; `theme` or `mode` if several do. */
function modeModifier(resolver: Resolver): Modifier | undefined {
  const modes = resolver.modifiers.filter(
    (m) => m.contexts.includes("light") && m.contexts.includes("dark"),
  )
  if (modes.length <= 1) return modes[0]
  const named = modes.filter((m) => m.name === "theme" || m.name === "mode")
  if (named.length === 1) return named[0]
  const names = modes.map((m) => m.name).join(", ")
  throw new EmailKitError(
    "invalid-theme",
    `${resolver.label}: several modifiers have light and dark contexts (${names}); name the colour-scheme one "theme"`,
  )
}

/** Whether a source is a pair of token file paths, rather than the variables themselves. */
function isFilePair(
  source: Exclude<ThemeConfig["source"], string | undefined>,
): source is FilePair {
  return typeof source.light === "string"
}
