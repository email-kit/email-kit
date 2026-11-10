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
command with [`invalid-config`](../errors.md#invalid-config), listing each problem.

## Options

| Option | Type | Default | |
|---|---|---|---|
| `root` | `string` | `src/email-kit` if there's a `src/` folder, else `email-kit` | The email-kit folder |
| `templates` | `string` | `<root>/templates` | Where the `.tsx` templates are |
| `messages` | `string` | `<root>/messages` | Message files, as `<messages>/<locale>/<template id>.json` |
| `out` | `string` | `<root>/compiled` | The output folder. The compiler owns it; it can't overlap the templates or messages, or contain the project |
| `module` | `"ts"` or `"mjs"` | `"ts"` | The generated module: `index.ts`, or `index.mjs` with `index.d.mts` for projects built with plain `tsc` |
| `perTemplateEntries` | `boolean` | `false` | Also write a self-contained module per template, `<out>/<id>/index.ts`, so a function that sends one email bundles only that one |
| `validate` | `boolean` | `true` | `render()` validates data against the schema before rendering. `validate()` is there either way |
| `importPath` | `string` | | How your app imports the emails, such as `@/email-kit` or `#email-kit`. `init` sets it; `email-kit new` uses it in the examples it prints |
| `locales` | object | `{ default: "en" }` | See [Locales](#locales) |
| `sender` | object | `{}` | See [Sender values](#sender-values) |
| `theme` | object | the built-in theme | See [Theme](#theme) |
| `checks` | object | `{}` | Per-check levels. See [Checks](#checks) |
| `customChecks` | `CustomCheck[]` | `[]` | Your team's checks. See [Team checks](#team-checks) |

## Locales

```ts
locales: {
  default: "en",
  list: ["en", "de", "pt-BR"],
  fallback: { pt: "pt-BR" },
  pseudo: false,
}
```

| Field | Type | Default | |
|---|---|---|---|
| `default` | `string` | `"en"` | The locale `render()` falls back to |
| `list` | `string[]` | only the default | Every locale to compile. It must include the default |
| `fallback` | `{ [tag]: locale }` | `{}` | Where a requested locale goes when no compiled locale matches it, before CLDR's parents. `{ pt: "pt-BR" }` sends `pt` and `pt-AO` to Brazilian Portuguese. Each key must not be compiled; each value must be |
| `pseudo` | `boolean`, or a list of `"en-XA"` and `"ar-XB"` | `false` | Also compile and ship the [pseudo-locales](templates.md#pseudo-locales). `email-kit check` builds them either way |

Tags must be canonical BCP 47: `en`, `pt-BR`, `zh-Hant`, not `en_US` or `pt-br`.

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
[`createEmails()`](sending.md#runtime-sender-values) at send time. Templates read them as
`sender.<key>`; see [Sender values](templates.md#sender-values).

`siteUrl`, `helpUrl` and `privacyUrl` must be `https://` URLs and `supportEmail` an email address,
whether set here or passed at send time.

## Theme

The theme gives every colour, font, size and radius the components use. Without one, emails use
email-kit's built-in neutral theme: shadcn/ui's neutral palette, adjusted so it passes the contrast
checks.

```ts
theme: {
  source: "app/globals.css",
  roles: { link: { light: "#1d4ed8", dark: "#93c5fd" } },
  radius: 6,
  layout: { container: 640 },
  typography: {
    stacks: { sans: ["Inter", "Helvetica", "Arial", "sans-serif"] },
    scale: { body: { sizePx: 16, lineHeightPx: 26 } },
  },
}
```

| Field | Type | Default | |
|---|---|---|---|
| `source` | see [Sources](#sources) | the built-in theme | Where the colours come from |
| `input` | `{ [modifier]: context }` | each modifier's default | For a DTCG resolver source only: the context of each modifier besides light and dark, such as `{ brand: "acme" }` |
| `roles` | `{ [role]: colour }` | | Override a [role](#roles) with a CSS colour or a `"{token}"` from the source, for both modes or `{ light, dark }` |
| `typography.stacks` | `{ sans?, serif?, mono? }` | system stacks | Font families in order, ending in a generic family. The last named family is classic Outlook's fallback |
| `typography.scale` | `{ [step]: Partial<TypeStyle> }` | see [Type scale](#type-scale) | Override steps of the type scale |
| `radius` | `number` | the source's `--radius`, else 10 | The base radius in px |
| `layout.container` | `number` | `600` | The width of the centred container, in px. Keep it within 480–640 (`tokens.container`) |
| `dark` | `"authored"` or `"none"` | `"authored"` if the source has a dark palette, else `"none"` | Whether the email carries your dark palette |
| `emit` | `boolean` | `false` | Also write the resolved theme to `<out>/theme.json` |

Every colour is converted to 6-digit hex, since email clients don't all read modern colour syntax:
out-of-gamut colours are mapped into sRGB, and translucent ones are flattened onto the surface they
sit on.

### Sources

**shadcn CSS.** The CSS file `shadcn init` writes:

```ts
theme: { source: "app/globals.css" }
```

email-kit reads the variables in `:root` as the light mode and those in `.dark` (or `:root.dark`,
`html.dark`, `[data-theme="dark"]`) as the dark mode, inside `@layer base` too. `var()`
references are resolved; `@theme inline` is skipped.

**DTCG token files.** One file per mode, in the W3C Design Tokens format:

```ts
theme: { source: { light: "tokens/light.tokens.json", dark: "tokens/dark.tokens.json" } }
```

Colour tokens map to the same names as shadcn's variables, with the leading `color` group dropped:
`color.primary.foreground` is `primary-foreground`. A group's own value goes under `$root`:

```json
{
  "color": {
    "$type": "color",
    "background": { "$value": "#ffffff" },
    "foreground": { "$value": "#18181b" },
    "primary": {
      "$root": { "$value": "#1e3a8a" },
      "foreground": { "$value": "#ffffff" }
    }
  },
  "radius": { "$type": "dimension", "$value": { "value": 0.5, "unit": "rem" } }
}
```

Aliases (`"{color.primary}"`) are resolved, and a colour object's `hex` wins over conversion. A
dimension token named `radius` sets the base radius.

**A DTCG resolver.** A `.resolver.json` file:

```ts
theme: { source: "tokens/theme.resolver.json", input: { brand: "acme" } }
```

The modifier whose contexts include `light` and `dark` gives the two modes (if several do, name the
colour-scheme one `theme` or `mode`). `input` picks the context of every other modifier. The theme
checks run on every other combination of contexts too.

**The variables themselves**, by their shadcn names. `dark` is optional:

```ts
theme: {
  source: {
    light: {
      background: "#ffffff",
      foreground: "#18181b",
      primary: "#1e3a8a",
      "primary-foreground": "#ffffff",
      secondary: "#f5f5f5",
      "secondary-foreground": "#18181b",
      muted: "#f5f5f5",
      "muted-foreground": "#52525b",
      destructive: "#991b1b",
      border: "#71717a",
    },
    radius: "0.5rem",
  },
}
```

A source error fails the compile with [`invalid-theme`](../errors.md#invalid-theme) or
[`invalid-colour`](../errors.md#invalid-colour).

### Roles

Components never use raw colours; they use roles, which email-kit resolves from the source's
variables for each mode. Each role takes the first of its variables that the source has. A role
with none of them uses email-kit's default where there is one, and otherwise fails with
[`unresolved-role`](../errors.md#unresolved-role) until you add the variable or set the role in
`roles`.

| Role | From |
|---|---|
| `pageGround` | Light: `muted`, `accent`. Dark: `background` |
| `canvas`, `card` | `card`, `background` |
| `muted` | `muted` |
| `codeSurface` | `muted`, `secondary` |
| `inverse` | `foreground` |
| `ink`, `strongBorder` | `card-foreground`, `foreground` |
| `mutedInk`, `subtleInk` | `muted-foreground`, adjusted to pass contrast unless you override it |
| `inverseInk` | `background` |
| `link`, `brand`, `brandInk` | `primary` |
| `onBrand` | `primary-foreground`, else whichever of `ink` and `inverseInk` reads better on `brand` |
| `hairline`, `divider` | `border` |
| `action.primary.fill`, `.border` | `primary` |
| `action.primary.label` | `primary-foreground` |
| `action.secondary.fill` | `secondary` |
| `action.secondary.label` | `secondary-foreground` |
| `action.secondary.border` | `border` |
| `action.destructive.fill`, `.border` | `destructive` |
| `action.destructive.label` | `destructive-foreground`, else computed |
| `status.<tone>.fill` | `info`, `success`, `warning` or `destructive` (for `error`), else a default |
| `status.<tone>.onFill` | the matching `-foreground`, else computed |
| `status.<tone>.ink`, `.surface`, `.border` | email-kit's defaults, or `roles` |

`<tone>` is `info`, `success`, `warning` or `error`. `email-kit tokens` prints every role in both
modes with its contrast ratio:

```sh
npx email-kit tokens
```

### Type scale

| Step | Default (size/line height, px) | Used by |
|---|---|---|
| `display` | 36/44, bold | |
| `h1`, `h2`, `h3` | 28/36, 22/30, 18/26, bold | `Heading` |
| `lead` | 18/28 | `Text size="lead"` |
| `body` | 16/24 | `Text`, `ListItem`, `KeyValue` |
| `bodySm` | 14/22 | `Text size="bodySm"`, tables |
| `caption` | 14/20 | `Text size="caption"`, `KeyValue` labels |
| `footer` | 14/20 | `Footer` |
| `button` | 16/24, bold | `Button` |
| `code` | 14/20, monospaced | |
| `otp` | 28/36, bold, monospaced, 6px letter-spacing | `OtpCode` |
| `wordmark` | 20/28, bold | |

A step override takes any of `stack` (`"sans"`, `"serif"` or `"mono"`), `sizePx`, `lineHeightPx`,
`weight` (400 or 700) and `letterSpacingPx`.

### Dark mode

With `dark: "authored"`, each email carries your dark palette: `@media (prefers-color-scheme:
dark)` rules for every colour it uses, the `[data-ogsc]` and `[data-ogsb]` selectors Outlook.com
reads, and a `color-scheme: light dark` declaration. With `"none"`, or a source without a dark
mode, the email declares no dark support and clients that darken emails do it their own way.

## Checks

`email-kit check` runs the [check catalogue](../checks.md), each check at a default level. Change
a level per project, with the reason a reviewer will read:

```ts
checks: {
  "img.fluid-width": { level: "off", reason: "Hero images are fixed width by design" },
  "i18n.unused-keys": { level: "error", reason: "We keep message files tidy" },
}
```

| Field | Type | |
|---|---|---|
| `level` | `"off"`, `"info"`, `"warn"` or `"error"` | `error` fails `check` (exit 1); `warn` and `info` are reported only |
| `reason` | `string` | Required, and not empty |

An unknown check id fails the config, with a suggestion if it's close to a real one. Team checks
take levels the same way. Checks that the compiler enforces, such as `source.fixture-valid`, fail
the compile whatever their level.

## Team checks

Add your own rules with `defineCheck()` in `customChecks`. They run alongside the catalogue, take
levels from `checks`, and show in every reporter.

```ts
import { defineCheck, defineConfig } from "@email-kit/core"

const helpLink = defineCheck({
  id: "acme.help-link",
  level: "warn",
  rule: "Every email links to the help centre.",
  fix: "Add the footer's help link.",
  run({ emails }, report) {
    for (const email of emails) {
      const hrefs = email.elements("a").map((a) => a.attributes.href ?? "")
      if (!hrefs.some((href) => href.startsWith("https://help.acme.example"))) {
        report({ email, message: "No link to the help centre" })
      }
    }
  },
})

export default defineConfig({
  customChecks: [helpLink],
})
```

| Field | Type | |
|---|---|---|
| `id` | `string` | `family.name` in lowercase, with a family of your own (`acme.help-link`); email-kit's families, such as `html.` or `text.`, are refused |
| `level` | `"error"`, `"warn"` or `"info"` | The default level |
| `rule` | `string` | The rule, in one sentence |
| `fix` | `string` | The usual fix |
| `docs` | `string` | Where your docs for it live |
| `on` | `"template"`, `"render"` or `"both"` | `template` (the default) checks the compiled templates, with `{{placeholders}}` where data goes; `render` checks the renders of every fixture and generated variant |
| `run` | `(context, report) => void` | The check |

`context.emails` holds one entry per template and locale (and, for renders, per fixture):

| Field | |
|---|---|
| `template`, `locale` | Which email |
| `fixture` | For renders: the fixture's name, or a generated variant such as `"generated empty"` |
| `subject`, `preheader`, `html`, `text` | The parts |
| `elements(name?)` | Every element, or those with a tag name: `{ name, attributes, text, offset, mso }`, where `mso` is true inside a classic-Outlook-only block |

`report({ message, email?, at?, fix? })` records a problem: leave out `email` for a project-wide
one, give `at` (an element's `offset`) to point at a place in the HTML, and `fix` to replace the
check's usual fix. A check that throws is reported as
[`check-failed`](../errors.md#check-failed).
