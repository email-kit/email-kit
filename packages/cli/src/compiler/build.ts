// `email-kit compile`: config → every template × locale → the output folder (P1-087).

import { basename, relative } from "node:path"

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
}

export async function compile(options: CompileOptions): Promise<CompileResult> {
  const config = await loadConfig(options)
  const templates = await compileProject(config)
  const output = buildOutput(templates, {
    locales: config.locales,
    configFile: basename(config.file),
  })
  return { config, templates, files: writeOutput(config.out, output) }
}

/** One line for the terminal (CLI-03). */
export function summarize({ config, templates, files }: CompileResult): string {
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
  const total = files.written.length + files.unchanged.length
  return (
    `Compiled ${count(templates.length, "template")} × ${count(config.locales.length, "locale")} ` +
    `into ${relative(config.dir, config.out) || "."} ` +
    `(${count(total, "file")}: ${files.written.length} written, ${files.unchanged.length} unchanged, ` +
    `${files.deleted.length} removed)`
  )
}
