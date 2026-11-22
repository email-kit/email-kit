---
name: email-kit
description: Write, change, translate, check and send emails with email-kit, where each email is a TSX template that `email-kit compile` turns into a typed module the backend calls as `emails.<id>.render(data)`. Use when asked to add or edit an email (welcome, password reset, magic link, one-time code, receipt, notification…), its copy or languages, its data or sample data, the email theme, to fix an `email-kit compile` or `email-kit check` error, or to write the backend code that renders and sends an email, in a project with an `email-kit.config.ts`.
license: MIT
---

# email-kit

email-kit compiles emails written in TSX into one typed module that the server imports. Each email
is a folder with a `template.tsx` (its data schema, sample data and body) and a
`messages.<locale>.json` per language (every word it shows). `email-kit compile` writes the module;
the backend calls `render()` with data and passes the subject, HTML and text to its mail provider.
`email-kit check` finds problems with accessibility, dark mode, size, links, copy and translations.

Templates run when you **compile**, not when you send. So `data.name` in a template isn't a value
but a placeholder that `render()` fills later. Most mistakes come from forgetting this. Read
[Rules](#rules) before you write a template.

## Find the project

1. Find `email-kit.config.ts`. It's in the app that sends email (in a monorepo, such as
   `apps/api`). Run every `email-kit` command in that folder.
2. Read the config. `root` is the email-kit folder (default `src/email-kit`, or `email-kit` without
   a `src/` folder). `locales.list` names every language. `sender` holds values such as
   `productName`. `importPath` is how the app imports the emails, such as `@/email-kit`.
3. Look at an existing template in the folder and follow its style.

```
email-kit.config.ts
src/email-kit/
  index.ts                  re-exports ./_generated: what the app imports
  order-shipped/            one folder per email, named by its id
    template.tsx
    messages.en.json
    messages.de.json
  _shared/                  your own components; folders starting with _ aren't templates
  _generated/               compiled output: never edit it
```

Run the CLI with the project's runner: `npx email-kit …`, `pnpm exec email-kit …`,
`yarn email-kit …` or `bunx email-kit …`. `init` also adds the scripts `email-kit:compile`,
`email-kit:watch` and `email-kit:check`.

## Add an email

1. **Create it:** `npx email-kit new password-reset`. Ids are lowercase words joined by hyphens.
   This writes `password-reset/template.tsx` and a `messages.<locale>.json` for every locale, and
   the email becomes `emails.passwordReset` after the next compile.
