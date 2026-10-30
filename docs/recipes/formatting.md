# Formatting dates, money and numbers

email-kit templates don't format values at send time (R5). Your backend formats them for the
recipient and passes strings; the template prints them as they are. That keeps the output
identical whichever language renders it, and puts the recipient's locale and time zone where
they're known: in your backend.

Mark such fields in the schema, so the generated types tell whoever calls `render()`:

```ts
import { formatted } from "@email-kit/core"

schema: z.object({
  orderDate: z.string().meta(formatted("date")),
  deliveryWindow: z.string().meta(formatted("date-time")),
  total: z.string().meta(formatted("money")),
  savings: z.string().meta(formatted("percent")),
})
```

Kinds: `date`, `time`, `date-time`, `money`, `number`, `percent`. They appear in `schema.json`
(`"x-email-kit": { "formatted": "money" }`) and as a comment on the generated data type.

Use the same locale you pass to `render(data, { locale })`. `email-kit check` flags currency
symbols written next to an argument (`${total}`) and dates assembled from parts
(`{day}/{month}/{year}`) as `i18n.intl-format`.

## JavaScript and TypeScript

```ts
const locale = "de-DE"
const timeZone = "Europe/Berlin" // the recipient's, not the server's

const orderDate = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone }).format(order.createdAt)
// "30. Oktober 2026"

const total = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(43.6)
// "43,60 €" (Intl uses each currency's minor units: JPY has none)

const savings = new Intl.NumberFormat(locale, { style: "percent" }).format(0.1)
// "10 %"

emails.receipt.render({ orderDate, total, savings, … }, { locale })
```

Amounts stored in minor units (cents) need dividing first; for exact decimal arithmetic, format
from a string or a decimal library rather than a float you computed.

## Python

[Babel](https://babel.pocoo.org/) formats with CLDR data. It expects `de_DE`, so convert BCP 47 tags:

```python
from zoneinfo import ZoneInfo
from babel.dates import format_date
from babel.numbers import format_currency, format_percent

locale = "de-DE".replace("-", "_")
order_date = format_date(created_at.astimezone(ZoneInfo("Europe/Berlin")), format="long", locale=locale)
total = format_currency(43.60, "EUR", locale=locale)
savings = format_percent(0.1, locale=locale)
```

## Go

`golang.org/x/text` formats numbers for a locale (`message.NewPrinter(language.German)` with
`number.Decimal`, and `currency` for amounts). Neither it nor the standard library formats dates
by locale: use a CLDR-based package, or format dates in a service that has CLDR data. Check its
output against the JavaScript or Python result for your locales, since email-kit can't.

## Time zones

A date-time without the recipient's time zone is wrong for most of them. Store the zone with the
account, format in it, and name it when it matters ("14:05 CET"). Security alerts must say when
something happened in a zone the reader recognises (research 05 §9).
