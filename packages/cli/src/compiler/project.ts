// Compiles every template in a project, for every locale (BLD-01, I18N-02). Problems are
// collected across all templates, so one run reports all of them.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { basename, join, relative } from "node:path"

import type { Purpose } from "@email-kit/core"
import { EmailKitError } from "@email-kit/core/internal"

import { type CompiledEmail, compileEmail } from "./compile.ts"
import type { ResolvedConfig } from "./config.ts"
import { assertUniqueIdentifiers, type Identifiers, identifiersFor } from "./emit/identifiers.ts"
import { loadTemplate } from "./load.ts"
import { type Field, readSchema } from "./schema.ts"

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
}

export interface Problem {
  readonly file: string
  readonly code: string
  readonly message: string
}

/** One or more problems that stopped the compile. */
export class CompileError extends Error {
  readonly problems: readonly Problem[]

  constructor(problems: readonly Problem[]) {
    super(problems.map((p) => `${p.file}: ${p.message}`).join("\n"))
    this.name = "CompileError"
    this.problems = problems
  }
}

export async function compileProject(config: ResolvedConfig): Promise<readonly CompiledTemplate[]> {
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
      templates.push(await compileTemplate(file, config))
    } catch (error) {
      problems.push(toProblem(relative(config.dir, file), error))
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
    problems.push(toProblem(relative(config.dir, config.templates), error))
  }

  if (problems.length > 0) throw new CompileError(problems)
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

async function compileTemplate(file: string, config: ResolvedConfig): Promise<CompiledTemplate> {
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
  const emails = config.locales.map((locale) => {
    const messagesFile = join(config.messages, locale, `${definition.id}.json`)
    try {
      return compileEmail(definition, { locale, messages: readMessages(messagesFile) })
    } catch (error) {
      if (error instanceof EmailKitError && error.code === "missing-message") {
        throw new EmailKitError(
          error.code,
          `${error.message}: add it to ${relative(config.dir, messagesFile)}`,
        )
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

function toProblem(file: string, error: unknown): Problem {
  if (error instanceof EmailKitError) return { file, code: error.code, message: error.message }
  const message = error instanceof Error ? error.message : String(error)
  return { file, code: "load-failed", message: message.split("\n").slice(0, 6).join("\n") }
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}
