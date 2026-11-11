/** @jsxImportSource @email-kit/core */
// The components compiled end to end with the built-in theme: both parts, and the dark CSS.

import {
  Callout,
  DataTable,
  Footer,
  Image,
  KeyValue,
  LineItems,
  List,
  ListItem,
  OtpCode,
  optionalRow,
  Text,
} from "@email-kit/components"
import {
  defineEmail,
  Each,
  type EmailDefinitionInput,
  If,
  type StandardSchemaV1,
} from "@email-kit/core"
import { describe, expect, it } from "vitest"

import { compileEmail } from "../src/compiler/compile.ts"

interface Data {
  code: string
  orderNumber: string
  steps: { title: string }[]
  lines: { name: string; qty: string; total: string; size?: string }[]
  subtotal: string
  discount?: string
  vat: string
  total: string
}

const schema = {
  "~standard": { version: 1, vendor: "test", validate: (value: unknown) => ({ value }) },
} as Schema

type Schema = StandardSchemaV1<Data, Data>

function compile(component: EmailDefinitionInput<Schema>["component"], locale = "en") {
  const definition = defineEmail<Schema>({
    id: "test",
    purpose: "transactional",
    schema,
    subject: () => "Subject",
    fixtures: {},
    component,
  })
  const email = compileEmail(definition, { locale, messages: {} })
  const body = email.html.slice(email.html.indexOf("<body"))
  return { ...email, body, count: (s: string) => body.split(s).length - 1 }
}

