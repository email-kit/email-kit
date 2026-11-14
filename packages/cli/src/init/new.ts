import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, join, relative } from "node:path"

import { EmailKitError, isTemplateId } from "@email-kit/core/internal"

import { loadConfig } from "../compiler/config/index.ts"
import { identifiersFor } from "../compiler/emit/identifiers.ts"
import { isPseudo } from "../i18n/pseudo.ts"
import { findProject, type SchemaLibrary, schemaLibraryOf } from "./detect.ts"
import { schemaSource } from "./scaffold.ts"

/**
 * `email-kit new <id>`: adds a template, with its messages in every locale and a fixture. The id
 * must follow the id grammar. An id already in use, by a file, its messages or another template
 * that declares it, is refused, never overwritten.
 */
export async function newTemplate(
  id: string,
  options: { readonly cwd: string; readonly config?: string | undefined },
): Promise<string> {
  if (!isTemplateId(id)) {
    throw new EmailKitError(
      "invalid-id",
      `"${id}" isn't a template id: use lowercase words joined by hyphens, like "password-reset"`,
    )
  }
  const config = await loadConfig({ cwd: options.cwd, config: options.config })
  const rel = (path: string) => relative(config.dir, path)
  const templateFile = join(config.templates, `${id}.tsx`)
  const locales = config.locales.filter((locale) => !isPseudo(locale))
  const messageFiles = locales.map((locale) => join(config.messages, locale, `${id}.json`))

  const taken = [templateFile, ...messageFiles].find((file) => existsSync(file))
  const declares = new RegExp(`\\bid:\\s*["']${id}["']`)
  const declared = templateSources(config.templates).find((file) =>
    declares.test(readFileSync(join(config.templates, file), "utf8")),
  )
  if (taken || declared) {
    throw new EmailKitError(
      "duplicate-id",
      `The template "${id}" exists (${rel(taken ?? join(config.templates, declared as string))}). Choose another id.`,
    )
  }

  mkdirSync(config.templates, { recursive: true })
  writeFileSync(templateFile, template(id, schemaLibrary(config.dir, config.templates)))
  for (const file of messageFiles) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, MESSAGES)
  }
  const property = identifiersFor(id).property
  const from = config.importPath ?? `./${basename(dirname(config.templates))}`
  return [
    `Created ${rel(templateFile)}`,
    ...messageFiles.map((file, i) => `   and ${rel(file)}${i > 0 ? " (translate it)" : ""}`),
    "",
    "Compile, then render it:",
    "",
    `  import { emails } from "${from}"`,
    "",
    `  emails.${property}.render({ name: "Ada" })`,
  ].join("\n")
}

/** The new template's messages, written for every locale, for translators to replace. */
const MESSAGES = `${JSON.stringify(
  {
    subject: "A message for {name}",
    preheader: "Replace with the line the inbox shows after the subject",
    heading: "Hello, {name}",
    body: "Replace this with the email's copy: what happened, what the reader needs to do next, and by when.",
    footer: "You're receiving this email because you have an account with {product}.",
  },
  null,
  2,
)}\n`

/**
 * The files in the templates folder that can hold a template, by name: TypeScript and JavaScript
 * files, not folders. Missing folder, no files.
 */
function templateSources(templates: string): string[] {
  if (!existsSync(templates)) return []
  return readdirSync(templates, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name))
    .map((entry) => entry.name)
}

/** The library the other templates import, else the one the project depends on, else Zod. */
function schemaLibrary(configDir: string, templates: string): SchemaLibrary {
  const imported = templateSources(templates)
    .map(
      (file) =>
        /from\s+["'](zod|valibot|arktype)["']/.exec(
          readFileSync(join(templates, file), "utf8"),
        )?.[1] as SchemaLibrary | undefined,
    )
    .find((library) => library !== undefined)
  if (imported) return imported
  try {
    const pkg = JSON.parse(readFileSync(join(findProject(configDir), "package.json"), "utf8"))
    return schemaLibraryOf(pkg) ?? "zod"
  } catch {
    return "zod"
  }
}

/** The new template: a heading, some copy and the footer, with a `name` field in its schema. */
function template(id: string, library: SchemaLibrary): string {
  const { import: schemaImport, schema } = schemaSource(library, [{ name: "name", kind: "text" }])
  return `/** @jsxImportSource @email-kit/core */
import { Footer, Heading, Text } from "@email-kit/components"
import { defineEmail } from "@email-kit/core"
${schemaImport}

export default defineEmail({
  id: ${JSON.stringify(id)},
  purpose: "transactional",
${schema}
  subject: (data, t) => t("subject", { name: data.name }),
  preheader: (_data, t) => t("preheader"),
  fixtures: {
    default: { name: "Ada" },
  },
  component: ({ data, t, sender }) => (
    <>
      <Heading>{t("heading", { name: data.name })}</Heading>
      <Text>{t("body")}</Text>
      <Footer
        reason={t("footer", { product: sender.productName })}
        sender={sender.productName}
      />
    </>
  ),
})
`
}
