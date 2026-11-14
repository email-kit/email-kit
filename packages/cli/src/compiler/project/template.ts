import type { StandardSchemaV1 } from "@email-kit/core"
import { EmailKitError, isEmailKitError } from "@email-kit/core/internal"

import { isPseudo, PSEUDO_LOCALES, pseudoMessages } from "../../i18n/pseudo.ts"
import { relativePath } from "../../paths.ts"
import type { Theme } from "../../theme/theme.ts"
import { type CompiledEmail, compileEmail } from "../compile.ts"
import type { ResolvedConfig } from "../config/index.ts"
import { identifiersFor } from "../emit/identifiers.ts"
import { validateFixtures } from "../fixtures.ts"
import { loadTemplate } from "../load/index.ts"
import { type Field, readSchema } from "../schema.ts"

import type { CompiledTemplate, PseudoBuild } from "./index.ts"
import { type Catalogue, readCatalogues } from "./messages.ts"

/**
 * Compiles one template in every locale: loads it, checks its schema can be described portably
 * and its fixtures match it, then renders each locale from its messages. A pseudo-locale in
 * `locales` is made from the default locale's messages. With `pseudo`, the pseudo-locales that
 * don't ship are also built for `check`, where a failure becomes a finding rather than stopping
 * the compile.
 */
export async function compileTemplate(
  file: string,
  config: ResolvedConfig,
  theme: Theme | undefined,
  pseudo: boolean,
): Promise<CompiledTemplate> {
  const { definition, files } = await loadTemplate(file, { cacheDir: config.cacheDir })
  const { model, jsonSchema } = await portableSchema(definition.schema, file)
  const fixtures = definition.fixtures ?? {}
  await validateFixtures(definition.schema, fixtures, definition.id)
  const catalogues = readCatalogues(config, definition.id)
  const defaults = catalogues[0]?.messages ?? {}
  const compileLocale = (locale: string, messages: Readonly<Record<string, string>>) =>
    compileEmail(definition, {
      locale,
      messages,
      sender: config.sender,
      model,
      ...(theme && { theme }),
    })
  const fromDefaults = (locale: string) => compileLocale(locale, pseudoMessages(defaults, locale))
  const emails = config.locales.map((locale) => {
    if (isPseudo(locale)) return fromDefaults(locale)
    const catalogue = catalogues.find((c) => c.locale === locale) as Catalogue
    try {
      return compileLocale(locale, catalogue.messages)
    } catch (error) {
      throw withMessagesFile(error, catalogue.file, config.dir)
    }
  })
  return {
    id: definition.id,
    file,
    purpose: definition.purpose,
    identifiers: identifiersFor(definition.id),
    model,
    jsonSchema,
    emails,
    sources: files,
    pseudo: pseudo ? pseudoBuilds(config.locales, fromDefaults) : [],
    localeMessages: catalogues,
    messages: defaults,
    fixtures,
    schema: definition.schema,
  }
}

/**
 * The schema's portable model and JSON Schema. A schema that can't be described in the portable
 * subset fails the template, listing why.
 */
async function portableSchema(
  schema: StandardSchemaV1,
  file: string,
): Promise<{ model: Field; jsonSchema: Readonly<Record<string, unknown>> }> {
  const { issues, model, jsonSchema } = await readSchema(schema, { resolveFrom: file })
  if (issues.length > 0 || !model || !jsonSchema) {
    const list = issues.map((issue) => `  • ${issue.path ? `${issue.path}: ` : ""}${issue.message}`)
    throw new EmailKitError("schema-not-portable", `The schema isn't portable:\n${list.join("\n")}`)
  }
  return { model, jsonSchema }
}

/**
 * Adds the messages file to a missing message's error. The error object is kept, so its stack
 * still points at the `t()` call.
 */
function withMessagesFile(error: unknown, file: string, projectDir: string): unknown {
  if (isEmailKitError(error) && error.code === "missing-message") {
    error.message = `${error.message}: add it to ${relativePath(projectDir, file)}`
  }
  return error
}

/** The pseudo-locales that don't ship, built in memory for `check`, each an email or an error. */
function pseudoBuilds(
  locales: readonly string[],
  compile: (locale: string) => CompiledEmail,
): PseudoBuild[] {
  return PSEUDO_LOCALES.filter((locale) => !locales.includes(locale)).map((locale) => {
    try {
      return { locale, email: compile(locale) }
    } catch (error) {
      return { locale, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
