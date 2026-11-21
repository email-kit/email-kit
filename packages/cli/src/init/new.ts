import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join, relative } from "node:path"

import { EmailKitError, isTemplateId } from "@email-kit/core/internal"

import { loadConfig } from "../compiler/config/index.ts"
import { identifiersFor } from "../compiler/emit/identifiers.ts"
import {
  messagesFile,
  readLayout,
  TEMPLATE_FILE,
  templateFolder,
} from "../compiler/project/layout.ts"
import { isPseudo } from "../i18n/pseudo.ts"
import { JSX_PRAGMA, needsPragma } from "../jsx.ts"
import { findProject, type SchemaLibrary, schemaLibraryOf } from "./detect.ts"
import { schemaSource } from "./scaffold.ts"

/**
 * `email-kit new <id>`: adds a template folder, `<root>/<id>/`, with `template.tsx`, its messages
 * in every locale and a fixture. The id must follow the id grammar. A folder already named by the
 * id is refused, never overwritten.
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
  const folder = templateFolder(config.root, id)
  if (existsSync(folder)) {
    throw new EmailKitError(
      "duplicate-id",
      `The template "${id}" exists (${rel(folder)}). Choose another id.`,
    )
  }
  const library = schemaLibrary(config)
  const templateFile = join(folder, TEMPLATE_FILE)
  const locales = config.locales.filter((locale) => !isPseudo(locale))
  const messageFiles = locales.map((locale) => messagesFile(folder, locale))

  mkdirSync(folder, { recursive: true })
  writeFileSync(templateFile, template(id, library, needsPragma(folder)))
  for (const file of messageFiles) writeFileSync(file, MESSAGES)
  const property = identifiersFor(id).property
  const from = config.importPath ?? `./${basename(config.root)}`
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

/** The library the other templates import, else the one the project depends on, else Zod. */
function schemaLibrary(config: Parameters<typeof readLayout>[0]): SchemaLibrary {
  const templates = existsSync(config.root) ? readLayout(config).templates : []
  const imported = templates
    .map(
      (file) =>
        /from\s+["'](zod|valibot|arktype)["']/.exec(readFileSync(file, "utf8"))?.[1] as
          | SchemaLibrary
          | undefined,
    )
    .find((library) => library !== undefined)
  if (imported) return imported
  try {
    const pkg = JSON.parse(readFileSync(join(findProject(config.dir), "package.json"), "utf8"))
    return schemaLibraryOf(pkg) ?? "zod"
  } catch {
    return "zod"
  }
}

/**
 * The new template: a heading, some copy and the footer, with a `name` field in its schema. With
 * `pragma` it starts with the JSX pragma, for a tsconfig that doesn't make email-kit's JSX the
 * default.
 */
function template(id: string, library: SchemaLibrary, pragma: boolean): string {
  const { import: schemaImport, schema } = schemaSource(library, [{ name: "name", kind: "text" }])
  return `${pragma ? `${JSX_PRAGMA}\n` : ""}import { Footer, Heading, Text } from "@email-kit/components"
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
