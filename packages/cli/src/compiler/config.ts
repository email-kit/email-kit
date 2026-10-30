// Finds, loads and validates email-kit.config.ts (CFG-01, CFG-02, CFG-03, CFG-10). The config is
// loaded with the template loader rather than jiti: one TS loader for everything (ADR 0006).

import { existsSync, statSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"

import type { ThemeConfig } from "@email-kit/core"
import {
  EmailKitError,
  PLATFORM_KEYS,
  type PlatformKey,
  type PlatformValues,
} from "@email-kit/core/internal"

import { ROLES } from "../theme/roles.ts"

import { loadModule } from "./load.ts"

export interface ResolvedConfig {
  /** The config file */
  readonly file: string
  /** The folder holding the config file; every configured path is relative to it */
  readonly dir: string
  readonly root: string
  readonly templates: string
  readonly messages: string
  readonly out: string
  /** Every locale to compile, the default first */
  readonly locales: readonly string[]
  /** The generated module's format */
  readonly module: "ts" | "mjs"
  /** Also write `<out>/<id>/index.*` per template */
  readonly perTemplateEntries: boolean
  /** render() validates data first */
  readonly validate: boolean
  /** Platform values: compile-time constants and the keys passed at send time */
  readonly platform: PlatformValues
  /** The theme config, resolved by loadTheme() */
  readonly theme: ThemeConfig | undefined
  /** Where loaded modules are bundled to, inside the project so packages resolve */
  readonly cacheDir: string
}

export const CONFIG_FILES: readonly string[] = [
  "email-kit.config.ts",
  "email-kit.config.mts",
  "email-kit.config.js",
  "email-kit.config.mjs",
]

const KEYS = new Set([
  ...["root", "templates", "messages", "out", "module", "perTemplateEntries", "validate"],
  ...["platform", "theme", "locales"],
])

export async function loadConfig(options: {
  readonly cwd: string
  readonly config?: string | undefined
}): Promise<ResolvedConfig> {
  const file = options.config
    ? resolve(options.cwd, options.config)
    : CONFIG_FILES.map((name) => join(options.cwd, name)).find((path) => existsSync(path))
  if (!file || !existsSync(file)) {
    throw new EmailKitError(
      "config-not-found",
      options.config
        ? `The config file ${options.config} doesn't exist`
        : `No email-kit.config.ts in ${options.cwd}. Run \`npx email-kit init\`, or pass --config <path>`,
    )
  }
  const dir = dirname(file)
  const cacheDir = join(nearestNodeModules(dir) ?? join(dir, "node_modules"), ".cache", "email-kit")
  const { exports } = await loadModule(file, { cacheDir })
  return resolveConfig(exports.default, { file, cacheDir })
}

/** Validates a loaded config value and resolves its paths and defaults. */
export function resolveConfig(
  value: unknown,
  { file, cacheDir }: { readonly file: string; readonly cacheDir: string },
): ResolvedConfig {
  const dir = dirname(file)
  const problems: string[] = []
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EmailKitError(
      "invalid-config",
      `${file} must have \`export default defineConfig({ … })\``,
    )
  }
  const config = value as Record<string, unknown>
  for (const key of Object.keys(config)) {
    if (!KEYS.has(key)) problems.push(`${key}: unknown option (known: ${[...KEYS].join(", ")})`)
  }
  const path = (key: string): string | undefined => {
    const option = config[key]
    if (option === undefined) return undefined
    if (typeof option !== "string" || option.trim() === "") {
      problems.push(`${key}: must be a non-empty path relative to the config file`)
      return undefined
    }
    return resolve(dir, option)
  }

  const root =
    path("root") ??
    (isDirectory(join(dir, "src")) ? join(dir, "src", "email-kit") : join(dir, "email-kit"))
  const templates = path("templates") ?? join(root, "templates")
  const messages = path("messages") ?? join(root, "messages")
  const out = path("out") ?? join(root, "compiled")
  for (const [name, folder] of [
    ["templates", templates],
    ["messages", messages],
  ] as const) {
    if (folder === out || isInside(folder, out) || isInside(out, folder)) {
      problems.push(`out: must not overlap the ${name} folder (${relative(dir, folder)})`)
    }
  }
  if (out === dir || isInside(out, dir)) {
    problems.push(
      "out: must not contain the project; use its own folder, such as src/email-kit/compiled",
    )
  }

  const module = config.module ?? "ts"
  if (module !== "ts" && module !== "mjs") {
    problems.push(`module: must be "ts" or "mjs", not ${JSON.stringify(module)}`)
  }
  const perTemplateEntries = config.perTemplateEntries ?? false
  if (typeof perTemplateEntries !== "boolean") {
    problems.push("perTemplateEntries: must be true or false")
  }
  const validate = config.validate ?? true
  if (typeof validate !== "boolean") problems.push("validate: must be true or false")
  const platform = readPlatform(config.platform, problems)
  checkTheme(config.theme, problems)
  const locales = readLocales(config.locales, problems)
  if (problems.length > 0) {
    throw new EmailKitError(
      "invalid-config",
      `${file} has ${problems.length === 1 ? "a problem" : `${problems.length} problems`}:\n` +
        problems.map((problem) => `  • ${problem}`).join("\n"),
    )
  }
  return {
    file,
    dir,
    root,
    templates,
    messages,
    out,
    locales,
    module: module === "mjs" ? "mjs" : "ts",
    perTemplateEntries: perTemplateEntries === true,
    validate: validate !== false,
    platform,
    theme: config.theme as ThemeConfig | undefined,
    cacheDir,
  }
}

