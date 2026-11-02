// The files `email-kit init` creates (INIT-03): the config, the folder's index.ts and a welcome
// template with its messages and fixture. Templates start with the JSX pragma (P0-05), so they
// type-check whatever the host's tsconfig says about JSX.

import type { SchemaLibrary } from "./detect.ts"

export type ImportStrategy =
  /** tsconfig paths work at runtime: Next.js, Bun, bundlers (ADR 0004) */
  | { readonly kind: "alias"; readonly path: string; readonly addPath: boolean }
  /** package.json "imports": a tsc build (G, .mjs output) or Node type stripping (C, .ts) */
  | { readonly kind: "subpath"; readonly target: string; readonly module: "mjs" | "ts" }
  | { readonly kind: "relative" }

export function configFile(options: {
  readonly root: string | undefined
  readonly importPath: string
  readonly module: "mjs" | "ts"
  readonly productName: string
  readonly theme: string | undefined
}): string {
  const lines = [
    ...(options.root ? [`  root: ${JSON.stringify(options.root)},`] : []),
    '  locales: { default: "en" },',
    ...(options.module === "mjs"
      ? [
          "  // The app runs compiled JavaScript: write index.mjs and index.d.mts.",
          '  module: "mjs",',
        ]
      : []),
    `  importPath: ${JSON.stringify(options.importPath)},`,
    `  platform: { productName: ${JSON.stringify(options.productName)} },`,
    ...(options.theme ? [`  theme: { source: ${JSON.stringify(options.theme)} },`] : []),
  ]
  return `import { defineConfig } from "@email-kit/core"

export default defineConfig({
${lines.join("\n")}
})
`
}

/** The folder's entry: what the app imports. */
export function indexFile(strategy: ImportStrategy): string {
  const target =
    strategy.kind === "subpath"
      ? strategy.module === "mjs"
        ? "./compiled/index.mjs"
        : "./compiled/index.ts"
      : "./compiled"
  return `// The emails, compiled by \`email-kit compile\` into ./compiled.\nexport * from "${target}"\n`
}

/** A schema field in a scaffolded template: required text, or a URL (the `url` marker). */
export interface ScaffoldField {
  readonly name: string
  readonly kind: "text" | "url"
}

const SCHEMA_SOURCE: Record<
  SchemaLibrary,
  {
    readonly import: string
    readonly open: string
    readonly field: Record<ScaffoldField["kind"], string>
  }
> = {
  zod: {
    import: 'import { z } from "zod"',
    open: "z.object",
    field: { text: "z.string().min(1)", url: "z.string().meta(url)" },
  },
  valibot: {
    import: 'import * as v from "valibot"',
    open: "v.object",
    field: {
      text: "v.pipe(v.string(), v.minLength(1))",
      url: "v.pipe(v.string(), v.metadata(url))",
    },
  },
  arktype: {
    import: 'import { type } from "arktype"',
    open: "type",
    field: { text: '"string > 0"', url: "type.string.configure(url)" },
  },
}

/** The schema library's import line and the `schema:` property for the fields. */
export function schemaSource(
  library: SchemaLibrary,
  fields: readonly ScaffoldField[],
): { readonly import: string; readonly schema: string } {
  const source = SCHEMA_SOURCE[library]
  return {
    import: source.import,
    schema: [
      `  schema: ${source.open}({`,
      ...fields.map((field) => `    ${field.name}: ${source.field[field.kind]},`),
      "  }),",
    ].join("\n"),
  }
}

/** What each library needs installed for email-kit to read its schemas. */
export function schemaDependencies(library: SchemaLibrary): Readonly<Record<string, string>> {
  return library === "zod"
    ? { zod: "^4" }
    : library === "valibot"
      ? { valibot: "^1", "@valibot/to-json-schema": "^1" }
      : { arktype: "^2" }
}

/** The welcome template, with its schema written for the project's library. */
export function welcomeTemplate(library: SchemaLibrary): string {
  const { import: schemaImport, schema } = schemaSource(library, [
    { name: "name", kind: "text" },
    { name: "startUrl", kind: "url" },
  ])
  return `/** @jsxImportSource @email-kit/core */
import { Button, Footer, Heading, Text } from "@email-kit/components"
import { defineEmail, url } from "@email-kit/core"
${schemaImport}

export default defineEmail({
  id: "welcome",
  purpose: "transactional",
${schema}
  subject: (data, t, platform) => t("subject", { name: data.name, product: platform.productName }),
  preheader: (_data, t) => t("preheader"),
  fixtures: {
    default: { name: "Ada", startUrl: "https://example.com/start" },
  },
  component: ({ data, t, platform }) => (
    <>
      <Heading>{t("heading", { name: data.name })}</Heading>
      <Text>{t("body", { product: platform.productName })}</Text>
      <Button href={data.startUrl}>{t("cta")}</Button>
      <Footer
        reason={t("footer", { product: platform.productName })}
        sender={platform.productName}
      />
    </>
  ),
})
`
}

export const WELCOME_MESSAGES = `${JSON.stringify(
  {
    subject: "Welcome to {product}, {name}",
    preheader: "Your account is ready",
    heading: "Welcome, {name}!",
    body: "Your {product} account is ready. Everything is set up.",
    cta: "Get started",
    footer: "You're receiving this email because you signed up for {product}.",
  },
  null,
  2,
)}\n`
