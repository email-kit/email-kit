# Your first email

This tutorial builds an "order shipped" email from scratch: the email a shop sends when a parcel
leaves the warehouse. Along the way it covers each part of a template: the data it takes, sample
data, components, copy, conditions, plurals and selects, a second language, the checks, and
sending.

It assumes you've done [Getting started](getting-started.md), so the project has
`email-kit.config.ts` and a `src/email-kit/` folder. The examples import from `@/email-kit`; use
the import path `init` set up for you.

## 1. Create the template

```sh
npx email-kit new order-shipped
```

```
Created src/email-kit/order-shipped/template.tsx
   and src/email-kit/order-shipped/messages.en.json
```

`new` writes a small working template and a message file for every locale in the config. The id,
`order-shipped`, is the folder's name, and your app will call the email `emails.orderShipped`.
Ids are lowercase words joined by hyphens.

The starter compiles and passes `check` as it is, so replace its placeholder copy before you ship
it. The next steps replace all of it.

## 2. Describe the data

The schema says what data the email takes. `render()` validates against it, and the generated
types come from it. Open `template.tsx` and replace the schema:

```tsx
import { defineEmail, formatted, url } from "@email-kit/core"
import { z } from "zod"

schema: z.object({
  name: z.string().min(1),
  orderNumber: z.string().min(1),
  carrier: z.enum(["dhl", "ups", "other"]),
  trackingUrl: z.string().meta(url),
  deliveryDate: z.string().min(1).meta(formatted("date")),
  itemCount: z.number().int().min(1),
  items: z
    .array(z.object({ name: z.string().min(1), qty: z.number().int().min(1) }))
    .min(1)
    .max(20),
  express: z.boolean(),
  giftMessage: z.string().min(1).optional(),
}),
```

A few things here are specific to email:

- **`.meta(url)` marks a URL.** Only `url` fields can go in an `href` or `src`, and `render()`
  refuses a value that isn't an `https://` URL.
- **`.meta(formatted("date"))` marks a value your backend formats.** Templates don't format dates
  or money; your backend does, in the recipient's language and time zone, and passes a string
  ("3 November 2026"). See [Formatting dates, money and numbers](formatting.md).
- **`itemCount` is its own field.** Templates place data but can't compute with it, so
  `items.length` isn't available. The backend passes the count.
- **`carrier` is an enum.** The copy can then choose words per value (a select, in step 5).
- **Limits matter.** `check` also renders each email with generated data: empty strings at their
  minimum length, and long lists. `.min(1)` stops "Hi, !" and `.max(20)` keeps the email under
  Gmail's size limit.

The schema can use Zod, Valibot or ArkType; [Templates](templates.md#schemas) shows all three.

## 3. Add sample data

Fixtures are named sample data. `check` renders every one, and the compile fails if one doesn't
match the schema. Add one per case that changes how the email looks:

```tsx
fixtures: {
  default: {
    name: "Ada",
    orderNumber: "A-1042",
    carrier: "dhl",
    trackingUrl: "https://track.example.com/A-1042",
    deliveryDate: "3 November 2026",
    itemCount: 2,
    items: [
      { name: "Green tea", qty: 1 },
      { name: "Lemon cake", qty: 1 },
    ],
    express: false,
  },
  "express-gift": {
    name: "Ada",
    orderNumber: "A-1043",
    carrier: "ups",
    trackingUrl: "https://track.example.com/A-1043",
    deliveryDate: "Tomorrow",
    itemCount: 1,
    items: [{ name: "Teapot", qty: 1 }],
    express: true,
    giftMessage: "Happy birthday!",
  },
},
```

## 4. Lay out the body

The body is a list of components from `@email-kit/components`. They take their colours, fonts and
spacing from your [theme](theme.md), and write the tables and Outlook fixes email clients need.

```tsx
import { Button, Footer, Heading, KeyValue, List, ListItem, Text } from "@email-kit/components"
import { defineEmail, Each, formatted, url } from "@email-kit/core"

subject: (data, t) => t("subject", { order: data.orderNumber }),
preheader: (data, t) => t("preheader", { date: data.deliveryDate }),
component: ({ data, t, sender }) => (
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
    <Button href={data.trackingUrl}>{t("track")}</Button>
    <Footer
      reason={t("footer", { product: sender.productName })}
      sender={sender.productName}
      links={[{ href: sender.helpUrl, label: t("help") }]}
    />
  </>
),
```

- **`subject` and `preheader`** are the subject line and the preview text inboxes show after it.
- **`<Each>`** repeats its content once per item in a list field. Inside, `item.name` is a
  placeholder for each item's name.
- **`sender`** holds facts about your company from the config, such as `sender.productName`.
- **`<Footer>`** says why the reader got the email, and links to help.

You don't write `<html>`, `<head>` or a container: the compiler adds them, and centres the email
at your theme's width. [Components](components.md) lists every component and its props.

## 5. Write the copy

Every word the reader sees comes from `messages.en.json`, through `t()`. Replace its contents:

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
  "help": "Help centre"
}
```

Messages use ICU syntax:

- **`{name}`** inserts a parameter. `t("heading", { name: data.name })` passes it.
- **A plural**, `{count, plural, one {…} other {…}}`, picks words by a number when the email is
  sent: "1 item is", "2 items are". `#` prints the number.
