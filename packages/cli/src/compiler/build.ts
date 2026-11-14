import { basename, relative } from "node:path"
import { checkPermutations } from "../theme/check.ts"
import { loadTheme, type Theme } from "../theme/theme.ts"
import type { TokenFinding } from "../theme/validate/index.ts"
import { loadConfig, type ResolvedConfig } from "./config/index.ts"
import { buildOutput, type OutputFile, type WriteResult, writeOutput } from "./output/index.ts"
import { type CompiledTemplate, compileProject } from "./project/index.ts"

export interface CompileOptions {
  /** The folder to look for `email-kit.config.ts` in. */
  readonly cwd: string
  /** A config file to use instead, relative to `cwd`. */
  readonly config?: string | undefined
}

/** A project compiled in memory: what `compile` writes and what `check` inspects. */
export interface BuiltProject {
  readonly config: ResolvedConfig
  /** Every template, each with its email in every locale. */
  readonly templates: readonly CompiledTemplate[]
  /** The resolved theme. */
  readonly theme: Theme
  /** The theme's `tokens.*` findings. `email-kit tokens` lists them; `check` reports them. */
  readonly themeFindings: readonly TokenFinding[]
}

/** A compiled project and what writing it changed in the output folder. */
export interface CompileResult extends BuiltProject {
  /** The files written, left unchanged and removed. */
  readonly files: WriteResult
}

/** `email-kit compile`: loads the config, then compiles the project into its output folder. */
export async function compile(options: CompileOptions): Promise<CompileResult> {
  return compileWithConfig(await loadConfig(options))
}

/**
 * Compiles every template in every locale, in memory, after loading the theme and checking each of
 * its permutations. `compile` writes the result to the output folder, and `check` inspects it.
 * `pseudo` adds the pseudo-locales.
 */
export async function buildProject(
  config: ResolvedConfig,
  options: { readonly pseudo?: boolean } = {},
): Promise<BuiltProject> {
  const theme = loadTheme(config.theme, config.dir)
  const themeFindings = checkPermutations(theme, config.theme, config.dir)
  const templates = await compileProject(config, theme, options)
  return { config, templates, theme, themeFindings }
}

/** Every file a compile writes into the output folder, for `compile` and `output.drift`. */
export function outputFiles(project: BuiltProject): OutputFile[] {
  const { config, templates, theme } = project
  return buildOutput(templates, {
    locales: config.locales,
    localeFallback: config.localeFallback,
    configFile: basename(config.file),
    module: config.module,
    perTemplateEntries: config.perTemplateEntries,
    validate: config.validate,
    sender: config.sender,
    theme: config.theme?.emit ? theme : undefined,
  })
}

/** Compiles a project from a config that is already loaded, and writes it to the output folder. */
export async function compileWithConfig(config: ResolvedConfig): Promise<CompileResult> {
  const project = await buildProject(config)
  return { ...project, files: writeOutput(config.out, outputFiles(project)) }
}

/** The one-line summary `compile` prints. */
export function summarize({ config, templates, files, themeFindings }: CompileResult): string {
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
  const total = files.written.length + files.unchanged.length
  const errors = themeFindings.filter((f) => f.level === "error").length
  const warnings = themeFindings.filter((f) => f.level === "warning").length
  const theme =
    errors + warnings > 0
      ? `\nTheme: ${count(errors, "error")}, ${count(warnings, "warning")}. Run \`email-kit tokens\` for details.`
      : ""
  return (
    `Compiled ${count(templates.length, "template")} × ${count(config.locales.length, "locale")} ` +
    `into ${relative(config.dir, config.out) || "."} ` +
    `(${count(total, "file")}: ${files.written.length} written, ${files.unchanged.length} unchanged, ` +
    `${files.deleted.length} removed)${theme}`
  )
}

/** What `--verbose` prints: each template's size in each locale, then the files that changed. */
export function describeResult({ templates, files }: CompileResult): string {
  const kb = (text: string) => `${(Buffer.byteLength(text, "utf8") / 1024).toFixed(1)} KB`
  const width = Math.max(0, ...templates.map((t) => t.id.length))
  const lines: string[] = []
  for (const template of templates) {
    template.emails.forEach((email, index) => {
      const name = (index === 0 ? template.id : "").padEnd(width)
      lines.push(
        `  ${name}  ${email.locale.padEnd(5)}  html ${kb(email.html)}  text ${kb(email.text)}`,
      )
    })
  }
  for (const [label, paths] of [
    ["written", files.written],
    ["removed", files.deleted],
  ] as const) {
    if (paths.length > 0) lines.push(`  ${label}: ${paths.join(", ")}`)
  }
  return lines.join("\n")
}
