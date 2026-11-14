// P0-03: a TSX template compiles to HTML, text, subject and preheader with mustache-core
// placeholders, and those render correctly with sample data.

import { readFileSync } from "node:fs"
import { basename } from "node:path"
import { fileURLToPath } from "node:url"

import { render } from "@email-kit/dialect"
import { beforeAll, describe, expect, it } from "vitest"

import { type CompiledEmail, compileEmail } from "../src/compiler/compile.ts"
import { type LoadedTemplate, loadTemplate } from "../src/compiler/load/index.ts"
import { readSchema } from "../src/compiler/schema/index.ts"

const fixture = (path: string) => fileURLToPath(new URL(`fixtures/${path}`, import.meta.url))
const emailKit = (path: string) => fixture(`project/src/email-kit/${path}`)
export const cacheDir = fileURLToPath(new URL("../node_modules/.cache/email-kit/", import.meta.url))
const messages = (locale: string) =>
  JSON.parse(
    readFileSync(emailKit(`messages/${locale}/order-confirmation.json`), "utf8"),
  ) as Record<string, string>

const golden = (name: string) => `__golden__/order-confirmation/${name}`

let loaded: LoadedTemplate
const compiled: Record<string, CompiledEmail> = {}

beforeAll(async () => {
  loaded = await loadTemplate(emailKit("templates/order-confirmation.tsx"), { cacheDir })
  for (const locale of ["en", "de"]) {
    compiled[locale] = compileEmail(loaded.definition, {
      locale,
      messages: messages(locale),
      sender: { constants: { productName: "Shop Example" }, runtime: ["siteUrl"] },
    })
  }
})

// Rendering the raw templates directly, so add the runtime context the way render() does.
function renderAll(email: CompiledEmail, fields: object) {
  const data = { ...fields, _ek: { context: { siteUrl: "https://shop.example" } } }
  return {
    subject: render(email.subject, data, "text"),
    preheader: render(email.preheader, data, "text"),
    html: render(email.html, data, "html"),
    text: render(email.text, data, "text"),
  }
}

describe("loadTemplate", () => {
  it("bundles the template and its components", () => {
    expect(loaded.definition.id).toBe("order-confirmation")
    expect(loaded.files.map((file) => basename(file)).sort()).toEqual([
      "Card.tsx",
      "order-confirmation.tsx",
    ])
  })

  it("reads the template's schema as portable JSON Schema", async () => {
    const schema = await readSchema(loaded.definition.schema, {
      resolveFrom: emailKit("templates/order-confirmation.tsx"),
    })
    expect(schema.issues).toEqual([])
    await expect(`${JSON.stringify(schema.jsonSchema, null, 2)}\n`).toMatchFileSnapshot(
      golden("schema.json"),
    )
  })

  it("rejects a file without a default defineEmail export", async () => {
    await expect(loadTemplate(fixture("not-a-template.tsx"), { cacheDir })).rejects.toThrow(
      expect.objectContaining({ code: "no-definition" }),
    )
  })
})

describe.each(["en", "de"])("compiled %s", (locale) => {
  it("matches the golden files", async () => {
    const email = compiled[locale] as CompiledEmail
    await expect(email.html).toMatchFileSnapshot(golden(`${locale}.html`))
    await expect(email.text).toMatchFileSnapshot(golden(`${locale}.txt`))
    await expect(`${email.subject}\n${email.preheader}\n`).toMatchFileSnapshot(
      golden(`${locale}.subject.txt`),
    )
  })

  it("renders with the default fixture", async () => {
    const out = renderAll(
      compiled[locale] as CompiledEmail,
      loaded.definition.fixtures.default as object,
    )
    await expect(out.html).toMatchFileSnapshot(golden(`${locale}.rendered.html`))
    await expect(out.text).toMatchFileSnapshot(golden(`${locale}.rendered.txt`))
  })
})

describe("rendering", () => {
  const base = {
    customerName: "Ada",
    orderNumber: "A-1042",
    orderUrl: "https://shop.example/orders/A-1042?ref=email&lang=en",
    items: [{ name: "Tea", qty: 2 }],
  }

  it("fills the subject, preheader, scalars, lists and attributes", () => {
    const out = renderAll(compiled.en as CompiledEmail, { ...base, discount: "10%" })
    expect(out.subject).toBe("Order A-1042 confirmed")
    expect(out.preheader).toBe("Thanks for your order")
    expect(out.html).toContain("<title>Order A-1042 confirmed</title>")
    expect(out.html).toContain(
      '<a href="https://shop.example/orders/A-1042?ref=email&amp;lang=en" target="_blank" rel="noopener" title="Order A-1042"',
    )
    expect(out.html).toContain('class="ek-c--ink">Tea × 2</li>')
    expect(out.html).toContain("You saved 10%.")
    expect(out.html).not.toContain("No discount")
    expect(out.text).toContain(
      "View your order: https://shop.example/orders/A-1042?ref=email&lang=en",
    )
    expect(out.text.split("\n")[0]).toBe("Thanks for your order")
  })

  it("takes the other branch when the optional field is missing", () => {
    const out = renderAll(compiled.en as CompiledEmail, { ...base, items: [] })
    expect(out.html).toContain("No discount this time.")
    expect(out.html).not.toContain("You saved")
    expect(out.html).toContain('<ul style="margin:0 24px 16px;padding:0"></ul>')
    expect(out.text).toContain("No discount this time.")
  })

  it("escapes hostile values in HTML and keeps them verbatim in text", () => {
    const hostile = {
      ...base,
      customerName: '<script>alert("x")</script>',
      orderNumber: "\"><img src=x onerror=alert('x')>",
    }
    const out = renderAll(compiled.en as CompiledEmail, hostile)
    expect(out.html).toContain("Thanks, &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;!")
    expect(out.html).toContain(
      'title="Order &quot;&gt;&lt;img src=x onerror=alert(&#39;x&#39;)&gt;"',
    )
    expect(out.html).not.toContain("<script>")
    expect(out.text).toContain('Thanks, <script>alert("x")</script>!')
  })

  it("fails loudly when a required value is missing", () => {
    expect(() =>
      render((compiled.en as CompiledEmail).html, { ...base, orderNumber: null }, "html"),
    ).toThrow(expect.objectContaining({ code: "missing-value" }))
  })
})

describe("text part wrapping", () => {
  it("wraps long copy at 78 columns, and leaves lines with sections or URLs whole", async () => {
    const { renderTextPart } = await import("../src/compiler/text.ts")
    const long = { kind: "text" as const, value: `${"word ".repeat(30).trim()}` }
    const wrapped = renderTextPart({ kind: "element", tag: "p", attrs: {}, children: [long] }, "")
    expect(wrapped.split("\n").every((line) => line.length <= 78)).toBe(true)
    const section = {
      kind: "section" as const,
      inverted: false,
      path: ["_ek", "plural", "n", "one"],
      scope: 0,
      opens: 1,
      children: [long],
    }
    const plural = renderTextPart(
      {
        kind: "element",
        tag: "p",
        attrs: {},
        children: [{ kind: "text", value: "Lasts " }, section],
      },
      "",
    )
    expect(plural.split("\n")).toHaveLength(2)
  })
})
