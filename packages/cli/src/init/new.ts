// `email-kit new <id>` (P1-211, CLI-02): a template with its messages in every locale and a
// fixture. The id follows the grammar, and an id that exists is refused, never overwritten.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"

import { EmailKitError } from "@email-kit/core/internal"

import { loadConfig } from "../compiler/config.ts"
import { identifiersFor } from "../compiler/emit/identifiers.ts"
import { isPseudo } from "../i18n/pseudo.ts"

const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export async function newTemplate(
  id: string,
  options: { readonly cwd: string; readonly config?: string | undefined },
): Promise<string> {
  if (!ID.test(id)) {
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

  // An id in use: the file, its messages, or another template that declares it.
  const taken = [templateFile, ...messageFiles].find((file) => existsSync(file))
  const declared = existsSync(config.templates)
    ? readdirSync(config.templates).find((file) =>
        new RegExp(`\\bid:\\s*["']${id}["']`).test(
          readFileSync(join(config.templates, file), "utf8"),
        ),
      )
    : undefined
  if (taken || declared) {
    throw new EmailKitError(
      "duplicate-id",
      `The template "${id}" exists (${rel(taken ?? join(config.templates, declared as string))}). Choose another id.`,
    )
  }

  mkdirSync(config.templates, { recursive: true })
  writeFileSync(templateFile, template(id))
  for (const file of messageFiles) {
    mkdirSync(join(file, ".."), { recursive: true })
    writeFileSync(file, MESSAGES)
  }
  const property = identifiersFor(id).property
  const from = config.importPath ?? `./${rel(join(config.templates, "..")).split("/").at(-1)}`
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

const MESSAGES = `${JSON.stringify(
  {
    subject: "A message for {name}",
    heading: "Hello, {name}",
    body: "Write this email's copy here.",
  },
  null,
  2,
)}\n`

function template(id: string): string {
  return `/** @jsxImportSource @email-kit/core */
import { Heading, Text } from "@email-kit/components"
import { defineEmail } from "@email-kit/core"
import { z } from "zod"

export default defineEmail({
  id: ${JSON.stringify(id)},
  purpose: "transactional",
  schema: z.object({
    name: z.string().min(1),
  }),
  subject: (data, t) => t("subject", { name: data.name }),
  fixtures: {
    default: { name: "Ada" },
  },
  component: ({ data, t }) => (
    <>
      <Heading>{t("heading", { name: data.name })}</Heading>
      <Text>{t("body")}</Text>
    </>
  ),
})
`
}
