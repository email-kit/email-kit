// Finds, loads and validates email-kit.config.ts (CFG-01, CFG-02, CFG-03, CFG-10). The config is
// loaded with the template loader rather than jiti: one TS loader for everything (ADR 0006).

import { existsSync, statSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"

import type { CheckSetting, CustomCheck, ThemeConfig } from "@email-kit/core"
import {
  EmailKitError,
  PLATFORM_KEYS,
  type PlatformKey,
  type PlatformValues,
} from "@email-kit/core/internal"

import { CATALOGUE } from "../checks/catalogue/index.ts"
import { PSEUDO_LOCALES } from "../i18n/pseudo.ts"
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
  /** `locales.fallback`: a requested tag → the compiled locale it goes to */
  readonly localeFallback: Readonly<Record<string, string>>
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
  /** Team checks from defineCheck() */
  readonly customChecks: readonly CustomCheck[]
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
  ...["platform", "theme", "locales", "checks", "customChecks"],
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
  const customChecks = readCustomChecks(config.customChecks, problems)
  const checks = readChecks(
    config.checks,
    customChecks.map((check) => check.id),
    problems,
  )
  const real = readLocales(config.locales, problems)
  const locales = [...real, ...readPseudo(config.locales, real, problems)]
  const localeFallback = readLocaleFallback(config.locales, locales, problems)
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
    localeFallback,
    module: module === "mjs" ? "mjs" : "ts",
    perTemplateEntries: perTemplateEntries === true,
    validate: validate !== false,
    platform,
    theme: config.theme as ThemeConfig | undefined,
    checks,
    customChecks,
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
function readChecks(
  value: unknown,
  custom: readonly string[],
  problems: string[],
): Record<string, CheckSetting> {
  if (value === undefined) return {}
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    problems.push(
      'checks: must be an object like { "img.fluid-width": { level: "off", reason: "…" } }',
    )
    return {}
  }
  const known: string[] = [...[...CATALOGUE, ...TOKEN_CHECKS].map((check) => check.id), ...custom]
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

const ON = ["template", "render", "both"]

// P1-166: an id in a family of the team's own, unique; the fields the reporters show; run().
function readCustomChecks(value: unknown, problems: string[]): CustomCheck[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    problems.push("customChecks: must be an array of defineCheck({ … })")
    return []
  }
  const builtIn = new Set([...CATALOGUE, ...TOKEN_CHECKS].map((check) => check.id.split(".")[0]))
  const seen = new Set<string>()
  const out: CustomCheck[] = []
  value.forEach((check: unknown, i) => {
    const where = `customChecks[${i}]`
    if (typeof check !== "object" || check === null) {
      problems.push(`${where}: must be a defineCheck({ id, level, rule, fix, run })`)
      return
    }
    const c = check as Record<string, unknown>
    const before = problems.length
    if (typeof c.id !== "string" || !/^[a-z][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/.test(c.id)) {
      problems.push(`${where}.id: must be "family.name" in lowercase, such as "acme.help-link"`)
    } else if (builtIn.has(c.id.split(".")[0] as string)) {
      problems.push(
        `${where}.id: "${c.id.split(".")[0]}." is email-kit's; use your own family, such as "acme.${c.id.split(".")[1]}"`,
      )
    } else if (seen.has(c.id)) {
      problems.push(`${where}.id: "${c.id}" is defined twice`)
    }
    if (typeof c.level !== "string" || !["error", "warn", "info"].includes(c.level)) {
      problems.push(`${where}.level: must be "error", "warn" or "info"`)
    }
    for (const key of ["rule", "fix"]) {
      if (typeof c[key] !== "string" || !(c[key] as string).trim())
        problems.push(`${where}.${key}: must be a sentence`)
    }
    if (c.on !== undefined && !ON.includes(c.on as string)) {
      problems.push(`${where}.on: must be "template", "render" or "both"`)
    }
    if (typeof c.run !== "function")
      problems.push(`${where}.run: must be a function (context, report) => void`)
    if (problems.length === before) {
      seen.add(c.id as string)
      out.push(check as CustomCheck)
    }
  })
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

// CFG-03's pseudo-locale toggle: `true` for both, or a list of them.
function readPseudo(value: unknown, locales: readonly string[], problems: string[]): string[] {
  const pseudo =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>).pseudo
      : undefined
  if (pseudo === undefined || pseudo === false) return []
  const chosen = pseudo === true ? [...PSEUDO_LOCALES] : pseudo
  if (
    !Array.isArray(chosen) ||
    chosen.some((tag) => !(PSEUDO_LOCALES as readonly unknown[]).includes(tag))
  ) {
    problems.push(
      `locales.pseudo: must be true, or a list of ${PSEUDO_LOCALES.map((l) => `"${l}"`).join(" and ")}`,
    )
    return []
  }
  const clash = chosen.find((tag) => locales.some((l) => l.toLowerCase() === tag.toLowerCase()))
  if (clash) {
    problems.push(
      `locales.pseudo: "${clash}" is also in locales.list; pseudo-locales are generated, not translated`,
    )
    return []
  }
  return [...new Set(chosen as string[])]
}

// CFG-03: `{ "pt": "pt-BR" }`: a tag that isn't compiled → a compiled locale.
function readLocaleFallback(
  value: unknown,
  locales: readonly string[],
  problems: string[],
): Record<string, string> {
  const chain =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>).fallback
      : undefined
  if (chain === undefined) return {}
  if (typeof chain !== "object" || chain === null || Array.isArray(chain)) {
    problems.push('locales.fallback: must be an object like { pt: "pt-BR" }')
    return {}
  }
  const compiled = (tag: string) => locales.find((l) => l.toLowerCase() === tag.toLowerCase())
  const out: Record<string, string> = {}
  for (const [tag, target] of Object.entries(chain)) {
    const problem = localeProblem(tag)
    const to = typeof target === "string" ? compiled(target) : undefined
    if (problem) problems.push(`locales.fallback: "${tag}": ${problem}`)
    else if (compiled(tag))
      problems.push(`locales.fallback.${tag}: "${tag}" is compiled, so it never falls back`)
    else if (!to)
      problems.push(
        `locales.fallback.${tag}: must be one of the compiled locales (${locales.join(", ")})`,
      )
    else out[tag] = to
  }
  return out
}

function readLocales(value: unknown, problems: string[]): string[] {
  if (value === undefined) return ["en"]
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    problems.push('locales: must be an object like { default: "en", list: ["en", "de"] }')
    return ["en"]
  }
  const {
    default: fallback,
    list,
    fallback: _chain,
    pseudo: _pseudo,
    ...unknown
  } = value as Record<string, unknown>
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
