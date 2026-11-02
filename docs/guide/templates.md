# Writing templates

A template is a `.tsx` file in the templates folder (`<root>/templates`) whose default export is
`defineEmail({ … })`. Files whose name starts with `_` are skipped, so helpers can sit beside the
templates; components of your own are better in a folder of their own.

```tsx
/** @jsxImportSource @email-kit/core */
import { Button, Footer, Heading, KeyValue, List, ListItem, Text } from "@email-kit/components"
import { defineEmail, Each, formatted, If, Unless, url } from "@email-kit/core"
import { z } from "zod"

export default defineEmail({
  id: "order-shipped",
  purpose: "transactional",
  schema: z.object({
    name: z.string().min(1),
    orderNumber: z.string().min(1),
    carrier: z.enum(["dhl", "ups", "other"]),
    trackingUrl: z.string().meta(url),
    deliveryDate: z.string().min(1).meta(formatted("date")),
    itemCount: z.number().int().min(1),
    items: z.array(z.object({ name: z.string().min(1), qty: z.number().int().min(1) })).min(1),
    express: z.boolean(),
    giftMessage: z.string().min(1).optional(),
  }),
  subject: (data, t) => t("subject", { order: data.orderNumber }),
  preheader: (data, t) => t("preheader", { date: data.deliveryDate }),
  fixtures: {
    default: {
      name: "Ada",
      orderNumber: "A-1042",
      carrier: "dhl",
      trackingUrl: "https://track.example.com/A-1042",
      deliveryDate: "3 November 2026",
      itemCount: 2,
      items: [
        { name: "Tea", qty: 1 },
        { name: "Cake", qty: 1 },
      ],
      express: false,
    },
  },
  component: ({ data, t, platform }) => (
    <>
      <Heading>{t("heading", { name: data.name })}</Heading>
      <Text>{t("intro", { count: data.itemCount, carrier: data.carrier })}</Text>
      <KeyValue
        items={[
          { label: t("order"), value: data.orderNumber, copyable: true },
          { label: t("delivery"), value: data.deliveryDate },
        ]}
      />
      <List>
        <Each of={data.items}>
          {(item) => (
            <ListItem>
              {item.name} × {item.qty}
            </ListItem>
          )}
        </Each>
      </List>
      <If when={data.express}>
        <Text>{t("express")}</Text>
      </If>
      <Unless when={data.express}>
        <Text tone="muted">{t("standard")}</Text>
      </Unless>
      <If when={data.giftMessage}>
        {(message) => <Text tone="muted">{t("gift", { message })}</Text>}
      </If>
      <Button href={data.trackingUrl}>{t("track")}</Button>
      <Footer
        reason={t("footer", { product: platform.productName })}
        sender={platform.legalName}
        address={platform.postalAddress}
        links={[
          { href: platform.helpUrl, label: t("help") },
          { href: platform.privacyUrl, label: t("privacy") },
        ]}
      />
    </>
  ),
})
```

With its copy in `messages/en/order-shipped.json`:

