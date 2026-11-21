import { GENERATED_FOLDER } from "../compiler/config/paths.ts"
import { JSX_PRAGMA } from "../jsx.ts"
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
 * The welcome template's schema in each library. It's written out rather than built from
 * `schemaSource()`, since it shows more kinds of field than `email-kit new` needs: an enum for a
 * select, numbers for plurals, optional fields for `If`, and a list for `Each`.
 */
const WELCOME_SCHEMA: Readonly<Record<SchemaLibrary, string>> = {
  zod: `  schema: z.object({
    name: z.string().min(1),
    plan: z.enum(["free", "pro", "team"]),
    trialDays: z.number().int().min(1).optional(),
    team: z
      .object({
        name: z.string().min(1),
        memberCount: z.number().int().min(1),
        members: z.array(z.object({ name: z.string().min(1) })).min(1).max(10),
      })
      .optional(),
    startUrl: z.string().meta(url),
  }),`,
  valibot: `  schema: v.object({
    name: v.pipe(v.string(), v.minLength(1)),
    plan: v.picklist(["free", "pro", "team"]),
    trialDays: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
    team: v.optional(
      v.object({
        name: v.pipe(v.string(), v.minLength(1)),
        memberCount: v.pipe(v.number(), v.integer(), v.minValue(1)),
        members: v.pipe(
          v.array(v.object({ name: v.pipe(v.string(), v.minLength(1)) })),
          v.minLength(1),
          v.maxLength(10),
        ),
      }),
    ),
    startUrl: v.pipe(v.string(), v.metadata(url)),
  }),`,
  arktype: `  schema: type({
    name: "string > 0",
    plan: "'free' | 'pro' | 'team'",
    "trialDays?": "number.integer >= 1",
    "team?": type({
      name: "string > 0",
      memberCount: "number.integer >= 1",
      members: type({ name: "string > 0" }).array().atLeastLength(1).atMostLength(10),
    }),
    startUrl: type.string.configure(url),
  }),`,
}

/**
 * The welcome template `init` creates, with its schema written for the project's library. Besides
 * plain copy it uses a select, two plurals, `If`, `Unless` and `Each`, and its fixtures between
 * them take every branch, so the preview and `check` show each one. With `pragma` it starts with
 * the JSX pragma, so it type-checks whatever the project's tsconfig says about JSX.
 */
export function welcomeTemplate(library: SchemaLibrary, pragma: boolean): string {
  return `${pragma ? `${JSX_PRAGMA}\n` : ""}import { Button, Footer, Heading, List, ListItem, Text } from "@email-kit/components"
import { defineEmail, Each, If, Unless, url } from "@email-kit/core"
${SCHEMA_SOURCE[library].import}

// A starter that shows each part of a template. The guide explains them all:
// https://github.com/email-kit/email-kit/blob/main/docs/guide/templates.md
export default defineEmail({
  // The folder's name. Your backend renders it as emails.welcome.
  id: "welcome",
  purpose: "transactional",
  // The data render() takes. Templates place data but can't compute with it, so the backend
  // passes ready values: team.memberCount, rather than counting the members here.
${WELCOME_SCHEMA[library]}
  subject: (data, t, sender) => t("subject", { name: data.name, product: sender.productName }),
  preheader: (_data, t) => t("preheader"),
  // Sample data, rendered by \`email-kit check\`. Between them they take every branch below.
  fixtures: {
    default: {
      name: "Ada",
      plan: "team",
      trialDays: 14,
      team: {
        name: "Acme Design",
        memberCount: 2,
        members: [{ name: "Grace" }, { name: "Linus" }],
      },
      startUrl: "https://example.com/start",
    },
    "trial-ends-tomorrow": {
      name: "Ada",
      plan: "pro",
      trialDays: 1,
      team: { name: "Acme Design", memberCount: 1, members: [{ name: "Grace" }] },
      startUrl: "https://example.com/start",
    },
    "on-their-own": {
      name: "Ada",
      plan: "free",
      startUrl: "https://example.com/start",
    },
  },
  component: ({ data, t, sender }) => (
    <>
      {/* Copy comes from messages.<locale>.json. Data fields are filled in at send time. */}
      <Heading>{t("heading", { name: data.name })}</Heading>

      {/* A select: the message picks its words by the plan's value. */}
      <Text>{t("intro", { product: sender.productName, plan: data.plan })}</Text>

      {/* If: only when trialDays is given. A function child receives it as a required value.
          The message is a plural, with =1 for exactly one before the one/other categories. */}
      <If when={data.trialDays}>{(days) => <Text>{t("trial", { days })}</Text>}</If>

      {/* If on an optional object: shown once, with the object passed to the function. */}
      <If when={data.team}>
        {(team) => (
          <>
            {/* A plural: one or other by the count. */}
            <Text>{t("team", { count: team.memberCount, team: team.name })}</Text>
            {/* Each: once per item in the list. */}
            <List>
              <Each of={team.members}>{(member) => <ListItem>{member.name}</ListItem>}</Each>
            </List>
          </>
        )}
      </If>

      {/* Unless: only when there's no team. */}
      <Unless when={data.team}>
        <Text tone="muted">{t("invite")}</Text>
      </Unless>

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

/** The welcome template's English messages: plain copy, a select and two plurals. */
export const WELCOME_MESSAGES: string = `${JSON.stringify(
  {
    subject: "Welcome to {product}, {name}",
    preheader: "Your account is ready",
    heading: "Welcome, {name}!",
    intro:
      "Your {product} account is ready, on the {plan, select, free {Free} pro {Pro} team {Team} other {standard}} plan.",
    trial:
      "{days, plural, =1 {Your free trial ends tomorrow.} one {Your free trial ends in # day.} other {Your free trial ends in # days.}}",
    team: "{count, plural, one {# teammate is} other {# teammates are}} already in {team}:",
    invite: "Invite your team from your workspace settings when you're ready.",
    cta: "Get started",
    footer: "You're receiving this email because you signed up for {product}.",
  },
  null,
  2,
)}\n`