function readPlatform(value: unknown, problems: string[]): PlatformValues {
  const constants: Partial<Record<PlatformKey, string>> = {}
  const runtime: PlatformKey[] = []
  if (value === undefined) return { constants, runtime }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    problems.push(
      'platform: must be an object like { productName: "Acme", siteUrl: { runtime: true } }',
    )
    return { constants, runtime }
  }
  for (const [key, option] of Object.entries(value)) {
    if (!(PLATFORM_KEYS as readonly string[]).includes(key)) {
      problems.push(`platform.${key}: unknown platform value (known: ${PLATFORM_KEYS.join(", ")})`)
    } else if (typeof option === "string" && option.trim() !== "") {
      constants[key as PlatformKey] = option
    } else if (
      typeof option === "object" &&
      option !== null &&
      Object.keys(option).length === 1 &&
      (option as { runtime?: unknown }).runtime === true
    ) {
      runtime.push(key as PlatformKey)
    } else {
      problems.push(
        `platform.${key}: must be a non-empty string, or { runtime: true } to pass it at send time`,
      )
    }
  }
  return { constants, runtime: runtime.sort() }
}

const THEME_KEYS = new Set(["source", "roles", "typography", "radius", "layout", "dark", "emit"])

// The shape and the names; values (colours, files) are checked when the theme is loaded.
function checkTheme(value: unknown, problems: string[]): void {
  if (value === undefined) return
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    problems.push('theme: must be an object like { source: "app/globals.css" }')
    return
  }
  const theme = value as Record<string, unknown>
  for (const key of Object.keys(theme)) {
    if (!THEME_KEYS.has(key))
      problems.push(`theme.${key}: unknown option (known: ${[...THEME_KEYS].join(", ")})`)
  }
  for (const role of Object.keys((theme.roles as object | undefined) ?? {})) {
    if (!(ROLES as readonly string[]).includes(role)) {
      const near = ROLES.find((r) => r.toLowerCase() === role.toLowerCase())
      problems.push(`theme.roles.${role}: unknown role${near ? ` (did you mean ${near}?)` : ""}`)
    }
  }
  if (theme.dark !== undefined && theme.dark !== "authored" && theme.dark !== "none") {
    problems.push('theme.dark: must be "authored" or "none"')
  }
  if (theme.radius !== undefined && (typeof theme.radius !== "number" || theme.radius < 0)) {
    problems.push("theme.radius: must be a number of px")
  }
  const container = (theme.layout as { container?: unknown } | undefined)?.container
  if (container !== undefined && typeof container !== "number") {
    problems.push("theme.layout.container: must be a number of px")
  }
}

function readLocales(value: unknown, problems: string[]): string[] {
  if (value === undefined) return ["en"]
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    problems.push('locales: must be an object like { default: "en", list: ["en", "de"] }')
    return ["en"]
  }
  const { default: fallback, list, ...unknown } = value as Record<string, unknown>
  for (const key of Object.keys(unknown)) problems.push(`locales.${key}: unknown option`)
  const fallbackProblem = localeProblem(fallback)
  if (typeof fallback !== "string" || fallbackProblem) {
    problems.push(`locales.default: ${fallbackProblem ?? 'must be a locale tag, such as "en"'}`)
    return ["en"]
  }
  if (list === undefined) return [fallback]
  if (!Array.isArray(list) || list.length === 0) {
    problems.push("locales.list: must be a non-empty array of locale tags")
    return [fallback]
  }
  const seen = new Set<string>()
  list.forEach((tag, index) => {
    const problem = localeProblem(tag)
    if (problem) {
      problems.push(`locales.list[${index}]: ${problem}`)
    } else if (seen.has(tag.toLowerCase())) {
      problems.push(`locales.list[${index}]: "${tag}" is listed twice`)
    }
    if (typeof tag === "string") seen.add(tag.toLowerCase())
  })
  if (!seen.has(fallback.toLowerCase())) {
    problems.push(`locales.list: must include the default locale "${fallback}"`)
  }
  return [
    fallback,
    ...list.filter((tag): tag is string => typeof tag === "string" && tag !== fallback),
  ]
}

// Canonical tags only (`pt-BR`, not `pt-br`): they become file names and object keys.
function localeProblem(tag: unknown): string | undefined {
  if (typeof tag !== "string") return `${JSON.stringify(tag)} isn't a locale tag`
  let canonical: string | undefined
  try {
    canonical = Intl.getCanonicalLocales(tag)[0]
  } catch {
    return `"${tag}" isn't a BCP 47 locale tag, such as "en" or "pt-BR"`
  }
  return canonical === tag ? undefined : `write "${tag}" as "${canonical}"`
}

function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path !== "" && !path.startsWith("..") && !isAbsolute(path)
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}

function nearestNodeModules(from: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    if (isDirectory(join(dir, "node_modules"))) return join(dir, "node_modules")
    if (dirname(dir) === dir) return undefined
  }
}
