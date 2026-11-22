<!-- Generated from docs/reference/configuration.md for AI coding agents: run `pnpm --filter @email-kit/cli test -u` after changing the docs. -->

# Configuration

The config is `email-kit.config.ts` in the project root (`.mts`, `.js` and `.mjs` work too), with
`defineConfig()` as its default export. Commands look for it in the current folder; `--config
<path>` points them elsewhere.

```ts
import { defineConfig } from "@email-kit/core"

export default defineConfig({
  locales: { default: "en", list: ["en", "de"] },
  sender: {
    productName: "Acme",
    legalName: "Acme Ltd",
    postalAddress: "1 High Street, London",
    helpUrl: "https://help.acme.example",
    privacyUrl: "https://acme.example/privacy",
    siteUrl: { runtime: true },
  },
  theme: { source: "app/globals.css" },
  checks: {
    "output.gitignored": { level: "off", reason: "The build compiles the emails before deploying" },
  },
})
```

Paths are relative to the config file. An unknown option, or one with the wrong type, fails every
command with [`invalid-config`](errors.md#invalid-config), listing each problem.

## Options

| Option | Type | Default | |
|---|---|---|---|
| `root` | `string` | `src/email-kit` if there's a `src/` folder, else `email-kit` | The email-kit folder: a folder per template, `<root>/<id>/template.tsx`, with `messages.<locale>.json` beside it |
| `out` | `string` | `<root>/_generated` | The output folder. The compiler owns it: each compile removes what it didn't write (names starting with `.` stay). It can't be or contain the email-kit folder, or contain the project, and a folder with files email-kit didn't write is refused |
| `contract` | `boolean` | `false` | Also write each email's parts as files, for backends that don't run the module: `<out>/<id>/<locale>.html` and `.txt`, `<out>/<id>/schema.json` and `<out>/manifest.json`. See [Other backends](../guide/sending.md#other-backends) |
| `module` | `"ts"` or `"mjs"` | `"ts"` | The generated module: `index.ts`, or `index.mjs` with `index.d.mts` for projects built with plain `tsc` |
| `perTemplateEntries` | `boolean` | `false` | Also write a self-contained module per template, `<out>/<id>/index.ts`, so a function that sends one email bundles only that one |
| `validate` | `boolean` | `true` | `render()` validates data against the schema before rendering. `validate()` is there either way |
| `importPath` | `string` | | How your app imports the emails, such as `@/email-kit` or `#email-kit`. `init` sets it; `email-kit new` uses it in the examples it prints |
| `locales` | object | `{ default: "en" }` | See [Locales](#locales) |
| `sender` | object | `{}` | See [Sender values](#sender-values) |
| `theme` | object | the built-in theme | See [Theme](#theme) |
| `checks` | object | `{}` | Per-check levels. See [Checks](#checks) |
| `customChecks` | `CustomCheck[]` | `[]` | Your team's checks. See [Checks](#checks) |

## Locales

| Field | Type | Default | |
|---|---|---|---|
| `default` | `string` | `"en"` | The locale `render()` falls back to |
| `list` | `string[]` | only the default | Every locale to compile. It must include the default |
| `fallback` | `{ [tag]: locale }` | `{}` | Where a requested locale goes when no compiled locale matches it, before CLDR's parents. Each key must not be compiled; each value must be |
| `pseudo` | `boolean`, or a list of `"en-XA"` and `"ar-XB"` | `false` | Also compile and ship the pseudo-locales. `email-kit check` builds them either way |

Tags must be canonical BCP 47: `en`, `pt-BR`, `zh-Hant`. See
[Messages and locales](../guide/messages.md#locales).

## Sender values

```ts
sender: {
  productName: "Acme",
  siteUrl: { runtime: true },
}
```

The keys are `productName`, `name`, `legalName`, `postalAddress`, `privacyUrl`, `helpUrl`,
`supportEmail` and `siteUrl`. Each value is a non-empty string, written into the output when you
compile, or `{ runtime: true }`, passed by your backend to
[`createEmails()`](../guide/sending.md#runtime-sender-values) at send time. Templates read them as
`sender.<key>`; see [Sender values](../guide/templates.md#sender-values).

`siteUrl`, `helpUrl` and `privacyUrl` must be `https://` URLs and `supportEmail` an email address,
whether set here or passed at send time.

## Theme

| Field | Type | Default | |
|---|---|---|---|
| `source` | see [Sources](../guide/theme.md#sources) | the built-in theme | Where the colours come from |
| `input` | `{ [modifier]: context }` | each modifier's default | For a DTCG resolver source only: the context of each modifier besides light and dark, such as `{ brand: "acme" }` |
| `roles` | `{ [role]: colour }` | | Override a [role](../guide/theme.md#roles) with a CSS colour or a `"{token}"` from the source, for both modes or `{ light, dark }` |
| `typography.stacks` | `{ sans?, serif?, mono? }` | system stacks | Font families in order, ending in a generic family. The last named family is classic Outlook's fallback |
| `typography.scale` | `{ [step]: Partial<TypeStyle> }` | see [Type scale](../guide/theme.md#type-scale) | Override steps of the type scale |
| `radius` | `number` | the source's `--radius`, else 10 | The base radius in px |
| `layout.container` | `number` | `600` | The width of the centred container, in px. Keep it within 480–640 (`tokens.container`) |
| `dark` | `"authored"` or `"none"` | `"authored"` if the source has a dark palette, else `"none"` | Whether the email carries your dark palette |
| `emit` | `boolean` | `false` | Also write the resolved theme to `<out>/theme.json` |

Every colour is converted to 6-digit hex, since email clients don't all read modern colour syntax:
out-of-gamut colours are mapped into sRGB, and translucent ones are flattened onto the surface they
sit on.

See [Theme and dark mode](../guide/theme.md) for the sources, roles, type scale and dark mode.

## Checks

```ts
checks: {
  "img.fluid-width": { level: "off", reason: "Hero images are fixed width by design" },
}
```

Each key is a check id from the [checks reference](checks.md), or a team check's id:

| Field | Type | |
|---|---|---|
| `level` | `"off"`, `"info"`, `"warn"` or `"error"` | `error` fails `check` (exit 1); `warn` and `info` are reported only |
| `reason` | `string` | Required, and not empty |

`customChecks` takes checks made with `defineCheck()`. See
[Checks and CI](../guide/checks-and-ci.md#team-checks).
