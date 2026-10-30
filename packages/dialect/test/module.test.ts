import { describe, expect, it } from "vitest"

import { createTemplate, project, readContext, resolveLocale, type Shape } from "../src/module.ts"

describe("resolveLocale", () => {
  const locales = ["en", "de", "pt-BR", "pt"]

  it.each([
    [undefined, "en"],
    ["de", "de"],
    ["DE", "de"],
    ["de-AT", "de"],
    ["pt-BR", "pt-BR"],
    ["pt-PT", "pt"],
    ["zh-Hant-TW", "en"],
    ["", "en"],
  ])("%s → %s", (requested, expected) => {
    expect(resolveLocale(requested, locales)).toBe(expected)
  })
})

describe("project", () => {
  const shape: Shape = {
    fields: {
      name: "scalar",
      discount: "scalar",
      items: { list: { fields: { label: "scalar", note: "scalar" }, optional: ["note"] } },
    },
    optional: ["discount"],
  }

  it("drops unknown keys and fills missing optional keys with null", () => {
    expect(
      project(shape, {
        name: "Ada",
        extra: "dropped",
        items: [
          { label: "a", currency: "dropped" },
          { label: "b", note: "n" },
        ],
      }),
    ).toEqual({
      name: "Ada",
      discount: null,
      items: [
        { label: "a", note: null },
        { label: "b", note: "n" },
      ],
    })
  })

  it("treats undefined like a missing key", () => {
    expect(project(shape, { name: "Ada", discount: undefined, items: [] })).toEqual({
      name: "Ada",
      discount: null,
      items: [],
    })
  })

  it("leaves a missing required key missing, so the renderer reports it", () => {
    expect(project(shape, { items: [] })).toEqual({ discount: null, items: [] })
  })

  it("passes values of the wrong kind through for the renderer or validator to reject", () => {
    expect(project(shape, null)).toBeNull()
    expect(project(shape, { name: "Ada", items: "nope" })).toEqual({
      name: "Ada",
      discount: null,
      items: "nope",
    })
  })
})

describe("createTemplate", () => {
  const template = createTemplate(
    "order",
    "transactional",
    {
      fields: {
        name: "scalar",
        discount: "scalar",
        currency: "scalar",
        items: {
          list: { fields: { label: "scalar", currency: "scalar" }, optional: ["currency"] },
        },
      },
      optional: ["discount"],
    },
    ["en", "de"],
    {
      en: {
        subject: "Order for {{name}}",
        preheader: "Thanks",
        // An optional field renders inside its own section, as the compiler emits it.
        html: "<p>{{name}}</p>{{#items}}<i>{{label}} {{#currency}}{{currency}}{{/currency}}</i>{{/items}}{{^discount}}<b>none</b>{{/discount}}",
        text: "{{name}} & co",
      },
      de: {
        subject: "Bestellung für {{name}}",
        preheader: "Danke",
        html: "<p>{{name}}</p>",
        text: "{{name}}",
      },
    },
    {},
  )

  it("renders every part with the right profile and falls back by locale", () => {
    const email = template.render(
      { name: "A & B", currency: "EUR", items: [{ label: "x" }] },
      { locale: "en-GB" },
    )
    expect(email).toEqual({
      subject: "Order for A & B",
      preheader: "Thanks",
      // Without projection, the item's missing currency would fall through to the outer EUR.
      html: "<p>A &amp; B</p><i>x </i><b>none</b>",
      text: "A & B & co",
      meta: { id: "order", locale: "en", purpose: "transactional" },
    })
    expect(
      template.render({ name: "A", currency: "EUR", items: [] }, { locale: "de-AT" }).subject,
    ).toBe("Bestellung für A")
  })

  it("lets an item's own optional key win over an outer value of the same name", () => {
    const html = template.render({
      name: "A",
      currency: "EUR",
      items: [{ label: "x", currency: "USD" }, { label: "y" }],
    }).html
    // Without projection, "y" would show the outer EUR.
    expect(html).toContain("<i>x USD</i><i>y </i>")
  })

  it("rejects a line break in the subject", () => {
    expect(() => template.render({ name: "A\r\nBcc: x", currency: "", items: [] })).toThrow(
      expect.objectContaining({ code: "subject-line-break" }),
    )
  })
})

describe("runtime context (RUN-04)", () => {
  const template = createTemplate(
    "welcome",
    "transactional",
    {
      fields: { name: "scalar", links: { list: { fields: { label: "scalar" }, optional: [] } } },
      optional: [],
    },
    ["en"],
    {
      en: {
        subject: "Welcome",
        preheader: "",
        html: '<a href="{{_ek.context.siteUrl}}">{{name}}</a>{{#links}}<i>{{label}} {{_ek.context.siteUrl}}</i>{{/links}}',
        text: "{{_ek.context.siteUrl}}",
      },
    },
    readContext(["siteUrl"], { siteUrl: "https://shop.example", ignored: "x" }),
  )

  it("fills context placeholders", () => {
    const email = template.render({ name: "Ada", links: [] })
    expect(email.html).toBe('<a href="https://shop.example">Ada</a>')
    expect(email.text).toBe("https://shop.example")
  })

  it("can't be overridden or shadowed by data", () => {
    const email = template.render({
      name: "Ada",
      _ek: { context: { siteUrl: "https://evil.example" } },
      siteUrl: "https://evil.example",
      links: [{ label: "a", _ek: { context: { siteUrl: "https://evil.example" } } }],
    })
    expect(email.html).not.toContain("evil")
    expect(email.html).toContain("<i>a https://shop.example</i>")
  })

  it("requires every runtime key as a non-empty string", () => {
    for (const context of [{}, { siteUrl: "" }, { siteUrl: 1 }, null]) {
      expect(() => readContext(["siteUrl"], context)).toThrow(
        expect.objectContaining({ code: "missing-context" }),
      )
    }
    expect(readContext(["siteUrl"], { siteUrl: "x", other: "y" })).toEqual({ siteUrl: "x" })
  })
})