describe("OtpCode", () => {
  const email = compile(({ data }) => (
    <OtpCode label="Your code to sign in to Shop Example" code={data.code} />
  ))

  it("shows the code once in each part, next to its label (copy.code-once)", () => {
    expect(email.count("{{code}}")).toBe(1)
    expect(email.text.split("{{code}}").length - 1).toBe(1)
    expect(email.text).toContain("Your code to sign in to Shop Example\n\n{{code}}\n")
  })

  it("keeps the code contiguous: one text node, spaced by letter-spacing", () => {
    expect(email.body).toMatch(/letter-spacing:6px;[^"]*user-select:all"[^>]*>\{\{code\}\}<\/p>/)
    expect(email.body).toContain("font-size:28px")
    expect(email.body).not.toContain('aria-label="{{code}}')
  })

  it("sits on the code surface, tagged for dark mode", () => {
    expect(email.body).toContain('class="ek-bg--codeSurface"')
    expect(email.html).toMatch(/\[data-ogsb\] \.ek-bg--codeSurface \{/)
  })

  it("keeps its monospaced font in classic Outlook, through a class the font rule targets", () => {
    expect(email.body).toMatch(/<p [^>]*class="ek-font--mono ek-c--ink">\{\{code\}\}<\/p>/)
    expect(email.html).toContain(
      "{ font-family: Arial, sans-serif !important; } .ek-font--mono { font-family: 'Courier New', monospace !important; }</style><![endif]-->",
    )
    expect(email.body.match(/ek-font--/g)).toHaveLength(1)
  })
})

describe("KeyValue", () => {
  const items = [
    { label: "Order", value: "A-1042", copyable: true },
    { label: "Date", value: "30 October" },
  ]

  it("writes inline rows as one wrapping line each", () => {
    const email = compile(() => <KeyValue items={items} />)
    expect(email.body).toMatch(
      /class="ek-c--mutedInk">Order:<\/span> <span style="-webkit-user-select:all;user-select:all">A-1042<\/span><\/p>/,
    )
    expect(email.text).toContain("Order: A-1042\n\nDate: 30 October\n")
  })

  it("leaves the usual gap below the last inline row, like every other block", () => {
    const email = compile(() => <KeyValue items={items} />)
    expect(email.count('<td style="padding:0 0 8px">')).toBe(1)
    expect(email.body).toMatch(/<td style="padding:0 0 16px"><p [^>]*><span[^>]*>Date:/)
  })

  it("puts stacked labels above values in HTML, and Label: value in the text part", () => {
    const email = compile(() => <KeyValue layout="stacked" items={items} />)
    expect(email.body).toMatch(/>Order<\/p>\n?<p [^>]*><span[^>]*>A-1042<\/span><\/p>/)
    expect(email.body).not.toContain("Order:")
    expect(email.text).toContain("Order: A-1042\n\nDate: 30 October\n")
  })
})

describe("List", () => {
  it("numbers ordered items in the text part when they are known", () => {
    const email = compile(() => (
      <List ordered>
        <ListItem>Open the app</ListItem>
        <ListItem>Enter the code</ListItem>
      </List>
    ))
    expect(email.body).toMatch(
      /<ol style="margin:0 24px 16px;padding:0"><li style="margin:0 0 8px;[^"]*" class="ek-c--ink">Open the app<\/li>/,
    )
    expect(email.text).toContain("1. Open the app\n2. Enter the code\n")
  })

  it("keeps bullets for repeated items, which a template can't count", () => {
    const email = compile(({ data }) => (
      <List ordered>
        <Each of={data.steps}>{(step) => <ListItem>{step.title}</ListItem>}</Each>
      </List>
    ))
    expect(email.text).toContain("{{#steps}}\n- {{title}}\n{{/steps}}")
  })
})

describe("Callout", () => {
  it("paints the status surface and border, with title and body in the status ink", () => {
    const email = compile(() => (
      <Callout tone="warning" title="Your card expires soon">
        Update it before 1 November.
      </Callout>
    ))
    expect(email.body).toContain(
      'class="ek-bg--status-warning-surface ek-bc--status-warning-border"',
    )
    expect(email.count('class="ek-c--status-warning-ink"')).toBe(2)
    expect(email.body).toMatch(
      /font-weight:700;[^"]*" class="ek-c--status-warning-ink">Your card expires soon<\/p>/,
    )
    expect(email.text).toContain("Your card expires soon\n\nUpdate it before 1 November.\n")
    expect(email.html).toMatch(
      /\.ek-bg--status-warning-surface \{ background-color: #[0-9a-f]{6} !important; \}/,
    )
  })

  it("leaves no bottom margin under a title on its own", () => {
    const email = compile(() => <Callout tone="info" title="Scheduled maintenance tonight" />)
    expect(email.body).toMatch(
      /<p style="margin:0;font-family[^"]*" class="ek-c--status-info-ink">Scheduled/,
    )
  })
})

describe("Footer", () => {
  const footer = () =>
    compile(() => (
      <Footer
        reason="You received this email because you have an account with Shop."
        sender="Shop Example GmbH"
        address="Hauptstraße 1, 10115 Berlin"
        links={[
          { href: "https://shop.example/help", label: "Help" },
          { href: "https://shop.example/privacy", label: "Privacy" },
        ]}
      />
    ))

  it("puts the reason, sender, address and links in muted footer type under a hairline", () => {
    const email = footer()
    expect(email.body).toMatch(
      /border-top-color:#[0-9a-f]{6}" class="ek-border-top-color--hairline"/,
    )
    // Each part is marked for the legal.* checks.
    for (const part of ["reason", "sender", "links"]) {
      expect(email.count(`class="ek-footer-${part} ek-c--mutedInk"`)).toBe(1)
    }
    expect(email.body).toContain("font-size:14px;line-height:20px")
    expect(email.body).toContain(
      'Shop Example GmbH<br><span class="ek-footer-address">Hauptstraße 1, 10115 Berlin</span>',
    )
    expect(email.body).toMatch(/>Help<\/a> · <a href="https:\/\/shop.example\/privacy"/)
  })

  it("writes each part on its own lines in the text part, with the link URLs", () => {
    expect(footer().text).toContain(
      "You received this email because you have an account with Shop.\n\nShop Example GmbH\nHauptstraße 1, 10115 Berlin\n\nHelp",
    )
    expect(footer().text).toContain("https://shop.example/privacy")
  })

  it("leaves the address and links out when they aren't given", () => {
    const email = compile(() => <Footer reason="Why you got this." sender="Shop" />)
    expect(email.body).not.toContain("<br>")
    expect(email.body).not.toContain("<a ")
  })
})

describe("Text in the default theme", () => {
  it("is ink on the canvas the wrapper paints", () => {
    const email = compile(() => <Text>Hello</Text>)
    expect(email.body).toContain(
      'style="background-color:#ffffff;color:#0a0a0a" class="ek-bg--canvas ek-c--ink"',
    )
  })
})

describe("Image", () => {
  const src = "https://cdn.shop.example/hero.png"

  it("writes integer dimensions, display:block and styled alt text (research 01 §6.2, 02 A16)", () => {
    const email = compile(() => (
      <Image kind="informative" src={src} alt="A teapot" width={600} height={300} />
    ))
    expect(email.body).toMatch(
      /<img src="https:\/\/cdn\.shop\.example\/hero\.png" alt="A teapot" width="600" height="300" border="0" style="display:block;border:0;outline:none;text-decoration:none;font-family:[^"]*;font-size:14px;[^"]*color:#[0-9a-f]{6}" class="ek-c--mutedInk">/,
    )
    // Void elements are never self-closed: Yahoo drops their class otherwise.
    expect(email.body).not.toContain("/>")
    expect(email.text).toContain("A teapot\n")
  })

  it("scales fluid images with width:100% and a max-width", () => {
    const email = compile(() => (
      <Image kind="decorative" src={src} width={600} height={300} fluid />
    ))
    expect(email.body).toContain('alt="" width="600" height="300"')
    expect(email.body).toContain("display:block;width:100%;max-width:600px;height:auto;")
    expect(email.text.trim()).toBe("")
  })

  it("links a functional image, and its text form names the action", () => {
    const email = compile(() => (
      <Image
        kind="functional"
        src={src}
        alt="View your order"
        href="https://shop.example/orders"
        width={200}
        height={40}
        align="center"
      />
    ))
    expect(email.body).toMatch(
      /<td align="center" style="padding:0 0 16px"><a href="https:\/\/shop\.example\/orders" target="_blank" rel="noopener" style="text-decoration:none"><img /,
    )
    expect(email.text).toContain("View your order: https://shop.example/orders")
  })

  it.each([
    [{ src: "http://cdn.shop.example/a.png" }, "must use https:"],
    [{ src: "/a.png" }, "absolute https: URL"],
    [{ src: "https://cdn.shop.example/logo.svg" }, "SVG shows blank"],
    [{ src: "https://cdn.shop.example/a.webp" }, "WebP or AVIF"],
    [{ src: "https://cdn.shop.example/a" }, ".png, .jpg or .gif"],
    [{ width: 299.5 }, "width must be a whole number"],
    [{ alt: " " }, "needs alt text"],
  ])("rejects %o", (change, message) => {
    const props = {
      kind: "informative",
      src,
      alt: "A teapot",
      width: 600,
      height: 300,
      ...change,
    } as const
    expect(() => compile(() => <Image {...props} />)).toThrow(
      expect.objectContaining({ code: "invalid-image", message: expect.stringContaining(message) }),
    )
  })
})

describe("DataTable", () => {
  const table: EmailDefinitionInput<Schema>["component"] = ({ data }) => (
    <DataTable
      caption="Your items"
      rows={data.lines}
      columns={[
        { header: "Item", cell: (row) => row.name },
        { header: "Qty", cell: (row) => row.qty, align: "end", width: 60 },
        { header: "Total", cell: (row) => row.total, align: "end" },
      ]}
    />
  )

  it("is a real table: caption, column and row headers, no presentation role (02 A23)", () => {
    const email = compile(table)
    const html = email.body.slice(
      email.body.indexOf(
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">',
      ),
    )
    expect(html).toMatch(
      /^<table [^>]*><caption style="padding:0 0 8px;text-align:left;[^"]*font-weight:700;[^"]*" class="ek-c--ink">Your items<\/caption>/,
    )
    expect(html.slice(0, html.indexOf("</table>"))).not.toContain("presentation")
    expect(html).toMatch(/<th scope="col" style="[^"]*text-align:left;[^"]*"[^>]*>Item<\/th>/)
    expect(html).toMatch(/<th scope="col" width="60" style="[^"]*text-align:right;/)
    expect(html).toMatch(
      /\{\{#lines\}\}<tr><th scope="row" [^>]*>\{\{name\}\}<\/th>\n?<td style="[^"]*text-align:right;/,
    )
  })

  it("aligns to the physical sides of a right-to-left locale", () => {
    const email = compile(table, "ar")
    // Cells also carry dir, which some clients need on the cell itself (i18n.rtl-explicit).
    expect(email.body).toMatch(/<caption dir="rtl" style="[^"]*text-align:right;/)
    expect(email.body).toMatch(/<th dir="rtl" scope="col" width="60" style="[^"]*text-align:left;/)
    expect(email.body).toMatch(/<th dir="rtl" scope="col" style="padding:8px 0 8px 8px;/)
    expect(email.body).not.toContain("padding:8px 8px 8px 0")
  })

  it("lists each row as Header: value lines in the text part", () => {
    const email = compile(table)
    expect(email.text).toContain(
      "Your items\n\n{{#lines}}\nItem: {{name}}\nQty: {{qty}}\nTotal: {{total}}\n\n{{/lines}}",
    )
  })

  it("draws header and row rules in colours the dark CSS restyles", () => {
    const email = compile(table)
    expect(email.body).toContain("ek-border-bottom-color--strongBorder")
    expect(email.html).toMatch(
      /\[data-ogsc\] \.ek-border-bottom-color--hairline \{ border-bottom-color: #[0-9a-f]{6} !important; \}/,
    )
  })

  it("needs at least two columns", () => {
    expect(() =>
      compile(({ data }) => (
        <DataTable
          caption="x"
          rows={data.lines}
          columns={[{ header: "Item", cell: (row) => row.name }]}
        />
      )),
    ).toThrow(expect.objectContaining({ code: "invalid-table" }))
  })
})

describe("LineItems", () => {
  const receipt: EmailDefinitionInput<Schema>["component"] = ({ data }) => (
    <LineItems
      caption="Order A-1042"
      items={data.lines}
      headers={{ item: "Item", qty: "Qty", lineTotal: "Total" }}
      cells={{
        name: (l) => l.name,
        meta: (l) => <If when={l.size}>{(size) => size}</If>,
        qty: (l) => l.qty,
        lineTotal: (l) => l.total,
      }}
      subtotal={{ label: "Subtotal", amount: data.subtotal }}
      discounts={[
        optionalRow(data.discount, (discount) => ({ label: "Discount", amount: discount })),
      ]}
      taxes={[{ label: "VAT 20% (included)", amount: data.vat }]}
      total={{ label: "Total", amount: data.total }}
    />
  )

  it("puts the totals in tfoot, in order, with the total emphasised", () => {
    const email = compile(receipt)
    const tfoot = email.body.slice(email.body.indexOf("<tfoot>"), email.body.indexOf("</tfoot>"))
    const labels = [...tfoot.matchAll(/<th scope="row" colspan="2" [^>]*>([^<]*)<\/th>/g)].map(
      (m) => m[1],
    )
    expect(labels).toEqual(["Subtotal", "Discount", "VAT 20% (included)", "Total"])
    expect(tfoot).toMatch(
      /\{\{#discount\}\}<tr>.*Discount.*\{\{discount\}\}<\/td>\n?<\/tr>\n?\{\{\/discount\}\}/s,
    )
    expect(tfoot).toMatch(
      /border-top-color:#[0-9a-f]{6};color:#[0-9a-f]{6}" class="ek-border-top-color--strongBorder ek-c--ink">Total</,
    )
  })

  it("adds the meta line under the item name", () => {
    expect(compile(receipt).body).toMatch(
      /\{\{name\}\}<br><span style="[^"]*font-size:14px;[^"]*" class="ek-c--mutedInk">\{\{#size\}\}\{\{size\}\}\{\{\/size\}\}<\/span>/,
    )
  })

  it("writes the totals as Label: amount lines in the text part", () => {
    expect(compile(receipt).text).toContain(
      "Subtotal: {{subtotal}}\n{{#discount}}\nDiscount: {{discount}}\n{{/discount}}\nVAT 20% (included): {{vat}}\nTotal: {{total}}\n",
    )
  })
})
