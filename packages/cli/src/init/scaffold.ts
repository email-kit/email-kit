import { GENERATED_FOLDER } from "../compiler/config/paths.ts"
import type { SchemaLibrary } from "./detect.ts"
import type { ImportStrategy } from "./imports.ts"

/** What goes into the config `init` writes. */
export interface ConfigOptions {
  /** email-kit's folder, when it isn't the default one, which the config then leaves out. */
  readonly root: string | undefined
  /** What the app imports the emails from. */
  readonly importPath: string
  /** `mjs` when the app runs compiled JavaScript, so the module is written as `.mjs`. */
  readonly module: "mjs" | "ts"
  readonly productName: string
  /** The shadcn CSS file to take the theme from. */
  readonly theme: string | undefined
}

/** The `email-kit.config.ts` that `init` writes: only the options the project needs. */
export function configFile(options: ConfigOptions): string {
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
    `  sender: { productName: ${JSON.stringify(options.productName)} },`,
    ...(options.theme ? [`  theme: { source: ${JSON.stringify(options.theme)} },`] : []),
  ]
  return `import { defineConfig } from "@email-kit/core"

export default defineConfig({
${lines.join("\n")}
})
`
}

/**
 * The folder's `index.ts`, which the app imports: it re-exports the generated module. A subpath
 * import needs the module's file name, since Node resolves it without a bundler.
 */
export function indexFile(strategy: ImportStrategy): string {
  const folder = `./${GENERATED_FOLDER}`
  const target = strategy.kind === "subpath" ? `${folder}/index.${strategy.module}` : folder
  return `// The emails, compiled by \`email-kit compile\` into ${folder}.\nexport * from "${target}"\n`
}

/** A schema field in a scaffolded template: required text, or a URL (the `url` marker). */
export interface ScaffoldField {
  readonly name: string
  readonly kind: "text" | "url"
}

/** How each schema library writes its import, an object, and each kind of field. */
const SCHEMA_SOURCE: Readonly<
  Record<
    SchemaLibrary,
    {
      readonly import: string
      readonly open: string
      readonly field: Readonly<Record<ScaffoldField["kind"], string>>
    }
  >
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

/**
 * What each library needs installed for email-kit to read its schemas: Valibot needs its JSON
 * Schema converter too.
 */
const SCHEMA_DEPENDENCIES: Readonly<Record<SchemaLibrary, Readonly<Record<string, string>>>> = {
  zod: { zod: "^4" },
  valibot: { valibot: "^1", "@valibot/to-json-schema": "^1" },
  arktype: { arktype: "^2" },
}

/** The packages a schema library needs installed, name → version range. */
export function schemaDependencies(library: SchemaLibrary): Readonly<Record<string, string>> {
  return SCHEMA_DEPENDENCIES[library]
}

/**
 * The welcome template `init` creates, with its schema written for the project's library. It
 * starts with the JSX pragma, so it type-checks whatever the project's tsconfig says about JSX.
 */
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
  subject: (data, t, sender) => t("subject", { name: data.name, product: sender.productName }),
  preheader: (_data, t) => t("preheader"),
  fixtures: {
    default: { name: "Ada", startUrl: "https://example.com/start" },
  },
  component: ({ data, t, sender }) => (
    <>
      <Heading>{t("heading", { name: data.name })}</Heading>
      <Text>{t("body", { product: sender.productName })}</Text>
      <Button href={data.startUrl}>{t("cta")}</Button>
      <Footer
        reason={t("footer", { product: sender.productName })}
        sender={sender.productName}
      />
    </>
  ),
})
`
}

/** The welcome template's English messages. */
export const WELCOME_MESSAGES: string = `${JSON.stringify(
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
