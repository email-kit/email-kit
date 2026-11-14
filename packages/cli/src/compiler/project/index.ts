import { readdirSync } from "node:fs"
import { basename, join } from "node:path"

import type { Purpose, StandardSchemaV1 } from "@email-kit/core"
import { EmailKitError } from "@email-kit/core/internal"

import { isDirectory, relativePath } from "../../paths.ts"
import type { Theme } from "../../theme/theme.ts"
import type { CompiledEmail } from "../compile.ts"
import type { ResolvedConfig } from "../config/index.ts"
import { assertUniqueIdentifiers, type Identifiers } from "../emit/identifiers.ts"
import { CompileError, type Problem, toProblem } from "../problems/index.ts"
import type { Field } from "../schema/index.ts"

import type { Catalogue } from "./messages.ts"
import { compileTemplate } from "./template.ts"

export { CompileError, type Problem } from "../problems/index.ts"

/** A template compiled in every locale, with what the output and the checks need. */
export interface CompiledTemplate {
  /** The id from `defineEmail()`, which names its folder in the output. */
  readonly id: string
  /** The template file. */
  readonly file: string
  readonly purpose: Purpose
  /** Its names in the generated module, such as `orderConfirmation`. */
  readonly identifiers: Identifiers
  /** The portable data model, read from the schema. */
  readonly model: Field
  /** The canonical JSON Schema 2020-12. */
  readonly jsonSchema: Readonly<Record<string, unknown>>
  /** One compiled email per locale, in config order, the default first. */
  readonly emails: readonly CompiledEmail[]
  /** Every source file bundled into the template. */
  readonly sources: readonly string[]
  /** The pseudo-locales `check` built in memory, when it asked for them. */
  readonly pseudo: readonly PseudoBuild[]
  /** Each real locale's messages and their file, for the `i18n.*` checks. */
  readonly localeMessages: readonly Catalogue[]
  /** The default locale's messages, for the generated `t()` types. */
  readonly messages: Readonly<Record<string, string>>
  /** The fixtures from `defineEmail()`, validated against the schema. */
  readonly fixtures: Readonly<Record<string, unknown>>
  /** The schema, for validating generated fixture variants. */
  readonly schema: StandardSchemaV1
}

/** A pseudo-locale built for `check`: the email, or why it didn't compile. */
export interface PseudoBuild {
  readonly locale: string
  readonly email?: CompiledEmail
  /** Why this template didn't compile in the pseudo-locale, for `i18n.expansion`. */
  readonly error?: string
}

/**
 * Compiles every template in every locale, sorted by id. Problems are collected across all
 * templates, so one run reports all of them, and nothing is returned while there are any.
 */
export async function compileProject(
  config: ResolvedConfig,
  theme?: Theme,
  options: { readonly pseudo?: boolean } = {},
): Promise<readonly CompiledTemplate[]> {
  const problems: Problem[] = []
  const templates: CompiledTemplate[] = []
  for (const file of templateFiles(config)) {
    try {
      templates.push(await compileTemplate(file, config, theme, options.pseudo === true))
    } catch (error) {
      problems.push(toProblem(error, file, config.dir))
    }
  }
  const unique = uniqueIds(templates, config.dir, problems)
  try {
    assertUniqueIdentifiers(unique.map((template) => template.id))
  } catch (error) {
    problems.push(toProblem(error, config.templates, config.dir))
  }
  if (problems.length > 0) throw new CompileError(problems)
  return unique.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * The template files: each `.tsx` directly in the templates folder, by name. A file starting
 * with `_` is a shared part that templates import, not a template.
 */
function templateFiles(config: ResolvedConfig): string[] {
  if (!isDirectory(config.templates)) {
    throw new EmailKitError(
      "no-templates-folder",
      `The templates folder ${relativePath(config.dir, config.templates)} doesn't exist. ` +
        `Create it, or set "templates" in ${basename(config.file)}`,
    )
  }
  return readdirSync(config.templates)
    .filter((name) => name.endsWith(".tsx") && !name.startsWith("_"))
    .sort()
    .map((name) => join(config.templates, name))
}

/** The templates with distinct ids. Each later one with a taken id becomes a problem. */
function uniqueIds(
  templates: readonly CompiledTemplate[],
  projectDir: string,
  problems: Problem[],
): CompiledTemplate[] {
  const byId = new Map<string, CompiledTemplate>()
  for (const template of templates) {
    const first = byId.get(template.id)
    if (!first) {
      byId.set(template.id, template)
      continue
    }
    problems.push({
      file: relativePath(projectDir, template.file),
      code: "duplicate-id",
      message: `The id "${template.id}" is already used by ${relativePath(projectDir, first.file)}`,
    })
  }
  return [...byId.values()]
}
