// Finds, loads and validates email-kit.config.ts (CFG-01, CFG-02, CFG-03, CFG-10). The config is
// loaded with the template loader rather than jiti: one TS loader for everything (ADR 0006).

import { existsSync, statSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"

import type { CheckSetting, ThemeConfig } from "@email-kit/core"
import {
  EmailKitError,
  PLATFORM_KEYS,
  type PlatformKey,
  type PlatformValues,
} from "@email-kit/core/internal"

import { CATALOGUE } from "../checks/catalogue/index.ts"
import { ROLES } from "../theme/roles.ts"
import { TOKEN_CHECKS } from "../theme/validate.ts"

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
  /** Per-check levels, each with its reason */
  readonly checks: Readonly<Record<string, CheckSetting>>
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
  ...["platform", "theme", "locales", "checks"],
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
  const checks = readChecks(config.checks, problems)
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
    checks,
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

const THEME_KEYS = new Set([
  "source",
  "input",
  "roles",
  "typography",
  "radius",
  "layout",
  "dark",
  "emit",
])

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
  if (theme.input !== undefined) {
    const input = theme.input
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      problems.push('theme.input: must be an object like { brand: "acme" }')
    } else {
      for (const [name, context] of Object.entries(input)) {
        if (typeof context !== "string")
          problems.push(`theme.input.${name}: must be a context name`)
      }
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

const LEVELS = ["off", "info", "warn", "error"]

// CFG-06: a known id, a level, and a reason that isn't empty.
function readChecks(value: unknown, problems: string[]): Record<string, CheckSetting> {
  if (value === undefined) return {}
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    problems.push(
      'checks: must be an object like { "img.fluid-width": { level: "off", reason: "…" } }',
    )
    return {}
  }
  const known: string[] = [...CATALOGUE, ...TOKEN_CHECKS].map((check) => check.id)
  const out: Record<string, CheckSetting> = {}
  for (const [id, setting] of Object.entries(value)) {
    if (!known.includes(id)) {
      const near = known.find((k) => distance(k, id) <= 2)
      problems.push(`checks.${id}: unknown check${near ? ` (did you mean ${near}?)` : ""}`)
      continue
    }
    const { level, reason, ...rest } = (
      typeof setting === "object" && setting !== null ? setting : {}
    ) as Record<string, unknown>
    for (const key of Object.keys(rest))
      problems.push(`checks.${id}.${key}: unknown option (known: level, reason)`)
    if (typeof level !== "string" || !LEVELS.includes(level)) {
      problems.push(`checks.${id}.level: must be one of ${LEVELS.map((l) => `"${l}"`).join(", ")}`)
    } else if (typeof reason !== "string" || !reason.trim()) {
      problems.push(
        `checks.${id}.reason: say why this check is set to "${level}"; reviewers read it`,
      )
    } else {
      out[id] = { level: level as CheckSetting["level"], reason }
    }
  }
  return out
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] as number
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const next = row[j] as number
      row[j] = Math.min(
        next + 1,
        (row[j - 1] as number) + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      previous = next
    }
  }
  return row[b.length] as number
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