- **A select**, `{carrier, select, dhl {…} ups {…} other {…}}`, picks words by an enum value.

`t()` is typed from these files after each compile: a misspelt key or a missing parameter is an
error in your editor, and every locale must have every key. More in
[Messages and locales](messages.md).

## 6. Show content conditionally

Some lines depend on the data: one for express delivery, another for standard, and the gift
message only when there is one. Add `If` and `Unless` to the imports, and these before the
`<Button>`:

```tsx
import { defineEmail, Each, formatted, If, Unless, url } from "@email-kit/core"

<If when={data.express}>
  <Text>{t("express")}</Text>
</If>
<Unless when={data.express}>
  <Text tone="muted">{t("standard")}</Text>
</Unless>
<If when={data.giftMessage}>
  {(message) => <Text tone="muted">{t("gift", { message })}</Text>}
</If>
```

These are decided at send time, from the data. `If` with a function child passes the field to it,
as a value that's always there, so it can go where a required value is expected, like a `t()`
parameter. A condition that doesn't depend on data, such as a feature flag in your code, is plain
JavaScript instead: `{showSurvey && <Text>…</Text>}`.

<details>
<summary>The whole template</summary>

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
    items: z
      .array(z.object({ name: z.string().min(1), qty: z.number().int().min(1) }))
      .min(1)
      .max(20),
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
        { name: "Green tea", qty: 1 },
        { name: "Lemon cake", qty: 1 },
      ],
      express: false,
    },
    "express-gift": {
      name: "Ada",
      orderNumber: "A-1043",
      carrier: "ups",
      trackingUrl: "https://track.example.com/A-1043",
      deliveryDate: "Tomorrow",
      itemCount: 1,
      items: [{ name: "Teapot", qty: 1 }],
      express: true,
      giftMessage: "Happy birthday!",
    },
  },
  component: ({ data, t, sender }) => (
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
        reason={t("footer", { product: sender.productName })}
        sender={sender.productName}
        links={[{ href: sender.helpUrl, label: t("help") }]}
      />
    </>
  ),
})
```

</details>

## 7. Compile

```sh
npm run email-kit:compile
```

The compile fails, and says why:

```
✗ src/email-kit/order-shipped/template.tsx:83:32 [sender-value-missing]
  The template uses sender.helpUrl, but email-kit.config.ts doesn't set it. Add `sender: { helpUrl: "…" }`, or `sender: { helpUrl: { runtime: true } }` to pass it at send time

  > 83 |         links={[{ href: sender.helpUrl, label: t("help") }]}
       |                                ^

  Docs: https://github.com/email-kit/email-kit/blob/main/docs/reference/errors.md#sender-value-missing

1 problem; nothing was written.
```

The footer links to `sender.helpUrl`, which the config doesn't set yet. Add it in
`email-kit.config.ts`:

```ts
sender: { productName: "Shop", helpUrl: "https://help.shop.example" },
```

Compile again:

```
Compiled 2 templates × 1 locale into src/email-kit/_generated (2 files: 2 written, 0 unchanged, 0 removed)
```

Every compile error has an id in brackets and a link to the
[error reference](../reference/errors.md). The one you'll meet most is `placeholder-misuse`,
from computing with data in a template:

```tsx
<Heading>{t("heading", { name: data.name.toUpperCase() })}</Heading>
```

```
✗ src/email-kit/order-shipped/template.tsx:53:48 [placeholder-misuse]
  The placeholder {{name.toUpperCase}} was called like a function at compile time. Templates only place data; they can't compute with it, because the value only exists at send time. Compute the value in the backend and pass it as its own field.
```

## 8. Render it

```ts
import { emails } from "@/email-kit"

const email = emails.orderShipped.render({
  name: "Ada",
  orderNumber: "A-1042",
  carrier: "dhl",
  trackingUrl: "https://track.example.com/A-1042",
  deliveryDate: "3 November 2026",
  itemCount: 2,
  items: [
    { name: "Green tea", qty: 1 },
    { name: "Lemon cake", qty: 1 },
  ],
  express: false,
})
```

`email.subject` is "Order A-1042 has shipped", and `email.text` is:

```
Arriving 3 November 2026

