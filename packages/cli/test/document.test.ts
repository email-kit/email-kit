// P1-061: the document skeleton matches research 01 §2. Each assertion mirrors a row of that
// table (and the html.* / css.* checks the check engine will run in M1.4).

import { fileURLToPath } from "node:url"
import type { IrNode } from "@email-kit/core/internal"
import { render } from "@email-kit/dialect"
import { beforeAll, describe, expect, it } from "vitest"

import { compileEmail } from "../src/compiler/compile.ts"
import { PREHEADER_FILLER, renderDocument } from "../src/compiler/document.ts"
import { loadTemplate } from "../src/compiler/load.ts"

const template = fileURLToPath(
  new URL("fixtures/project/src/email-kit/templates/order-confirmation.tsx", import.meta.url),
)
const cacheDir = fileURLToPath(new URL("../node_modules/.cache/email-kit/", import.meta.url))
const messages = {
  subject: 'Order "{order}" confirmed',
  preheader: "Thanks for your order",
  heading: "Thanks, {name}!",
  orderLine: "Your order {order} is confirmed.",
  discount: "You saved {discount}.",
  noDiscount: "No discount this time.",
  viewTitle: "Order {order}",
  view: "View your order",
}

let html: string
beforeAll(async () => {
  const { definition } = await loadTemplate(template, { cacheDir })
  html = compileEmail(definition, { locale: "en", messages }).html
})

const head = () => html.slice(html.indexOf("<head>"), html.indexOf("</head>"))
const body = () => html.slice(html.indexOf("<body"), html.indexOf("</body>"))
const withoutComments = (text: string) => text.replace(/<!--[\s\S]*?-->/g, "")
const text = (value: string): IrNode => ({ kind: "text", value })

describe("document skeleton (research 01 §2)", () => {
  it("starts with the HTML5 doctype", () => {
    expect(html.startsWith("<!DOCTYPE html>\n")).toBe(true)
  })

  it("puts lang and dir on <html> and repeats them on the wrapper, the first element of <body>", () => {
    expect(html).toMatch(/<html lang="en" dir="ltr"/)
    expect(body()).toMatch(
      /^<body xml:lang="en" style="margin:0;padding:0">\n<div role="article" aria-label="[^"]+" lang="en" dir="ltr">/,
    )
  })

  it("labels the wrapper and titles the document with the subject", () => {
    // Quotes need escaping in the attribute only, not in <title> text.
    expect(html).toContain('<title>Order "{{orderNumber}}" confirmed</title>')
    expect(html).toContain('aria-label="Order &quot;{{orderNumber}}&quot; confirmed"')
    const rendered = render(html, { ...data, orderNumber: 'A"1' }, "html")
    expect(rendered).toContain('aria-label="Order &quot;A&quot;1&quot; confirmed"')
  })

  it("puts meta charset first, then the meta set", () => {
    expect(head()).toMatch(/^<head>\n<meta charset="utf-8">\n/)
    expect(head()).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">')
    expect(head()).toContain('<meta name="x-apple-disable-message-reformatting">')
    expect(head()).toContain(
      '<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">',
    )
  })

  it("has the 96 DPI XML inside an MSO conditional and <noscript>, with xmlns:o", () => {
    expect(head()).toMatch(
      /<!--\[if mso\]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96<\/o:PixelsPerInch><\/o:OfficeDocumentSettings><\/xml><\/noscript><!\[endif\]-->/,
    )
    expect(html).toMatch(/<html [^>]*xmlns:o="urn:schemas-microsoft-com:office:office"/)
    expect(html).not.toContain("xmlns:v")
  })

  it("has an MSO-only font override with a known family", () => {
    expect(head()).toMatch(
      /<!--\[if mso\]><style>[^<]*font-family: Arial, Helvetica, sans-serif !important;[^<]*<\/style><!\[endif\]-->/,
    )
  })

  it("has exactly one <style>, in <head>, with the data-detector reset", () => {
    const styles = withoutComments(html).match(/<style[\s>][\s\S]*?<\/style>/g) ?? []
    expect(styles).toHaveLength(1)
    expect(withoutComments(body())).not.toContain("<style")
    expect(styles[0]).toContain("a[x-apple-data-detectors] { color: inherit !important;")
  })

  it("writes CSS the way strict clients accept it: lowercase ` !important`, no `}}`", () => {
    const css = (html.match(/<style>([\s\S]*?)<\/style>/g) ?? []).join("\n")
    expect(css.replace(/ !important/g, "")).not.toMatch(/!\s*important/i)
    expect(css).not.toMatch(/\}\s*\}/)
  })

  it("leaves <body> bare and loads nothing external", () => {
    expect(body()).toMatch(/^<body xml:lang="en" style="margin:0;padding:0">/)
    expect(html).not.toMatch(/<link\b|@import/)
  })

  it("puts the hidden, padded preheader first in the wrapper", () => {
    expect(body()).toMatch(
      /<div role="article"[^>]*>\n<div style="display:none;max-height:0;overflow:hidden;mso-hide:all" aria-hidden="true">Thanks for your order\n/,
    )
    expect(html.split(PREHEADER_FILLER).length - 1).toBe(100)
  })

  it("keeps every line under 998 octets", () => {
    const longest = Math.max(...html.split("\n").map((line) => Buffer.byteLength(line)))
    expect(longest).toBeLessThanOrEqual(998)
  })

  it("has no colour-scheme signals without a dark palette", () => {
    expect(html).not.toMatch(/color-scheme/)
  })
})

describe("renderDocument options", () => {
  const base = {
    lang: "ar",
    dir: "rtl",
    subject: text("مرحبا"),
    preheader: undefined,
    body: text("x"),
    outlookClassic: true,
  } as const

  it("declares colour-scheme in the meta and in :root together (02 D2, D6)", () => {
    for (const scheme of ["light dark", "light only"] as const) {
      const doc = renderDocument({ ...base, colorScheme: scheme })
      expect(doc).toContain(`<meta name="color-scheme" content="${scheme}">`)
      expect(doc).toContain(":root { color-scheme: light dark; }")
    }
  })

  it("adds xmlns:v only when VML is used", () => {
    const vml: IrNode = { kind: "element", tag: "v:roundrect", attrs: {}, children: [] }
    expect(renderDocument({ ...base, body: vml })).toMatch(
      /xmlns:v="urn:schemas-microsoft-com:vml"/,
    )
  })

  it("drops the Word-only parts when classic Outlook isn't a target", () => {
    const doc = renderDocument({ ...base, outlookClassic: false })
    expect(doc).not.toMatch(/\[if mso\]|xmlns:o/)
    expect(doc).toContain('<html lang="ar" dir="rtl">')
  })

  it("omits the preheader block when there is no preheader", () => {
    expect(renderDocument(base)).not.toContain("aria-hidden")
  })

  it("rejects an element in the subject", () => {
    const subject: IrNode = { kind: "element", tag: "b", attrs: {}, children: [] }
    expect(() => renderDocument({ ...base, subject })).toThrow(
      expect.objectContaining({ code: "invalid-attribute" }),
    )
  })
})

const data = {
  customerName: "Ada",
  orderNumber: "A-1042",
  orderUrl: "https://shop.example/orders/A-1042",
  items: [{ name: "Tea", qty: 2 }],
}
