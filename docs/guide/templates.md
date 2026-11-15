# Templates

Each template is a folder in the email-kit folder (`root`), named by its id: `order-shipped/`
holds `template.tsx`, whose default export is `defineEmail({ … })`, and its messages, one
`messages.<locale>.json` per locale. The `id` in `defineEmail()` must match the folder's name.

```
src/email-kit/
  order-shipped/
    template.tsx
    messages.en.json
    messages.de.json
  _shared/          components the templates import; folders starting with _ are never templates
```

For a step-by-step walkthrough, see [Your first email](first-email.md). A template file looks
like this:

```tsx
/** @jsxImportSource @email-kit/core */
import { Button, Footer, Heading, Text } from "@email-kit/components"
import { defineEmail, url } from "@email-kit/core"
import { z } from "zod"

export default defineEmail({
  id: "password-reset",
  purpose: "transactional",
  schema: z.object({ name: z.string().min(1), resetUrl: z.string().meta(url) }),
  subject: (data, t) => t("subject"),
  preheader: (data, t) => t("preheader"),
  fixtures: { default: { name: "Ada", resetUrl: "https://example.com/reset/abc" } },
  component: ({ data, t, sender }) => (
    <>
      <Heading>{t("heading", { name: data.name })}</Heading>
      <Text>{t("body")}</Text>
      <Button href={data.resetUrl}>{t("cta")}</Button>
      <Footer reason={t("footer", { product: sender.productName })} sender={sender.productName} />
    </>
  ),
})
```

The first line, `/** @jsxImportSource @email-kit/core */`, tells TypeScript and the compiler which
JSX runtime the file uses, so templates type-check in a project whose JSX is set up for React. If
your `tsconfig.json` already sets `"jsxImportSource": "@email-kit/core"`, you can leave it out.

## How templates run

Templates run once per locale, when you compile, never when you send. At that point `data` holds
placeholders, not values: `{data.name}` becomes `{{name}}` in the output, and the generated module
fills it at send time.

