// The files `email-kit init` creates (INIT-03): the config, the folder's index.ts and a welcome
// template with its messages and fixture. Templates start with the JSX pragma (P0-05), so they
// type-check whatever the host's tsconfig says about JSX.

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

export const WELCOME_TEMPLATE = `/** @jsxImportSource @email-kit/core */
import { Button, Heading, Text } from "@email-kit/components"
import { defineEmail, url } from "@email-kit/core"
import { z } from "zod"

export default defineEmail({
  id: "welcome",
  purpose: "transactional",
  schema: z.object({
    name: z.string().min(1),
    startUrl: z.string().meta(url),
  }),
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
    </>
  ),
})
`

export const WELCOME_MESSAGES = `${JSON.stringify(
  {
    subject: "Welcome to {product}, {name}",
    preheader: "Your account is ready",
    heading: "Welcome, {name}!",
    body: "Your {product} account is ready. Everything is set up.",
    cta: "Get started",
  },
  null,
  2,
)}\n`