```json
{
  "subject": "Order {order} has shipped",
  "preheader": "Arriving {date}",
  "heading": "It's on its way, {name}",
  "intro": "{count, plural, one {# item is} other {# items are}} on the way with {carrier, select, dhl {DHL} ups {UPS} other {our courier}}.",
  "order": "Order",
  "delivery": "Expected delivery",
  "express": "You chose express delivery.",
  "standard": "You chose standard delivery.",
  "gift": "Your gift message: {message}",
  "track": "Track your parcel",
  "footer": "You're receiving this email because you ordered from {product}.",
  "help": "Help centre",
  "privacy": "Privacy policy"
}
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
[`placeholder-misuse`](../errors.md#placeholder-misuse). Compute the value in your backend and pass
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
| `id` | `string` | yes | Lowercase words joined by hyphens, such as `order-shipped`. It names the output folder and becomes `emails.orderShipped` and the type `OrderShippedData`. Don't rename an id that has shipped: backends call it by name |
| `purpose` | `"transactional"`, `"marketing"` or `"consent-request"` | yes | The legal purpose. It's recorded in the manifest and in `render()`'s `meta`, and the compile fails without it (`legal.purpose-declared`). `marketing` and `consent-request` emails must show a postal address (`legal.postal-address`); the marketing footer parts (unsubscribe) don't exist yet |
| `schema` | a Zod 4, Valibot or ArkType 2 schema | yes | The data the email takes. `data`, `fixtures` and the generated types come from it |
| `subject` | `(data, t, platform) => …` | yes | The subject line: text only, one line |
| `preheader` | `(data, t, platform) => …` | no | The inbox preview text after the subject: one line. Without it `check` warns (`preheader.length`) |
| `fixtures` | `{ [name]: data }` | yes | Named sample data. Each one must match the schema, and there must be at least one |
| `component` | `({ data, t, locale, platform }) => …` | yes | The body |

The component's props:

| Prop | What it is |
|---|---|
| `data` | The data, as placeholders typed from the schema |
| `t` | Looks up a message in the locale being compiled. See [Messages](#messages) |
| `locale` | The locale being compiled, such as `"de"` |
| `platform` | Values from the config, such as `platform.productName`. See [Platform values](#platform-values) |

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

email-kit converts the schema to JSON Schema and writes it as `schema.json`. It must stay within
a portable subset that backends in other languages can also represent, or the compile fails with
[`schema-not-portable`](../errors.md#schema-not-portable), naming the field:

- strings (optionally an enum), numbers, integers, booleans, arrays and objects, each optionally
  nullable or optional;
- the constraints `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `exclusiveMinimum`,
  `exclusiveMaximum`, `multipleOf`, `minItems` and `maxItems`;
- no unions, records, tuples, `Date`, `bigint`, `any`, defaults or transforms.

Dates and amounts arrive as strings your backend has formatted (see
[Formatting dates, money and numbers](../recipes/formatting.md)). Field names are letters, digits
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

