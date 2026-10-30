// `email-kit compile`: config → every template × locale → the output folder (P1-087).

import { basename, relative } from "node:path"

import { loadTheme, type Theme } from "../theme/theme.ts"
import { type TokenFinding, validateTheme } from "../theme/validate.ts"
import { loadConfig, type ResolvedConfig } from "./config.ts"
import { buildOutput, type WriteResult, writeOutput } from "./output.ts"
import { type CompiledTemplate, compileProject } from "./project.ts"

export interface CompileOptions {
  /** Where to look for email-kit.config.ts */
  readonly cwd: string
  /** An explicit config file, relative to `cwd` */
  readonly config?: string | undefined
}

export interface CompileResult {
  readonly config: ResolvedConfig
  readonly templates: readonly CompiledTemplate[]
  readonly files: WriteResult
  readonly theme: Theme
  /** tokens.* findings; `email-kit tokens` lists them, `check` will gate on them (M1.4) */
  readonly themeFindings: readonly TokenFinding[]
}

export async function compile(options: CompileOptions): Promise<CompileResult> {
  return compileWithConfig(await loadConfig(options))
}

/** Compiles with an already loaded config. */
export async function compileWithConfig(config: ResolvedConfig): Promise<CompileResult> {
  // Every theme permutation is resolved and validated on compile (THM-10).
  const theme = loadTheme(config.theme, config.dir)
  const themeFindings = validateTheme(theme)
  const templates = await compileProject(config)
  const output = buildOutput(templates, {
    locales: config.locales,
    configFile: basename(config.file),
    module: config.module,
    perTemplateEntries: config.perTemplateEntries,
    validate: config.validate,
    platform: config.platform,
    theme: config.theme?.emit ? theme : undefined,
  })
  return { config, templates, files: writeOutput(config.out, output), theme, themeFindings }
}

/** One line for the terminal (CLI-03). */
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

/** `--verbose`: every template × locale with its sizes, then the files that changed (CLI-07). */
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