2. **Describe the data** in `schema`: only what the email shows, already computed and formatted by
   the backend. See [Schemas](#schemas).
3. **Add fixtures:** named sample data that matches the schema, at least one. Add one per case that
   changes the email (an optional field left out, a count of one).
4. **Write the body** with components from `@email-kit/components` and `If`, `Unless` and `Each`
   from `@email-kit/core`. No `<html>`, `<head>` or page container: the compiler adds them.
5. **Write the copy** in `messages.<locale>.json`, with every key in every locale's file. Use
   `t("key", { params })` in the template.
6. **Compile:** `npx email-kit compile`. Fix each error by its id in brackets, such as
   `[placeholder-misuse]`, using [the error reference](https://email-kit.dev/reference/errors).
7. **Check:** `npx email-kit check`. Fix every error (`✗`, exit code 1). Fix warnings (`!`) unless
   the user decides otherwise. Notes (`i`) are advice. Each finding names its check, explained in
   [the check reference](https://email-kit.dev/reference/checks).
8. **Send it** from the backend: see [Render and send](#render-and-send).

To change an email, edit its folder, then compile and check again. After changing a message file
or the config, compile too: `_generated/messages.d.ts` types `t()` from the default locale's
messages.

## Example

`src/email-kit/password-reset/template.tsx`:

```tsx
/** @jsxImportSource @email-kit/core */
import { Button, Footer, Heading, Text } from "@email-kit/components"
import { defineEmail, If, secretUrl } from "@email-kit/core"
import { z } from "zod"

export default defineEmail({
  id: "password-reset",
  purpose: "transactional",
  schema: z.object({
    name: z.string().min(1),
    resetUrl: z.string().meta(secretUrl),
    expiresInMinutes: z.number().int().min(1),
    requestedFrom: z.string().min(1).optional(),
  }),
  subject: (_data, t, sender) => t("subject", { product: sender.productName }),
  preheader: (data, t) => t("preheader", { minutes: data.expiresInMinutes }),
  fixtures: {
    default: {
      name: "Ada",
      resetUrl: "https://example.com/reset/abc123",
      expiresInMinutes: 30,
      requestedFrom: "Firefox on Windows",
    },
    "no-device": { name: "Ada", resetUrl: "https://example.com/reset/abc123", expiresInMinutes: 1 },
  },
  component: ({ data, t, sender }) => (
    <>
      <Heading>{t("heading", { name: data.name })}</Heading>
      <Text>{t("intro", { minutes: data.expiresInMinutes })}</Text>
      <If when={data.requestedFrom}>
        {(device) => <Text tone="muted">{t("device", { device })}</Text>}
      </If>
      <Button href={data.resetUrl}>{t("cta")}</Button>
      <Text size="bodySm" tone="muted">{t("ignore")}</Text>
      <Footer reason={t("footer", { product: sender.productName })} sender={sender.productName} />
    </>
  ),
})
```

`src/email-kit/password-reset/messages.en.json`:

```json
{
  "subject": "Reset your {product} password",
  "preheader": "The link works for {minutes, plural, one {# minute} other {# minutes}}",
  "heading": "Reset your password, {name}",
  "intro": "Choose a new password with the button below. The link expires in {minutes, plural, one {# minute} other {# minutes}}.",
  "device": "The request came from {device}.",
  "cta": "Choose a new password",
  "ignore": "If you didn't ask for this, ignore this email: your password stays the same.",
  "footer": "You're receiving this email because someone asked to reset the password of your {product} account."
}
```

The backend:

```ts
import { emails } from "@/email-kit"

const { subject, html, text } = emails.passwordReset.render(
  { name: user.name, resetUrl, expiresInMinutes: 30, requestedFrom: deviceLabel },
  { locale: user.locale },
)
await sendMail({ to: user.email, subject, html, text })
```

## Rules

The compiler and `check` enforce these. Each one names the error or check id it's reported as.

### Data is a placeholder

- **No computing with data.** Arithmetic, string methods, template literals, `.map()` and
  spreading on a `data` field fail with `placeholder-misuse`. The backend computes the value and
  passes it as a field of its own: `itemCount` rather than counting `data.items`, `fullName`
  rather than joining two fields.
- **Conditions on data use `If`, `Unless` and `Each`** from `@email-kit/core`. Never use `&&`,
  `? :`, comparisons or `if` on a `data` field: plain JavaScript runs once, at compile time, when
  there's no value yet.
  - `<If when={data.field}>`: an optional or nullable field (not a list), or a boolean. A function
    child gets the field as a required value: `{(v) => <Text>{t("k", { v })}</Text>}`.
  - `<Unless when={data.field}>`: when it's missing, `false` or an empty list.
  - `<Each of={data.items}>{(item) => …}</Each>`: once per item. `If` refuses a list
    (`list-condition`). For a heading that shows only with items, make the list part of an optional
    object and wrap that object in `If`.
  - "Missing" means `undefined`, `null`, `false`, `0`, `""` and `[]`. An optional number that may be
    0 needs a boolean of its own if 0 should show.
- **Plain JavaScript only for values known at compile time,** such as a constant or `locale`. `If`
  on one fails with `static-condition`.
- **`style` values are fixed.** Choose between two fixed styles with `If`/`Unless`
  (`data-dependent-style`).

### Copy lives in messages

- Every word an email shows comes from `t(key, params)`, including the subject, the preheader,
  button labels, alt text and footer lines. Don't write literal text in the template.
- Every locale in `locales.list` needs a `messages.<locale>.json` with every key
  (`missing-message`). `t()` must pass exactly the parameters the message uses
  (`missing-message-param`, `unused-message-param`).
- Messages are flat ICU: plain `{name}`, `plural` and `select` only.
  - Plural: `{count, plural, one {# item} other {# items}}`. Give every category the locale uses,
    and no others: English and German use `one` and `other`. Use `=0` for exactly zero, never
    `zero` in English. `other` is required (`invalid-plural`).
  - Select: `{plan, select, free {Free} pro {Pro} other {Standard}}`, on an enum field only, with
    `other` (`invalid-select`).
  - `{x, number}`, `{d, date}` and `{t, time}` fail with `unsupported-message`. So does a currency
    symbol next to an argument (`i18n.intl-format`).
- Write `'{'` for a literal brace. An apostrophe on its own, as in "You're", needs no quoting.

### Schemas

- Zod 4, Valibot or ArkType 2: use the library the project already uses. Valibot needs
  `@valibot/to-json-schema` installed.
- Only a portable subset (`schema-not-portable`): strings (or enums), numbers, integers, booleans,
  arrays and objects, each optional or nullable. No unions, records, tuples, `Date`, `bigint`,
  `any`, defaults or transforms. Field names use letters, digits and `_` only.
- **Dates, money and numbers arrive formatted, as strings,** marked
  `z.string().meta(formatted("money"))`. Kinds: `date`, `time`, `date-time`, `money`, `number`,
  `percent`. The backend formats with the recipient's locale and time zone
  ([Formatting](https://email-kit.dev/guide/formatting)). Plural counts are the exception: pass a
  number.
- **Markers**, from `@email-kit/core`:
  - `url` on every field used in `href` or `src` (`link.url-fields`). `render()` accepts only
    `https://` values.
  - `secret` on codes and tokens. They must stay out of the subject and preheader
    (`subject.no-secret`).
  - `secretUrl` on links that carry a token, such as reset and magic links.
  - With Valibot: `v.pipe(v.string(), v.metadata(url))`. With ArkType: `type.string.configure(url)`.
- **Set limits.** `.min(1)` on required strings, and `.max(n)` on lists. `check` also renders an
  empty variant ("Thanks, !" is reported by `copy.placeholder-fallbacks`), a long variant (25
  items per list unless `maxItems` says fewer, which can exceed Gmail's clipping size, `size.gmail`)
  and a hostile one.
- Fixtures must match the schema (`invalid-fixture`).

### The template

- `id` equals the folder's name (`id-mismatch`). Never rename an id that has shipped: backends call
  it by name.
- `purpose` is `"transactional"`, `"marketing"` or `"consent-request"`. Marketing and
  consent-request emails must show a postal address (`legal.postal-address`), such as
  `address={sender.postalAddress}` on `Footer`.
- End with `<Footer reason={…} sender={…} />`. Every email needs a reason line and a sender
  (`legal.reason`, `legal.sender-identity`).
- Start the file with `/** @jsxImportSource @email-kit/core */`, unless the tsconfig sets
  `"jsxImportSource": "@email-kit/core"`. Follow what the project's other templates do
  (`source.jsx-pragma`).
- Exactly one `<Heading>` at level 1, then 2 and 3 without skipping a level (`a11y.one-h1`).
- One primary `Button`. Others use `variant="secondary"`. Button labels start with a verb. Link text
  says where the link goes, never "click here" (`a11y.link-text`).
- No literal colours, font families or font sizes (`source.no-literal-colour`,
  `source.no-font-family`, `source.no-font-size`). Use components, and theme roles such as
  `role("muted")` in your own components ([Theme](https://email-kit.dev/guide/theme)).
- A literal URL starts with `https://`, `mailto:` or `tel:`. Images take an absolute `https:` URL
  to a PNG, JPEG or GIF, a `kind`, a `width`, and `alt` unless they're decorative.
- `sender.<key>` reads the config's `sender`: `productName`, `name`, `legalName`,
  `postalAddress`, `privacyUrl`, `helpUrl`, `supportEmail` or `siteUrl`. Reading a key the config
  doesn't set fails with `sender-value-missing`: add it to the config or ask the user for the value.
- Your own components go in a `_`-prefixed folder such as `_shared/`, imported with a relative
  path ([Components](https://email-kit.dev/guide/components#your-own-components)).

### Never

- Never edit `_generated/` or anything in the config's `out`. Change the source and compile.
- Never turn a check off, or lower its level, to make `check` pass, unless the user agrees. A check
  setting needs a `reason`:
  `checks: { "id": { level: "off", reason: "…" } }`.
- Never format dates or amounts in a template or message. Never add a mail provider SDK the project
  doesn't already use. Ask which one to use.

## Components

From `@email-kit/components`. Props and examples are in
[Components](https://email-kit.dev/guide/components).

| Component | For |
|---|---|
| `Text` | A paragraph. `size`: `lead`, `body`, `bodySm`, `caption`. `tone`: `default`, `muted`, `subtle` |
| `Heading` | `level` 1 to 3 |
| `Link` | A text link: `href` |
| `Button` | A call to action: `href`, `variant` (`primary`, `secondary`, `destructive`), `size`, `fullWidth` |
| `Image` | `kind` (`decorative`, `informative`, `functional`), `src`, `width`, `height`, `alt`; `href` for `functional` |
| `Divider`, `Spacer` | A rule; vertical space |
| `Section` | A padded block: `surface` (`canvas`, `card`, `muted`), `padding` |
| `List`, `ListItem` | A bulleted list, or numbered with `ordered`, with `Each` for data |
| `KeyValue` | Labelled facts: `items={[{ label, value, copyable }]}` |
| `Callout` | A notice: `tone` (`info`, `success`, `warning`, `error`) and a required `title` |
| `OtpCode` | A one-time code: `label`, `code` (mark the field `secret`) |
| `DataTable` | Rows from a list field, with at least two `columns` |
| `LineItems` | Receipt and invoice lines with subtotal, discounts, shipping, taxes and total |
| `Footer` | `reason` and `sender` (required), `address`, `links` |

## Render and send

Import from the config's `importPath`:

```ts
import { EmailRenderError, emails } from "@/email-kit"

const { subject, html, text, meta } = emails.orderShipped.render(data, { locale: "de-AT" })
// meta.locale is the compiled locale used ("de"); without `locale`, the default
```

- `render()` validates the data, picks the closest compiled locale and returns `subject`, `html`
  and `text`. Send `html` and `text` together with `subject`. The preheader is already in both.
- The data type is `OrderShippedData` (one per template), exported from the module. A `formatted`
  field's comment says how to format it.
- Bad data throws `EmailRenderError` with `code: "invalid-data"` and `issues: [{ path, message }]`.
  `emails.<id>.validate(data)` returns the issues without rendering, for data from a queue or
  webhook.
- If the config has a sender value `{ runtime: true }`, the module exports `createEmails({ … })`
  instead of `emails`. Call it once at startup with the values (such as `siteUrl`) and reuse the
  result.
- `@email-kit/runtime` must be in `dependencies`, not `devDependencies`
  (`output.runtime-dependency`). The other `@email-kit/*` packages are devDependencies.
- Commit `_generated/`: `check` fails when it's out of date (`output.drift`). To compile in the
  build instead, see [Checks and CI](https://email-kit.dev/guide/checks-and-ci).
- email-kit doesn't send mail. Pass the parts to whatever the project already uses, such as
  Nodemailer, Resend, Postmark or SES. Examples are in
  [Sending](https://email-kit.dev/guide/sending).
- A backend in another language uses `contract: true` and a mustache-core renderer
  ([mustache-core](https://email-kit.dev/reference/mustache-core)).

## Other tasks

| Task | How |
|---|---|
| Add a language | Add it to `locales.list` in the config, add `messages.<locale>.json` with every key to each template folder, then compile. Tags are canonical BCP 47: `pt-BR`, not `pt_br` ([Messages](https://email-kit.dev/guide/messages)) |
| Change colours or type | The config's `theme`, such as `theme: { source: "app/globals.css" }` for a shadcn theme. `npx email-kit tokens` prints the roles and their contrast ([Theme](https://email-kit.dev/guide/theme)) |
| Run checks in CI | `npx email-kit check --reporter github` after a full install ([Checks and CI](https://email-kit.dev/guide/checks-and-ci)) |
| Set up email-kit | `npm create email-kit` in the app that sends email ([Getting started](https://email-kit.dev/guide/getting-started)) |
| Update this skill | `npx email-kit agents` writes the skill for the installed version |

## References

Read the page the task needs. Each is a page of the documentation at https://email-kit.dev, which
describes the latest version; https://email-kit.dev/llms-full.txt has all of it in one file. When
the project has email-kit installed, the same pages for its version are in
`node_modules/@email-kit/cli/dist/docs/`, such as `reference/errors.md`: read those instead.

| Page | What's in it |
|---|---|
| [Templates](https://email-kit.dev/guide/templates) | `defineEmail`, schemas, markers, fixtures, control flow, sender values |
| [Components](https://email-kit.dev/guide/components) | Every component's props, and writing your own |
| [Messages](https://email-kit.dev/guide/messages) | `t()`, plurals, selects, locales, fallback, pseudo-locales |
| [Theme](https://email-kit.dev/guide/theme) | Theme sources, colour roles, type scale, dark mode |
| [Checks and CI](https://email-kit.dev/guide/checks-and-ci) | Running `check`, levels, team checks, CI |
| [Sending](https://email-kit.dev/guide/sending) | The generated module, validation, locales, errors, sending |
| [Formatting](https://email-kit.dev/guide/formatting) | Formatting dates, money and numbers in JS, Python and Go |
| [CLI](https://email-kit.dev/reference/cli) | Every command and flag |
| [Configuration](https://email-kit.dev/reference/configuration) | Every config option |
| [Checks](https://email-kit.dev/reference/checks) | Every check, its default level and fix |
| [Errors](https://email-kit.dev/reference/errors) | Every error id, its cause and fix |
| [mustache-core](https://email-kit.dev/reference/mustache-core) | The placeholder language of the compiled output |