Markers are schema metadata from `@email-kit/core`. They're written into `schema.json` under
`"x-email-kit"`, so they survive into every backend.

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
[`invalid-fixture`](../errors.md#invalid-fixture) if one doesn't match the schema. The first
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
| `If` | `when`: an optional or nullable field, or a boolean field; `children`: content, or a function that receives the field | Its content when the field is present (or `true`) |
| `Unless` | `when`: an optional, nullable, boolean or list field; `children` | Its content when the field is missing (or `false`, or an empty list) |
| `Each` | `of`: a list field; `children`: a function that receives the item | Its content once per item |

With a function child, `If` passes the field as a required value, so it can go where a required
one is expected, such as a `t()` parameter.

"Missing" follows the [placeholder language](../spec/mustache-core.md#7-sections-and-truthiness):
a missing value, `null`, `false`, `0`, `""` and `[]` all count as missing. An optional number
that may be 0 needs a boolean of its own if 0 should show.

`If`, `Unless` and `Each` need a field from `data`; a condition known at compile time is plain
JavaScript ([`static-condition`](../errors.md#static-condition)).

`Conditional` is for content one kind of output needs and another doesn't. `when` is `htmlOnly`
(the HTML part), `textOnly` (the plain-text part), `mso` (only classic Outlook on Windows) or
`notMso` (every other client). The components already use it; you rarely need it in a template.

## Messages

Copy lives in message files, one per template and locale: `<messages>/<locale>/<id>.json`, a flat
object of keys and ICU messages. `t(key, params)` looks a message up in the locale being compiled.

```json
{
  "heading": "Thanks, {name}!",
  "items": "{count, plural, one {# item} other {# items}}"
}
```

```tsx
<Heading>{t("heading", { name: data.customerName })}</Heading>
```

Every locale needs every key the template uses, and `t()` must pass exactly the parameters the
message uses: a missing key, a missing parameter or an unused one fails the compile.

A parameter can be text, a number, a data field, a platform value, or another message:
`t("footer", { product: platform.productName })`.

### Typed t()

`email-kit compile` writes `compiled/messages.d.ts` from the default locale's messages. With it in
your TypeScript project, `t()` knows each template's keys and parameters: a misspelt key, a
missing parameter or a string passed to a plural is an editor error. Until the first compile,
`t()` is untyped.

### Plurals

```json
{ "expiry": "It expires in {minutes, plural, one {# minute} other {# minutes}}." }
```

```tsx
<Text>{t("expiry", { minutes: data.minutes })}</Text>
```

A plural takes a number field (or a literal number). Its category is chosen at send time with the
locale's CLDR plural rules, which the generated module carries. `#` prints the number as digits,
without locale formatting.

The message must give every category the locale uses, so no number falls through: `one` and
`other` in English and German, `zero`, `one`, `two`, `few`, `many` and `other` in Arabic. A
category the locale never uses is an error too; English has no `zero`, so write `=0` for exactly
zero. `=N` cases match exact whole numbers before the categories. `other` is always required, and
plural offsets aren't supported. See [`invalid-plural`](../errors.md#invalid-plural).

### Selects

```json
{ "shipping": "Sent with {carrier, select, dhl {DHL} ups {UPS} other {our courier}}." }
```

A select takes a field with fixed values, such as `z.enum(["dhl", "ups", "other"])`. Each case
must be one of its values, and `other` is required. A free string field is refused
([`invalid-select`](../errors.md#invalid-select)).

### What messages can't do

Only plain `{name}` arguments, `plural` and `select` are supported. `{amount, number}`,
`{date, date}` and the like fail the compile ([`unsupported-message`](../errors.md#unsupported-message)):
pass the value formatted by your backend as a string instead.

ICU quoting applies: `'{'` is a literal brace and `''` is an apostrophe. An apostrophe on its own,
as in "You're", needs no quoting.

## Locales

The config lists the locales to compile (see [locales](configuration.md#locales)). Each template is
compiled once per locale, from that locale's message file.

- The default locale is the first in the output, and the one `render()` falls back to.
- A locale whose language is written right to left (Arabic, Hebrew, Persian, Urdu and a few
  others) gets `dir="rtl"`, and the components align to match.
- `render(data, { locale })` takes any BCP 47 tag and falls back through your `locales.fallback`
  map and CLDR's parents (`de-AT` to `de`, `es-AR` to `es-419` to `es`), then to the default. See
  [Rendering and sending](sending.md#locales).

### Pseudo-locales

Two pseudo-locales are generated from the default locale's messages, for testing layout without
translations:

- `en-XA`: accented, bracketed and padded up to three times longer, to show truncation and
  overflow;
- `ar-XB`: wrapped in right-to-left overrides, to show mirroring problems.

`email-kit check` builds both every time and runs the checks on them. To ship them in the module,
for QA on staging, set `locales.pseudo: true` (or a list of them).

## Platform values

`platform` holds facts about the sender that templates show: the product name, the postal
address, the help URL. They're set once, in the config:

```ts
platform: {
  productName: "Acme",
  legalName: "Acme Ltd",
  postalAddress: "1 High Street, London",
  helpUrl: "https://help.acme.example",
  privacyUrl: "https://acme.example/privacy",
  siteUrl: { runtime: true },
}
```

The keys are `productName`, `senderName`, `legalName`, `postalAddress`, `privacyUrl`, `helpUrl`,
`supportEmail` and `siteUrl`. A template that reads a key the config doesn't set fails the compile
([`platform-value-missing`](../errors.md#platform-value-missing)).

There are two kinds:

- **A string is a compile-time constant.** It's written into the output as text, like the copy.
- **`{ runtime: true }` means your backend passes it at send time.** It renders as a placeholder,
  and the generated module exports `createEmails({ siteUrl })` instead of a ready `emails` object.
  Use it for values that differ between environments, such as the site URL on staging and
  production. See [createEmails](sending.md#runtime-platform-values).

Data passed to `render()` can't override a platform value.

## Your own components

A component is a function that returns JSX. Put it outside the templates folder and import it with
a relative path; start the file with the same `@jsxImportSource` comment. See
[Components](components.md#your-own-components).
