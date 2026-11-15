# Components

`@email-kit/components` has the building blocks of an email body. Every value they draw with
(colours, type, spacing, radius) comes from the [theme](configuration.md#theme), and each colour
gets its dark-mode rule from it. They are built from tables and cell padding rather than margins,
following what email clients are known to support; they haven't been tested in real email
clients yet.

```tsx
import { Button, Heading, Text } from "@email-kit/components"
```

Every email is centred in a container of the theme's `layout.container` width (600px by default),
fluid below that width. The compiler adds it, so templates start straight with content. There's no
`Layout`, `Row` or `Column` component yet: content stacks in one column.

In the tables below, `Child` is anything a template can render: text, numbers, data fields,
messages from `t()`, elements, or arrays of them. A URL prop (`href`, `src`) takes a literal
string, a `url` field from `data`, or a sender value.

Most components leave space below themselves (16px unless stated), so a template is a plain list
of components.

| Component | For |
|---|---|
| [`Text`](#text) | A paragraph |
| [`Heading`](#heading) | A heading, h1 to h3 |
| [`Link`](#link) | A text link |
| [`Button`](#button) | A call to action |
| [`Image`](#image) | A content image |
| [`Divider`](#divider) | A horizontal rule |
| [`Spacer`](#spacer) | Vertical space |
| [`Section`](#section) | A padded block, optionally on a surface colour |
| [`List`, `ListItem`](#list-and-listitem) | A bulleted or numbered list |
| [`KeyValue`](#keyvalue) | Labelled facts, such as an order number and a date |
| [`Callout`](#callout) | A notice with a status colour |
| [`OtpCode`](#otpcode) | A one-time code |
| [`DataTable`](#datatable) | Tabular data with headers |
| [`LineItems`](#lineitems) | Itemised lines and totals for receipts and invoices |
| [`Footer`](#footer) | The footer of a transactional email |

## Text

A paragraph, in the body colour by default.

| Prop | Type | Default | |
|---|---|---|---|
| `children` | `Child` | | The text |
| `size` | `"lead"`, `"body"`, `"bodySm"` or `"caption"` | `"body"` | A step of the type scale: 18/28, 16/24, 14/22 or 14/20 px by default |
| `tone` | `"default"`, `"muted"` or `"subtle"` | `"default"` | The `ink`, `mutedInk` or `subtleInk` colour role |
| `align` | `"left"`, `"center"` or `"right"` | start of the line | Body copy reads best start-aligned |

```tsx
<Text>{t("intro")}</Text>
<Text size="caption" tone="muted">{t("legal")}</Text>
```

## Heading

A heading from the h1–h3 steps of the type scale.

| Prop | Type | Default | |
|---|---|---|---|
| `children` | `Child` | | The text |
| `level` | `1`, `2` or `3` | `1` | Use one h1 per email, then h2 and h3 without skipping a level (`a11y.one-h1`) |
| `align` | `"left"`, `"center"` or `"right"` | start of the line | |

```tsx
<Heading>{t("heading", { name: data.name })}</Heading>
<Heading level={2}>{t("details")}</Heading>
```

## Link

A text link in the theme's `link` colour, underlined so it isn't told apart by colour alone.

| Prop | Type | Default | |
|---|---|---|---|
| `href` | URL | | |
| `children` | `Child` | | The link text: it should make sense on its own (`a11y.link-text`) |
| `title` | `Child` | | A tooltip; never the only description of the link |

```tsx
<Text>
  {t("help")} <Link href={sender.helpUrl}>{t("helpLink")}</Link>
</Text>
```

In the plain-text part a link becomes `text: URL`.

## Button

A link styled as a button. Classic Outlook draws it with square corners.

| Prop | Type | Default | |
|---|---|---|---|
| `href` | URL | | |
| `children` | `Child` | | A short, verb-first label, such as "Track your parcel" |
| `variant` | `"primary"`, `"secondary"` or `"destructive"` | `"primary"` | The theme's action colours. Keep to one primary action per email |
| `size` | `"sm"`, `"md"` or `"lg"` | `"md"` | At least 36, 44 or 52 px tall. `sm` is under 44 px: use it for secondary actions only |
| `fullWidth` | `boolean` | `false` | Fill the container's width |
| `title` | `Child` | | A tooltip; never the only description of the action |

```tsx
<Button href={data.trackingUrl}>{t("track")}</Button>
<Button href={data.reviewUrl} variant="destructive">{t("review")}</Button>
<Button href={sender.helpUrl} variant="secondary" size="sm">{t("contact")}</Button>
```

## Image

A content image. `kind` says what the image is for, and decides which props it needs.

| Prop | Type | Default | |
|---|---|---|---|
| `kind` | `"decorative"`, `"informative"` or `"functional"` | | `decorative` adds nothing a reader needs (empty alt, skipped by screen readers); `informative` carries content; `functional` is a link |
| `src` | URL | | An absolute `https:` URL to a PNG, JPEG or GIF |
| `width` | `number` | | The display width in whole px. Serve about twice as many pixels for sharp high-density screens |
| `height` | `number` | | The display height in whole px |
| `alt` | `Child` | | `informative` and `functional` only, and required for them. What the image shows, or for a link, where it goes |
| `href` | URL | | `functional` only, and required for it |
| `fluid` | `boolean` | `false` | Scale down to the container's width on narrow screens |
| `rounded` | `boolean` | `false` | The theme's image radius. Classic Outlook draws square corners |
| `align` | `"left"` or `"center"` | start of the line | |

```tsx
<Image
  kind="functional"
  src="https://cdn.acme.example/logo@2x.png"
  alt={t("logoAlt", { product: sender.productName })}
  href="https://acme.example"
  width={120}
  height={30}
/>
<Image
  kind="informative"
  src="https://cdn.acme.example/hero@2x.png"
  alt={t("heroAlt")}
  width={536}
  height={200}
  fluid
  rounded
  align="center"
/>
```

A literal `src` is checked when the template compiles: SVG, WebP, AVIF, `http:` URLs, relative
paths and widths or heights that aren't whole numbers fail with
[`invalid-image`](../reference/errors.md#invalid-image), as does an empty `alt` on an informative or
functional image.

## Divider

A 1px horizontal rule in the theme's `divider` colour, with 16px of space above and below. It
takes no props.

```tsx
<Divider />
```

## Spacer

Vertical space of a fixed height.

| Prop | Type | Default | |
|---|---|---|---|
| `size` | `"sm"`, `"md"`, `"lg"` or `"section"` | `"md"` | 8, 16, 24 or 32 px |

```tsx
<Spacer size="lg" />
```

## Section

A block of content with padding, optionally on a surface colour.

| Prop | Type | Default | |
|---|---|---|---|
| `children` | `Child` | | |
| `padding` | `"none"`, `"sm"` or `"md"` | `"md"` | `md` is 32px on every side; `sm` is 16px |
| `surface` | `"canvas"`, `"card"` or `"muted"` | none | A background from the theme's surface roles. Without it the canvas shows through |

```tsx
<Section surface="muted" padding="sm">
  <Heading level={2}>{t("codeHeading")}</Heading>
  <OtpCode label={t("codeLabel")} code={data.code} />
</Section>
```

## List and ListItem

A real bulleted or numbered list. `List` holds `ListItem`s, or an `Each` of them.

| Prop | Type | Default | |
|---|---|---|---|
| `children` | `Child` | | `ListItem`s |
| `ordered` | `boolean` | `false` | A numbered list |

`ListItem` takes `children` only.

```tsx
<List ordered>
  <Each of={data.steps}>{(step) => <ListItem>{step}</ListItem>}</Each>
</List>
```

## KeyValue

Facts as labelled rows, such as an order number and a date. Neither layout uses columns, so both
read well on a phone. The plain-text part has a `Label: value` line for each.

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `KeyValueItem[]` | | The rows |
| `layout` | `"inline"` or `"stacked"` | `"inline"` | `inline` is "Label: value" on one line; `stacked` puts the label above the value |

`KeyValueItem`:

| Field | Type | |
|---|---|---|
| `label` | `Child` | |
| `value` | `Child` | |
| `copyable` | `boolean` | Lets a click select the whole value, in clients that support it |

```tsx
<KeyValue
  items={[
    { label: t("order"), value: data.orderNumber, copyable: true },
    { label: t("date"), value: data.date },
  ]}
/>
```

## Callout

A notice on a status surface, with a bold title. The title carries the meaning in words, so the
colour is never the only signal.

| Prop | Type | Default | |
|---|---|---|---|
| `tone` | `"info"`, `"success"`, `"warning"` or `"error"` | | The theme's status colours |
| `title` | `Child` | | Required |
| `children` | `Child` | | The body: text and links |

```tsx
<Callout tone="warning" title={t("notYouTitle")}>
  {t("notYou")}
</Callout>
```

## OtpCode

A one-time code: a label, then the code once, large and monospaced on the theme's code surface.
The code stays one run of characters, spaced with letter-spacing rather than split up, so copying
it gives the whole code.

| Prop | Type | Default | |
|---|---|---|---|
| `code` | `Child` | | Contiguous digits or letters, with no spaces or hyphens inside |
| `label` | `Child` | | Words that name it as a code and say what it's for, such as "Your code to sign in to Acme" |

```tsx
<OtpCode label={t("label", { product: sender.productName })} code={data.code} />
```

Mark the field with [`secret`](templates.md#field-markers) so `check` keeps it out of the subject
and preheader.

## DataTable

A real data table with a caption and header cells, for rows from a list field. Amounts align to
the end of the line. The plain-text part lists each row as `Header: value` lines.

| Prop | Type | Default | |
|---|---|---|---|
| `caption` | `Child` | | Names the table |
| `rows` | a list field | | Such as `data.logins` |
| `columns` | `DataTableColumn[]` | | At least two ([`invalid-table`](../reference/errors.md#invalid-table)); use `KeyValue` or `List` for one |
| `rowHeaders` | `boolean` | `true` | The first column heads its row |
| `summary` | `(SummaryRow \| OptionalRow)[]` | | Rows under the data, such as totals |

`DataTableColumn`:

| Field | Type | |
|---|---|---|
| `header` | `Child` | |
| `cell` | `(row) => Child` | The cell for one row, such as `(row) => row.time` |
| `align` | `"start"` or `"end"` | `end` for numbers and amounts. Default: `start` |
| `width` | `number` | In px |

`SummaryRow` is `{ label, amount, emphasis? }`: the label spans the leading columns and the amount
sits in the last; `emphasis` makes it bold with a strong rule above, for a grand total.
`optionalRow(field, (value) => row)` makes a summary row that shows only when an optional field is
present.

```tsx
<DataTable
  caption={t("recentCaption")}
  rows={data.recent}
  columns={[
    { header: t("time"), cell: (row) => row.time },
    { header: t("device"), cell: (row) => row.device },
  ]}
/>
```

## LineItems

Itemised lines and totals for receipts and invoices: a `DataTable` of the items, then the
subtotal, discounts, shipping, taxes and the total, in that order. Amounts are strings your backend
formats (see [Formatting dates, money and numbers](formatting.md)).

| Prop | Type | Default | |
|---|---|---|---|
| `caption` | `Child` | | Such as "Order A-1042" |
| `items` | a list field | | |
| `headers` | `{ item, qty, unitPrice?, lineTotal }` | | Column headers. The unit price column appears when both its header and its cell are given |
| `cells` | `{ name, meta?, qty, unitPrice?, lineTotal }` | | Functions from an item to its cells. `meta` is a second line under the name, such as a size |
| `subtotal` | `SummaryRow` | | |
| `discounts` | `(SummaryRow \| OptionalRow)[]` | | Shown as given, so write them as negative amounts |
| `shipping` | `SummaryRow \| OptionalRow` | | |
| `taxes` | `(SummaryRow \| OptionalRow)[]` | | Each label names the rate and whether it's included, such as "VAT 20% (included)" |
| `total` | `SummaryRow` | | Required; always emphasised |

```tsx
<LineItems
  caption={t("caption", { order: data.orderNumber })}
  items={data.items}
  headers={{ item: t("item"), qty: t("qty"), lineTotal: t("lineTotal") }}
  cells={{
    name: (item) => item.name,
    meta: (item) => <If when={item.variant}>{(variant) => variant}</If>,
    qty: (item) => item.qty,
    lineTotal: (item) => item.total,
  }}
  subtotal={{ label: t("subtotal"), amount: data.subtotal }}
  discounts={[optionalRow(data.discount, (discount) => ({ label: t("discount"), amount: discount }))]}
  shipping={{ label: t("shipping"), amount: data.shipping }}
  taxes={[{ label: t("vat"), amount: data.vat }]}
  total={{ label: t("total"), amount: data.total }}
/>
```

email-kit doesn't check that the amounts add up: your backend computes them.

## Footer

The footer of a transactional email: why the reader got it, who sent it and from where, and the
help and privacy links, in small muted type under a hairline. Unsubscribe links and the other
marketing parts don't exist yet.

`check` requires a reason line and a sender in every email (`legal.reason`,
`legal.sender-identity`), and a postal address in `marketing` and `consent-request` emails
(`legal.postal-address`). It finds them by the classes `Footer` puts on its parts:
`ek-footer-reason`, `ek-footer-sender` and `ek-footer-address`. A footer you build yourself
passes the same checks if it carries those classes.

| Prop | Type | Default | |
|---|---|---|---|
| `reason` | `Child` | | Why the reader got the email, naming the account or relationship. Required |
| `sender` | `Child` | | Who sends it: the legal name or brand, such as `sender.legalName`. Required |
| `address` | `Child` | | The postal address, such as `sender.postalAddress` |
| `links` | `FooterLink[]` | | `{ href, label }` each: help or contact first, then privacy. Shown on one line, separated by a middle dot |

```tsx
<Footer
  reason={t("footer", { product: sender.productName })}
  sender={sender.legalName}
  address={sender.postalAddress}
  links={[
    { href: sender.helpUrl, label: t("help") },
    { href: sender.privacyUrl, label: t("privacy") },
  ]}
/>
```

## Your own components

A component is a function that takes props and returns JSX. Start the file with
`/** @jsxImportSource @email-kit/core */`, keep it in a folder whose name starts with `_`, such as `_shared/`, and import it
with a relative path. Build on the components above where you can: `check` expects text to have a px
line height and an explicit direction, which `Text` and `Heading` give you.

Colour things with theme roles rather than literal colours: `role("muted")` writes the light value
inline and tags the element so the dark value applies in dark mode. `check` fails on literal
colours, font families and font sizes in templates and your components
(`source.no-literal-colour`, `source.no-font-family`, `source.no-font-size`). `useTheme()` gives
the resolved theme (spacing, radius and the type scale in px, the light colours as hex), and
`useDirection()` the writing direction of the locale being compiled. For text in an element of your
own, `font(step)` from `@email-kit/components` gives a type step's family stack, px size and line
height, and the line-height rule classic Outlook needs:
`<p style={{ margin: "0", ...font("bodySm"), color: role("mutedInk") }}>`.

```tsx
/** @jsxImportSource @email-kit/core */
import { Text } from "@email-kit/components"
import { type Child, role, useTheme } from "@email-kit/core"

/** A muted note on its own surface. */
export function Note(props: { readonly children?: Child }) {
  const { space } = useTheme()
  return (
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tbody>
        <tr>
          <td
            style={{
              padding: `${space.stack.md}px ${space.stack.md}px 0`,
              backgroundColor: role("muted"),
            }}
          >
            <Text size="bodySm" tone="muted">
              {props.children}
            </Text>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
```

The colour roles are listed under [roles](configuration.md#roles).
