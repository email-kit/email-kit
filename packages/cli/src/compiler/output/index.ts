import type { SenderValues } from "@email-kit/core/internal"

import { localeData } from "../../i18n/locales.ts"
import type { Theme } from "../../theme/theme.ts"
import { VERSION } from "../../version.ts"
import { toJavaScript } from "../emit/javascript.ts"
import { generateMessageTypes } from "../emit/messages.ts"
import { generateModule, type ModuleOptions, moduleHeader } from "../emit/module.ts"
import type { CompiledTemplate } from "../project/index.ts"

import { describe, GENERATED, json, type ManifestTemplate, manifestFile } from "./manifest.ts"

export { type WriteResult, writeOutput } from "./write.ts"

/** A file of the output folder. */
export interface OutputFile {
  /** Relative to the output folder, with `/` separators. */
  readonly path: string
  readonly content: string
}

/** The config settings that shape the output. */
export interface OutputOptions {
  readonly locales: readonly string[]
  readonly localeFallback?: Readonly<Record<string, string>>
  /** The config file's name, for the generated header. */
  readonly configFile: string
  readonly module: "ts" | "mjs"
  readonly perTemplateEntries: boolean
  readonly validate: boolean
  readonly sender: SenderValues
  /** The theme, to write theme.json. */
  readonly theme?: Theme | undefined
}

/**
 * Every file of the output folder, sorted by path:
 * - for each template, `schema.json`, then a `.html` and a `.txt` for each locale;
 * - the module (`index.ts`, or `index.mjs` with `index.d.mts`) and `messages.d.ts`;
 * - with `perTemplateEntries`, the module again in each template's folder, with that template
 *   alone, from the same generator, so every entry has the same API and stands alone;
 * - `theme.json`, when the theme is emitted;
 * - `manifest.json`, which lists all of them.
 *
 * The `.html` and `.txt` files are the exact email parts, so they have no "generated" header; the
 * JSON files have it as `$comment`.
 */
export function buildOutput(
  templates: readonly CompiledTemplate[],
  options: OutputOptions,
): OutputFile[] {
  const moduleOptions: ModuleOptions = {
    version: VERSION,
    locales: options.locales,
    localeData: localeData(options.locales, options.localeFallback),
    configFile: options.configFile,
    context: options.sender.runtime,
    validate: options.validate,
  }
  const outputs = templates.map(templateOutput)
  const files = outputs.flatMap((output) => output.files)
  files.push(...moduleFiles("", templates, options.module, moduleOptions))
  files.push({
    path: "messages.d.ts",
    content: generateMessageTypes(templates, moduleHeader(moduleOptions)),
  })
  if (options.perTemplateEntries) {
    for (const template of templates) {
      files.push(...moduleFiles(`${template.id}/`, [template], options.module, moduleOptions))
    }
  }
  if (options.theme) files.push(themeFile(options.theme))
  const entries = outputs.map((output) => output.entry)
  files.push(
    manifestFile(
      entries,
      files.map((file) => file.path),
      options,
    ),
  )
  return files.sort((a, b) => (a.path < b.path ? -1 : 1))
}

/** A template's files, and its entry in the manifest. */
function templateOutput(template: CompiledTemplate): {
  files: OutputFile[]
  entry: ManifestTemplate
} {
  const { $schema, ...schema } = template.jsonSchema
  const files: OutputFile[] = [
    {
      path: `${template.id}/schema.json`,
      content: json({ $schema, $comment: GENERATED, ...schema }),
    },
  ]
  const locales: Record<string, unknown> = {}
  for (const email of template.emails) {
    const html = { path: `${template.id}/${email.locale}.html`, content: email.html }
    const text = { path: `${template.id}/${email.locale}.txt`, content: email.text }
    files.push(html, text)
    locales[email.locale] = {
      subject: email.subject,
      preheader: email.preheader,
      html: describe(html),
      text: describe(text),
    }
  }
  const entry: ManifestTemplate = {
    id: template.id,
    purpose: template.purpose,
    property: template.identifiers.property,
    schema: `${template.id}/schema.json`,
    locales,
  }
  return { files, entry }
}

/**
 * The module for `templates`, in `folder`: `index.ts`, or for `mjs` the same code as
 * `index.mjs` with its types in `index.d.mts`.
 */
function moduleFiles(
  folder: string,
  templates: readonly CompiledTemplate[],
  format: "ts" | "mjs",
  options: ModuleOptions,
): OutputFile[] {
  const typescript = generateModule(templates, options)
  if (format === "ts") return [{ path: `${folder}index.ts`, content: typescript }]
  const { js, dts } = toJavaScript(typescript, moduleHeader(options))
  return [
    { path: `${folder}index.mjs`, content: js },
    { path: `${folder}index.d.mts`, content: dts },
  ]
}

/** theme.json: the resolved theme, without its source files, and dark roles only when set. */
function themeFile(theme: Theme): OutputFile {
  const { files: _files, roles, ...rest } = theme
  return {
    path: "theme.json",
    content: json({
      $comment: GENERATED,
      ...rest,
      roles: { light: roles.light, ...(roles.dark && { dark: roles.dark }) },
    }),
  }
}
