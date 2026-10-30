// Compiles every template in a project, for every locale (BLD-01, I18N-02). Problems are
// collected across all templates, so one run reports all of them.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { basename, join, relative } from "node:path"

import type { Purpose, StandardSchemaV1 } from "@email-kit/core"
import { EmailKitError, isEmailKitError } from "@email-kit/core/internal"
import type { Theme } from "../theme/theme.ts"
import { type CompiledEmail, compileEmail } from "./compile.ts"
import type { ResolvedConfig } from "./config.ts"
import { assertUniqueIdentifiers, type Identifiers, identifiersFor } from "./emit/identifiers.ts"
import { validateFixtures } from "./fixtures.ts"
import { loadTemplate } from "./load.ts"
import { CompileError, type Problem, toProblem } from "./problems.ts"
import { type Field, readSchema } from "./schema.ts"

export { CompileError, type Problem } from "./problems.ts"

export interface CompiledTemplate {
  readonly id: string
  readonly file: string
  readonly purpose: Purpose
  readonly identifiers: Identifiers
  /** The portable data model, from the schema */
  readonly model: Field
  /** The canonical JSON Schema 2020-12 */
  readonly jsonSchema: Readonly<Record<string, unknown>>
  /** One compiled email per locale, in config order (the default first) */
  readonly emails: readonly CompiledEmail[]
  /** Every source file bundled into the template */
  readonly sources: readonly string[]
  /** The default locale's messages, for the generated t() types (P1-159) */
  readonly messages: Readonly<Record<string, string>>
  /** The fixtures from defineEmail(), validated against the schema */
  readonly fixtures: Readonly<Record<string, unknown>>
  /** The schema, for validating generated fixture variants */
  readonly schema: StandardSchemaV1
}

export async function compileProject(
  config: ResolvedConfig,
  theme?: Theme,
): Promise<readonly CompiledTemplate[]> {
  if (!isDirectory(config.templates)) {
    throw new EmailKitError(
      "no-templates-folder",
      `The templates folder ${relative(config.dir, config.templates)} doesn't exist. Create it, ` +
        `or set "templates" in ${basename(config.file)}`,
    )
  }
  const files = readdirSync(config.templates)
    .filter((name) => name.endsWith(".tsx") && !name.startsWith("_"))
    .sort()
    .map((name) => join(config.templates, name))

  const problems: Problem[] = []
  const templates: CompiledTemplate[] = []
  for (const file of files) {
    try {
      templates.push(await compileTemplate(file, config, theme))
    } catch (error) {
      problems.push(toProblem(error, file, config.dir))
    }
  }

  const byId = new Map<string, CompiledTemplate>()
  for (const template of templates) {
    const first = byId.get(template.id)
    if (first) {
      problems.push({
        file: relative(config.dir, template.file),
        code: "duplicate-id",
        message: `The id "${template.id}" is already used by ${relative(config.dir, first.file)}`,
      })
    } else {
      byId.set(template.id, template)
    }
  }
  try {
    assertUniqueIdentifiers([...byId.keys()])
  } catch (error) {
    problems.push(toProblem(error, config.templates, config.dir))
  }

  if (problems.length > 0) throw new CompileError(problems)
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

async function compileTemplate(
  file: string,
  config: ResolvedConfig,
  theme: Theme | undefined,
): Promise<CompiledTemplate> {
  const { definition, files } = await loadTemplate(file, { cacheDir: config.cacheDir })
  const schema = await readSchema(definition.schema, { resolveFrom: file })
  if (schema.issues.length > 0 || !schema.model || !schema.jsonSchema) {
    throw new EmailKitError(
      "schema-not-portable",
      `The schema isn't portable (R4):\n${schema.issues
        .map((issue) => `  • ${issue.path ? `${issue.path}: ` : ""}${issue.message}`)
        .join("\n")}`,
    )
  }
  await validateFixtures(definition.schema, definition.fixtures ?? {}, definition.id)
  const emails = config.locales.map((locale) => {
    const messagesFile = join(config.messages, locale, `${definition.id}.json`)
    try {
      return compileEmail(definition, {
        locale,
        messages: readMessages(messagesFile),
        platform: config.platform,
        ...(schema.model && { model: schema.model }),
        ...(theme && { theme }),
      })
    } catch (error) {
      if (isEmailKitError(error) && error.code === "missing-message") {
        // Amend rather than wrap: the original stack points at the t() call in the template.
        error.message = `${error.message}: add it to ${relative(config.dir, messagesFile)}`
      }
      throw error
    }
  })
  return {
    id: definition.id,
    file,
    purpose: definition.purpose,
    identifiers: identifiersFor(definition.id),
    model: schema.model,
    jsonSchema: schema.jsonSchema,
    emails,
    sources: files,
    fixtures: definition.fixtures ?? {},
    messages: readMessages(
      join(config.messages, config.locales[0] as string, `${definition.id}.json`),
    ),
    schema: definition.schema,
  }
}

// Flat `{ "key": "ICU message" }` files. A missing file means no messages for that locale.
function readMessages(file: string): Record<string, string> {
  if (!existsSync(file)) return {}
  let messages: unknown
  try {
    messages = JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    throw new EmailKitError(
      "invalid-messages",
      `${file} isn't valid JSON: ${(error as Error).message}`,
    )
  }
  if (typeof messages !== "object" || messages === null || Array.isArray(messages)) {
    throw new EmailKitError(
      "invalid-messages",
      `${file} must be an object of "key": "message" pairs`,
    )
  }
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value !== "string") {
      throw new EmailKitError("invalid-messages", `${file}: "${key}" must be a string message`)
    }
  }
  return messages as Record<string, string>
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}
