# Messages and locales

Every word an email shows lives in message files, one per template and locale, beside the
template: `order-shipped/messages.en.json`, `order-shipped/messages.de.json`. Each is a flat
object of keys and [ICU messages](https://unicode-org.github.io/icu/userguide/format_parse/messages/).
Templates are compiled once per locale, from that locale's file.

```
order-shipped/
  template.tsx
  messages.en.json
  messages.de.json
```

## Messages

`t(key, params)` looks a message up in the locale being compiled:

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

A parameter can be text, a number, a data field, a sender value, or another message:
`t("footer", { product: sender.productName })`. `subject` and `preheader` get `t` too:
`subject: (data, t) => t("subject", { order: data.orderNumber })`.

Keys in a message file that no template uses are reported by `check` (`i18n.unused-keys`).

### Typed t()

`email-kit compile` writes `_generated/messages.d.ts` from the default locale's messages. With it in
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
zero. `=N` cases match exact whole numbers before the categories:

```json
{ "trial": "{days, plural, =1 {Your trial ends tomorrow.} one {Your trial ends in # day.} other {Your trial ends in # days.}}" }
```

`other` is always required, and plural offsets aren't supported. See
[`invalid-plural`](../reference/errors.md#invalid-plural).

### Selects

```json
{ "shipping": "Sent with {carrier, select, dhl {DHL} ups {UPS} other {our courier}}." }
```

A select takes a field with fixed values, such as `z.enum(["dhl", "ups", "other"])`. Each case
must be one of its values, and `other` is required. A free string field is refused
([`invalid-select`](../reference/errors.md#invalid-select)).

### What messages can't do

Only plain `{name}` arguments, `plural` and `select` are supported. `{amount, number}`,
`{date, date}` and the like fail the compile ([`unsupported-message`](../reference/errors.md#unsupported-message)):
pass the value formatted by your backend as a string instead. See
[Formatting dates, money and numbers](formatting.md).

ICU quoting applies: `'{'` is a literal brace and `''` is an apostrophe. An apostrophe on its own,
as in "You're", needs no quoting.

## Locales

The config lists the locales to compile:

```ts
locales: {
  default: "en",
  list: ["en", "de", "pt-BR"],
  fallback: { pt: "pt-BR" },
}
```

| Field | Default | |
|---|---|---|
| `default` | `"en"` | The locale `render()` falls back to. It's first in the output |
| `list` | only the default | Every locale to compile. It must include the default |
| `fallback` | `{}` | Where a requested locale goes when no compiled locale matches it, before CLDR's parents. `{ pt: "pt-BR" }` sends `pt` and `pt-AO` to Brazilian Portuguese. Each key must not be compiled; each value must be |
| `pseudo` | `false` | Also compile and ship the [pseudo-locales](#pseudo-locales) |

Tags must be canonical BCP 47: `en`, `pt-BR`, `zh-Hant`, not `en_US` or `pt-br`.

### Adding a locale

1. Add it to `locales.list`.
2. Add a `messages.<locale>.json` with every key to each template's folder. The compile names
   each missing file and key ([`missing-message`](../reference/errors.md#missing-message)).
3. Compile.

`email-kit new` writes a message file for every locale in the config, each with the same starter
copy for translators to replace.

### Choosing a locale at send time

`render(data, { locale })` takes any BCP 47 tag, in any case, with `-` or `_`. When no compiled
locale matches, it tries your `fallback` map and CLDR's parent locales, dropping subtags as it
goes (`de-AT` to `de`, `es-AR` to `es-419` to `es`), and ends at the default locale.
`meta.locale` says which locale was used. See [Rendering and sending](sending.md#locales).

### Right-to-left languages

A locale whose language is written right to left (Arabic, Hebrew, Persian, Urdu and a few others)
gets `dir="rtl"`, and the components align to match.

### Pseudo-locales

Two pseudo-locales are generated from the default locale's messages, for testing layout without
translations:

- `en-XA`: accented, bracketed and padded up to three times longer, to show truncation and
  overflow;
- `ar-XB`: wrapped in right-to-left overrides, to show mirroring problems.

`email-kit check` builds both every time and runs the checks on them. To ship them in the module,
for QA on staging, set `locales.pseudo: true`, or a list such as `["en-XA"]`.