It's on its way, Ada
=====================

2 items are on the way with DHL.

Order: A-1042

Expected delivery: 3 November 2026

- Green tea × 1
- Lemon cake × 1

You chose standard delivery.

Track your parcel: https://track.example.com/A-1042
```

The data is typed as `OrderShippedData`, so mistakes show in your editor:

```
error TS2322: Type '"fedex"' is not assignable to type '"dhl" | "ups" | "other"'.
```

Data that TypeScript can't see, such as a queue payload, is checked when you render. Bad data
throws an `EmailRenderError` that lists every problem:

```
The data for "order-shipped" doesn't match its schema:
  trackingUrl: must be an https URL, got "http://x.example"
  itemCount: expected a number, got "2"
```

## 9. Run the checks

```sh
npm run email-kit:check
```

The checks look for problems the compile can't call errors: accessibility, dark mode, size, links,
copy. Say you'd labelled the button "Click here":

```
order-shipped (en)
  ! a11y.link-text  src/email-kit/order-shipped/template.tsx
    Generic link text "Click here"
    Fix: Say where the link goes ("View your order"): screen reader users list links out of context.
    Docs: https://github.com/email-kit/email-kit/blob/main/docs/reference/checks.md#a11ylink-text

0 errors, 1 warning, 2 notes
```

`!` is a warning, `✗` an error and `i` a note. Only errors fail `check`, but fix warnings too: each
one names the fix. If a check doesn't suit your project, you can turn it down with a reason; see
[Checks and CI](checks-and-ci.md#change-a-checks-level).

## 10. Add a second language

Add German to the locales in `email-kit.config.ts`:

```ts
locales: { default: "en", list: ["en", "de"] },
```

The compile now asks for the copy:

```
✗ src/email-kit/order-shipped/template.tsx:23:25 [missing-message]
  Locale "de" has no message "subject": add it to src/email-kit/order-shipped/messages.de.json
```

Create `order-shipped/messages.de.json` with the same keys:

```json
{
  "subject": "Bestellung {order} ist unterwegs",
  "preheader": "Ankunft am {date}",
  "heading": "Ihre Bestellung ist unterwegs, {name}",
  "intro": "{count, plural, one {# Artikel ist} other {# Artikel sind}} mit {carrier, select, dhl {DHL} ups {UPS} other {unserem Kurier}} unterwegs.",
  "order": "Bestellung",
  "delivery": "Voraussichtliche Lieferung",
  "express": "Sie haben Expressversand gewählt.",
  "standard": "Sie haben Standardversand gewählt.",
  "gift": "Ihre Geschenknachricht: {message}",
  "track": "Sendung verfolgen",
  "footer": "Sie erhalten diese E-Mail, weil Sie bei {product} bestellt haben.",
  "help": "Hilfe"
}
```

Every template needs a file for every locale, so if you kept the welcome email, give it a
`welcome/messages.de.json` too. Then compile, and render with the recipient's locale:

```ts
const email = emails.orderShipped.render(data, { locale: "de-AT" })

email.subject     // "Bestellung A-1042 ist unterwegs"
email.meta.locale // "de"
```

`locale` takes any language tag. `de-AT` (Austrian German) has no messages of its own, so it falls
back to `de`; a language you don't have falls back to the default, `en`.

## 11. Send it

Put it together in a function your app calls when an order ships. It formats the date for the
recipient, renders and sends:

```ts
import { emails, type OrderShippedData } from "@/email-kit"

type Order = Omit<OrderShippedData, "deliveryDate"> & { deliveryDate: Date }

export async function sendOrderShipped(to: string, locale: string, timeZone: string, order: Order) {
  const deliveryDate = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone }).format(
    order.deliveryDate,
  )
  const { subject, html, text } = emails.orderShipped.render({ ...order, deliveryDate }, { locale })

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: "Shop <orders@shop.example>", to, subject, html, text }),
  })
  if (!response.ok) throw new Error(`Sending failed: ${response.status}`)
}
```

Commit the template, its messages and the `_generated` folder together.

## What's next

- [Templates](templates.md): everything `defineEmail` takes, field markers, fixtures and control
  flow in detail.
- [Components](components.md): `DataTable`, `LineItems`, `OtpCode`, `Callout` and the rest.
- [Theme and dark mode](theme.md): use your brand's colours and fonts.
- [Rendering and sending](sending.md): the full API, runtime sender values and per-template modules.
