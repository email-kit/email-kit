import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

import type { CheckSetting, CustomCheck, ThemeConfig } from "@email-kit/core"
import { EmailKitError, type SenderValues } from "@email-kit/core/internal"

import { loadModule } from "../load.ts"

import { readChecks, readCustomChecks } from "./checks.ts"
import { readLocales } from "./locales.ts"
import { nearestNodeModules, readPaths } from "./paths.ts"
import { readSender } from "./sender.ts"
import { checkKeys, isRecord, type Problems } from "./shared.ts"
import { readTheme } from "./theme.ts"

/** A loaded and validated config, with every path absolute and every default filled in. */
export interface ResolvedConfig {
  /** The config file. */
  readonly file: string
  /** The folder holding the config file. Every configured path is relative to it. */
  readonly dir: string
  /** The email-kit folder. Defaults to `src/email-kit`, or `email-kit` without a `src` folder. */
  readonly root: string
  /** The template files' folder. Defaults to `<root>/templates`. */
  readonly templates: string
  /** The message catalogues' folder. Defaults to `<root>/messages`. */
  readonly messages: string
  /** The output folder the compiler owns. Defaults to `<root>/compiled`. */
  readonly out: string
  /** Every locale to compile, the default first. */
  readonly locales: readonly string[]
  /** `locales.fallback`: each requested tag, and the compiled locale it goes to. */
  readonly localeFallback: Readonly<Record<string, string>>
  /** The generated module's format. */
  readonly module: "ts" | "mjs"
  /** Whether to also write an `<out>/<id>/index.*` for each template. */
  readonly perTemplateEntries: boolean
  /** Whether `render()` validates data first. */
  readonly validate: boolean
  /** Sender values: compile-time constants, and the keys passed at send time. */
  readonly sender: SenderValues
  /** The theme config, which `loadTheme()` resolves. */
  readonly theme: ThemeConfig | undefined
  /** The level set for each check, with its reason. */
  readonly checks: Readonly<Record<string, CheckSetting>>
  /** The project's own checks, from `defineCheck()`. */
  readonly customChecks: readonly CustomCheck[]
  /** How the app imports the emails. A relative path when `init` didn't record one. */
  readonly importPath: string | undefined
  /** Where loaded modules are bundled to, inside the project so packages resolve. */
  readonly cacheDir: string
}

/** The config file names `loadConfig` looks for, in order. */
export const CONFIG_FILES: readonly string[] = [
  "email-kit.config.ts",
  "email-kit.config.mts",
  "email-kit.config.js",
  "email-kit.config.mjs",
]

/** The top-level config options. */
const KEYS: readonly string[] = [
  ...["root", "templates", "messages", "out", "module", "perTemplateEntries", "validate"],
  ...["sender", "theme", "locales", "checks", "customChecks", "importPath"],
]

/**
 * Finds the config file, or uses `config`, then loads and validates it. It's loaded with the same
 * bundler as templates, so there's one TypeScript loader for everything.
 */
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

/**
 * Validates a loaded config value and resolves its paths and defaults. Each section is read by its
 * own module, which adds what's wrong to one list, so the error shows every problem at once.
 */
export function resolveConfig(
  value: unknown,
  { file, cacheDir }: { readonly file: string; readonly cacheDir: string },
): ResolvedConfig {
  if (!isRecord(value)) {
    throw new EmailKitError(
      "invalid-config",
      `${file} must have \`export default defineConfig({ … })\``,
    )
  }
  
  const problems: Problems = []
  checkKeys(value, KEYS, "", problems)
  const dir = dirname(file)
  const paths = readPaths(value, dir, problems)
  const module = readModule(value.module, problems)
  const importPath = readImportPath(value.importPath, problems)
  const perTemplateEntries = readBoolean(value, "perTemplateEntries", false, problems)
  const validate = readBoolean(value, "validate", true, problems)
  const sender = readSender(value.sender, problems)
  const theme = readTheme(value.theme, problems)
  const customChecks = readCustomChecks(value.customChecks, problems)
  const checks = readChecks(value.checks, customChecks, problems)
  const { locales, localeFallback } = readLocales(value.locales, problems)
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
    ...paths,
    locales,
    localeFallback,
    module,
    perTemplateEntries,
    validate,
    sender,
    theme,
    checks,
    customChecks,
    importPath,
    cacheDir,
  }
}

/** Reads `module`: `"ts"` (the default) or `"mjs"`. */
function readModule(value: unknown, problems: Problems): "ts" | "mjs" {
  if (value === undefined || value === "ts" || value === "mjs") return value ?? "ts"
  problems.push(`module: must be "ts" or "mjs", not ${JSON.stringify(value)}`)
  return "ts"
}

/** Reads a true/false option, or gives `fallback` when it's left out. */
function readBoolean(
  config: Record<string, unknown>,
  key: string,
  fallback: boolean,
  problems: Problems,
): boolean {
  const value = config[key] ?? fallback
  if (typeof value === "boolean") return value
  problems.push(`${key}: must be true or false`)
  return fallback
}

/** Reads `importPath`, how the app imports the emails, such as `"@/email-kit"`. */
function readImportPath(value: unknown, problems: Problems): string | undefined {
  if (value === undefined || (typeof value === "string" && value !== "")) return value
  problems.push('importPath: must be how your app imports the emails, such as "@/email-kit"')
  return undefined
}
