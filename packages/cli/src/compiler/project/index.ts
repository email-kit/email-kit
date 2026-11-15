import type { Purpose, StandardSchemaV1 } from "@email-kit/core"

import type { Theme } from "../../theme/theme.ts"
import type { CompiledEmail } from "../compile.ts"
import type { ResolvedConfig } from "../config/index.ts"
import { assertUniqueIdentifiers, type Identifiers } from "../emit/identifiers.ts"
import { CompileError, type Problem, toProblem } from "../problems/index.ts"
import type { Field } from "../schema/index.ts"

import { readLayout } from "./layout.ts"
import type { Catalogue } from "./messages.ts"
import { compileTemplate } from "./template.ts"

export { CompileError, type Problem } from "../problems/index.ts"

/** A template compiled in every locale, with what the output and the checks need. */
export interface CompiledTemplate {
  /** The id: its folder's name, which `defineEmail()` repeats. It names its folder in the output. */
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
 * templates, so one run reports all of them, and nothing is returned while there are any. Ids
 * are unique because each is its folder's name, which the compile checks.
 */
export async function compileProject(
  config: ResolvedConfig,
  theme?: Theme,
  options: { readonly pseudo?: boolean } = {},
): Promise<readonly CompiledTemplate[]> {
  const layout = readLayout(config)
  const problems: Problem[] = [...layout.problems]
  const templates: CompiledTemplate[] = []
  for (const file of layout.templates) {
    try {
      templates.push(await compileTemplate(file, config, theme, options.pseudo === true))
    } catch (error) {
      problems.push(toProblem(error, file, config.dir))
    }
  }
  try {
    assertUniqueIdentifiers(templates.map((template) => template.id))
  } catch (error) {
    problems.push(toProblem(error, config.root, config.dir))
  }
  if (problems.length > 0) throw new CompileError(problems)
  return templates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
