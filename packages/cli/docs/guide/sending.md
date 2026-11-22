<!-- Generated from docs/guide/sending.md for AI coding agents: run `pnpm --filter @email-kit/cli test -u` after changing the docs. -->

# Rendering and sending

`email-kit compile` writes one module, `<out>/index.ts` (or `index.mjs` with `index.d.mts`), that
your server imports. It holds your templates, already parsed, with their types, and renders them
with [`@email-kit/runtime`](https://github.com/email-kit/email-kit/blob/main/packages/runtime/README.md): the only email-kit package your app
needs when it runs, so it's a `dependency` while everything else is a devDependency. The runtime
has no dependencies, and the module imports only the parts of it your templates use (about 1.5 KB
to 3 KB, minified and gzipped). email-kit doesn't send email; you hand what `render()` returns to
whatever sends your mail.

```ts
import { EmailRenderError, emails } from "@/email-kit"

const email = emails.orderShipped.render(
  {
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
  { locale: "en-GB" },
)

email.subject // "Order A-1042 has shipped"
email.html    // the HTML part
email.text    // the plain-text part
email.meta    // { id: "order-shipped", locale: "en", purpose: "transactional" }
```

## What the module exports

| Export | |
|---|---|
| `emails` | Every template, by the camelCase form of its id: `order-shipped` is `emails.orderShipped`. Only when the config has no [runtime sender values](#runtime-sender-values) |
| `createEmails(context)` | Builds the same object with the values that differ by environment. Always exported |
| `locales` | The compiled locales, the default first |
| `EmailRenderError` | The error `render()` and `createEmails()` throw. See [Errors](#errors) |

And these types:

| Type | |
|---|---|
| `OrderShippedData` (one per template) | The data `render()` takes, from the schema. A [`formatted`](templates.md#field-markers) field carries a comment saying how to format it |
| `TemplateId`, `Locale`, `Purpose` | Unions of the template ids, the compiled locales and the purposes |
| `Emails`, `EmailTemplate<Id, Data, Locale>` | The `emails` object and one entry of it |
| `RenderOptions`, `RenderedEmail<Id>`, `EmailParts` | `render()`'s options and result |
| `EmailContext` | What `createEmails()` takes |
| `DataIssue` | `{ path, message }`: one value that doesn't match the schema |

## Each email

| Member | |
|---|---|
| `render(data, options?)` | Validates the data, picks the locale and fills the templates. Returns a `RenderedEmail` |
| `validate(data)` | Checks data against the schema without rendering. Returns a list of `DataIssue`s, empty when the data is valid. Not there with `validate: false`, which leaves the validator out of your bundle |
| `meta` | `{ id, purpose, locales }` |

`render()` returns:

| Field | |
|---|---|
| `subject` | The subject line |
| `preheader` | The inbox preview text. It's already in `html` (hidden, at the top) and at the start of `text`, so you don't send it separately |
| `html` | The HTML part: a complete document |
| `text` | The plain-text part |
| `meta` | `{ id, locale, purpose }`, where `locale` is the compiled locale that was used |

Send `html` and `text` together, as a `multipart/alternative` message with `subject`.

### What render() does

1. Validates the data against the template's schema, unless the config sets `validate: false`.
2. Resolves the requested locale to a compiled one (see [Locales](#locales)).
3. Copies the data onto the schema: keys the schema doesn't declare are dropped, and missing
   optional keys become `null`, so they count as missing.
4. Fills the templates. Values are HTML-escaped (`&`, `<`, `>`, `"`, `'`) in `html`, and inserted
   as they are in `text` and `subject`.
5. Refuses a subject that contains a line break, which would let data inject mail headers.

## Data validation

`render()` checks the data against the schema before rendering: types, required and nullable
fields, enum values, length and range limits, patterns, and `https://` for [`url`](templates.md#field-markers)
fields. Bad data throws an `EmailRenderError` with the code `invalid-data`, and every problem with
its path:

```
The data for "order-shipped" doesn't match its schema:
  trackingUrl: must be an https URL, got "http://x.example"
  itemCount: expected a number, got "2"
  items[0].name: must be at least 1 character
```

`error.issues` has the same problems as a list:

```ts
try {
  const email = emails.orderShipped.render(data)
  // send it
} catch (error) {
  if (error instanceof EmailRenderError && error.code === "invalid-data") {
    console.error(error.issues) // [{ path: "itemCount", message: 'expected a number, got "2"' }, …]
  }
  throw error
}
```

Use `validate(data)` to check data before queueing it, or when it arrives from a queue or webhook:

```ts
const issues = emails.orderShipped.validate(payload)
if (issues.length > 0) return Response.json({ issues }, { status: 400 })
```

The generated types catch most mistakes in TypeScript; validation is for data whose type the
compiler can't see. With `validate: false` in the config, the module doesn't import the validator:
`render()` skips it, there's no `validate()`, and bad data either throws an `EmailRenderError`
from the renderer (such as `missing-value`) or renders as given.

## Locales

```ts
emails.orderShipped.render(data, { locale: "de-AT" }).meta.locale // "de"
```

`locale` takes any BCP 47 tag, in any case, with `-` or `_`. When no compiled locale matches, the
module tries your `locales.fallback` map and CLDR's parent locales, dropping subtags as it goes
(`de-AT` to `de`, `es-AR` to `es-419` to `es`), and ends at the default locale. Without `locale`,
it renders the default. `meta.locale` says which locale was used.

Pass the same locale you used to format dates and amounts for the recipient (see
[Formatting dates, money and numbers](formatting.md)).

## Runtime sender values

A sender value set to `{ runtime: true }` in the config is passed by your backend, once:

```ts
// email-kit.config.ts
sender: { productName: "Acme", siteUrl: { runtime: true } }
```

```ts
// at startup
import { createEmails } from "@/email-kit"

export const emails = createEmails({ siteUrl: process.env.SITE_URL ?? "" })
```

The module then exports `createEmails()` but no ready-made `emails`, so you can't forget the
values. `createEmails()` throws an `EmailRenderError` with the code `missing-context` if a runtime
key is missing or empty, and `invalid-context` if `siteUrl`, `helpUrl` or `privacyUrl` isn't an
`https://` URL or `supportEmail` isn't an email address: the rules the config applies to values set
there. Data passed to `render()` can't override them. Call `createEmails()` once and reuse the result.

## Per-template modules

With `perTemplateEntries: true` in the config, the compiler also writes `<out>/<id>/index.ts`
(`index.mjs` and `index.d.mts` with `module: "mjs"`): a module with the same API and only that one
email, for a function that sends one kind of email and should bundle nothing else. Import it by its
path in the output folder:

```ts
import { emails } from "./email-kit/_generated/order-shipped/index.ts"
```

## Errors

`EmailRenderError` has a `code`, a `message` and, for `invalid-data`, `issues`:

| Code | When |
|---|---|
| `invalid-data` | The data doesn't match the schema |
| `missing-context` | `createEmails()` lacks a runtime sender value, or it's empty |
| `invalid-context` | A URL sender value passed to `createEmails()` isn't `https://`, or `supportEmail` isn't an email address |
| `subject-line-break` | The rendered subject contains CR or LF, usually from user data. Strip line breaks before rendering |
| `missing-value`, `non-scalar-value`, `invalid-number` | A value can't fill its placeholder (spec [§10](../reference/mustache-core.md#10-errors)). With validation on, data that passes it doesn't cause these |
| `incompatible-module` | The installed `@email-kit/runtime` is a different version from the CLI that compiled the module. Install the same version and run `email-kit compile` |

See the [error reference](../reference/errors.md#at-send-time).

## Sending

email-kit has no integration with mail providers: pass the parts to the library or API you
already use. With [Nodemailer](https://nodemailer.com/) over SMTP:

```ts
import nodemailer from "nodemailer"

import { emails, type OrderShippedData } from "@/email-kit"

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
})

export async function sendOrderShipped(to: string, data: OrderShippedData, locale: string) {
  const { subject, html, text } = emails.orderShipped.render(data, { locale })
  await transport.sendMail({ from: "Acme <orders@acme.example>", to, subject, html, text })
}
```

Or with an HTTP API, such as Resend's, using `fetch`:

```ts
const { subject, html, text } = emails.orderShipped.render(data, { locale })

const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ from: "Acme <orders@acme.example>", to, subject, html, text }),
})
if (!response.ok) throw new Error(`Sending failed: ${response.status}`)
```

Other providers' APIs take the same three parts under their own field names; check your
provider's reference.

## Other backends

With `contract: true` in the config, the output folder also holds each email as files:
`<id>/<locale>.html` and `.txt` with `{{placeholders}}`, `<id>/schema.json` (JSON Schema 2020-12)
and `manifest.json` with the subjects, preheaders and hashes.

They're written in [mustache-core](../reference/mustache-core.md), a small subset of Mustache. A
backend in another language can render them with a renderer that follows the spec, including the
data preparation for plurals and selects (§15) and the locale resolution (§16). email-kit only
ships the JavaScript renderer, `@email-kit/runtime`; the
[conformance suite](https://github.com/email-kit/email-kit/blob/main/conformance/mustache-core/README.md) is there to test others.