So a template can place data but can't compute with it. Arithmetic, string methods, template
literals and `.map()` on a data field fail the compile with
[`placeholder-misuse`](../reference/errors.md#placeholder-misuse). Compute the value in your backend and pass
it as a field of its own, and use `<Each>` for lists.

Conditions that don't depend on data are plain JavaScript, decided when the template compiles:

```tsx
{showSurvey && <Text>{t("survey")}</Text>}
```

`style` values are fixed at compile time too; choose between fixed styles with `<If>` and
`<Unless>`.

## defineEmail

| Field | Type | Required | What it is |
|---|---|---|---|
| `id` | `string` | yes | Lowercase words joined by hyphens, such as `order-shipped`. It's the name of the template's folder, and becomes `emails.orderShipped` and the type `OrderShippedData`. Don't rename an id that has shipped: backends call it by name |
| `purpose` | `"transactional"`, `"marketing"` or `"consent-request"` | yes | The legal purpose. It's recorded in `render()`'s `meta` (and the manifest, with `contract: true`), and the compile fails without it (`legal.purpose-declared`). `marketing` and `consent-request` emails must show a postal address (`legal.postal-address`); the marketing footer parts (unsubscribe) don't exist yet |
| `schema` | a Zod 4, Valibot or ArkType 2 schema | yes | The data the email takes. `data`, `fixtures` and the generated types come from it |
| `subject` | `(data, t, sender) => …` | yes | The subject line: text only, one line |
| `preheader` | `(data, t, sender) => …` | no | The inbox preview text after the subject: one line. Without it `check` warns (`preheader.length`) |
| `fixtures` | `{ [name]: data }` | yes | Named sample data. Each one must match the schema, and there must be at least one |
| `component` | `({ data, t, locale, sender }) => …` | yes | The body |

The component's props:

| Prop | What it is |
|---|---|
| `data` | The data, as placeholders typed from the schema |
| `t` | Looks up a message in the locale being compiled. See [Messages and locales](messages.md) |
| `locale` | The locale being compiled, such as `"de"` |
| `sender` | Values from the config, such as `sender.productName`. See [Sender values](#sender-values) |

You don't add `<html>`, `<head>` or a page container: the compiler writes the document around the
body and centres it in a container of the theme's width (600px by default).

## Schemas

The schema describes the data `render()` takes. Three libraries are supported:

```ts
// Zod 4
import { z } from "zod"
z.object({ name: z.string().min(1), resetUrl: z.string().meta(url) })

// Valibot, with @valibot/to-json-schema installed as a devDependency
import * as v from "valibot"
v.object({ name: v.pipe(v.string(), v.minLength(1)), resetUrl: v.pipe(v.string(), v.metadata(url)) })

// ArkType 2
import { type } from "arktype"
type({ name: "string > 0", resetUrl: type.string.configure(url) })
```

email-kit converts the schema to JSON Schema (written as `schema.json` with `contract: true`, and
into the module's data types either way). It must stay within
a portable subset that backends in other languages can also represent, or the compile fails with
[`schema-not-portable`](../reference/errors.md#schema-not-portable), naming the field:

- strings (optionally an enum), numbers, integers, booleans, arrays and objects, each optionally
  nullable or optional;
- the constraints `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `exclusiveMinimum`,
  `exclusiveMaximum`, `multipleOf`, `minItems` and `maxItems`;
- no unions, records, tuples, `Date`, `bigint`, `any`, defaults or transforms.

Dates and amounts arrive as strings your backend has formatted (see
[Formatting dates, money and numbers](formatting.md)). Field names are letters, digits
and `_`.

Constraints matter beyond validation. `check` renders each template with generated data as well
as your fixtures: an empty variant (optional fields left out, strings at their minimum length), a
long one (long strings, 25 items per list unless `maxItems` says fewer) and a hostile one (markup,
quotes and braces). A required name without `.min(1)` renders as "Thanks, !" in the empty variant,
which `copy.placeholder-fallbacks` reports; a list without a maximum can push the long variant
past Gmail's clipping size (`size.gmail`).

With ArkType, `configure()` accepts the markers as they are: `@email-kit/core` declares its
metadata key on ArkType's global `ArkEnv`, so no declaration of your own is needed.

## Field markers

Markers are schema metadata from `@email-kit/core`. They reach the generated module, and with
`contract: true` they're written into `schema.json` under `"x-email-kit"`, so they survive into
every backend.

| Marker | Zod | Means |
|---|---|---|
| `url` | `z.string().meta(url)` | A URL. Only `url` fields may start an `href` or `src` (`link.url-fields`), and `render()` refuses a value that isn't an `https://` URL |
| `secret` | `z.string().meta(secret)` | A code or token. `check` fails if it appears in the subject or preheader (`subject.no-secret`) |
| `secretUrl` | `z.string().meta(secretUrl)` | Both: a URL that carries a token, such as a magic link |
| `formatted(kind)` | `z.string().meta(formatted("money"))` | A value your backend formats for the recipient. `kind` is `date`, `time`, `date-time`, `money`, `number` or `percent`. It adds a comment to the generated data type saying how to format it |

With Valibot, use `v.pipe(v.string(), v.metadata(url))`; with ArkType,
`type.string.configure(url)`.

A literal URL in a template (`href="https://help.example.com"`) must start with `https://`,
`mailto:` or `tel:`.

## Fixtures

Fixtures are named sample data. `check` renders every one, and the compile fails with
[`invalid-fixture`](../reference/errors.md#invalid-fixture) if one doesn't match the schema. The first
fixture is the base for the generated variants. Add fixtures for the cases that change the email,
such as an optional field left out or a count of one.

Fixtures can live in a JSON file:

```ts
import fixtures from "../fixtures/receipt.json" with { type: "json" }

defineEmail({ /* … */ fixtures })
```

## Control flow

`If`, `Unless` and `Each` choose content at send time, from a data field. They come from
`@email-kit/core`.

```tsx
<If when={data.express}>
  <Text>{t("express")}</Text>
</If>

<Unless when={data.express}>
  <Text>{t("standard")}</Text>
</Unless>

<If when={data.giftMessage}>
  {(message) => <Text>{t("gift", { message })}</Text>}
</If>

<Each of={data.items}>
  {(item) => <ListItem>{item.name} × {item.qty}</ListItem>}
</Each>
```

| Component | Props | Renders |
|---|---|---|
| `If` | `when`: an optional or nullable field that isn't a list, or a boolean field; `children`: content, or a function that receives the field | Its content once, when the field is present (or `true`) |
| `Unless` | `when`: an optional, nullable, boolean or list field; `children` | Its content when the field is missing (or `false`, or an empty list) |
| `Each` | `of`: a list field, optional or not; `children`: a function that receives the item | Its content once per item, and nothing for an empty or missing list |

With a function child, `If` passes the field as a required value, so it can go where a required
one is expected, such as a `t()` parameter.

`If` doesn't take a list, since a list section repeats its content per item
([`list-condition`](../reference/errors.md#list-condition)). Use `<Each>` for the items and `<Unless>` for
the empty case. When content around the items, such as a heading or a `<List>`, should only show
when there are items, wrap the list in an optional object and test that:

```tsx
// schema: team: z.object({ name: z.string(), members: z.array(…).min(1) }).optional()
<If when={data.team}>
  {(team) => (
    <List>
      <Each of={team.members}>{(member) => <ListItem>{member.name}</ListItem>}</Each>
    </List>
  )}
</If>
```

"Missing" follows the [placeholder language](../reference/mustache-core.md#7-sections-and-truthiness):
a missing value, `null`, `false`, `0`, `""` and `[]` all count as missing. An optional number
that may be 0 needs a boolean of its own if 0 should show.

`If`, `Unless` and `Each` need a field from `data`; a condition known at compile time is plain
JavaScript ([`static-condition`](../reference/errors.md#static-condition)).

`Conditional` is for content one kind of output needs and another doesn't. `when` is `htmlOnly`
(the HTML part), `textOnly` (the plain-text part), `mso` (only classic Outlook on Windows) or
`notMso` (every other client). The components already use it; you rarely need it in a template.

## Sender values

`sender` holds facts about the sender that templates show: the product name, the postal
address, the help URL. They're set once, in the config:

```ts
sender: {
  productName: "Acme",
  legalName: "Acme Ltd",
  postalAddress: "1 High Street, London",
  helpUrl: "https://help.acme.example",
  privacyUrl: "https://acme.example/privacy",
  siteUrl: { runtime: true },
}
```

The keys are `productName`, `name`, `legalName`, `postalAddress`, `privacyUrl`, `helpUrl`,
`supportEmail` and `siteUrl`. A template that reads a key the config doesn't set fails the compile
([`sender-value-missing`](../reference/errors.md#sender-value-missing)).

There are two kinds:

- **A string is a compile-time constant.** It's written into the output as text, like the copy.
- **`{ runtime: true }` means your backend passes it at send time.** It renders as a placeholder,
  and the generated module exports `createEmails({ siteUrl })` instead of a ready `emails` object.
  Use it for values that differ between environments, such as the site URL on staging and
  production. See [createEmails](sending.md#runtime-sender-values).

Data passed to `render()` can't override a sender value.

## Your own components

A component is a function that returns JSX. Put it in a folder whose name starts with `_`, such as
`_shared/`, and import it with a relative path (`../_shared/Card`); start the file with the same `@jsxImportSource` comment. See
[Components](components.md#your-own-components).
