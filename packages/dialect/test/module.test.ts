import { describe, expect, it } from "vitest"

import {
  createTemplate,
  type Model,
  project,
  readContext,
  resolveLocale,
  validate,
} from "../src/module.ts"

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

const order: Model = {
  type: "object",
  properties: {
    name: { type: "string" },
    discount: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, note: { type: "string" } },
        required: ["label"],
      },
    },
  },
  required: ["name", "items"],
}

describe("project", () => {
  it("drops unknown keys and fills missing optional keys with null", () => {
    expect(
      project(order, {
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
    expect(project(order, { name: "Ada", discount: undefined, items: [] })).toEqual({
      name: "Ada",
      discount: null,
      items: [],
    })
  })

  it("leaves a missing required key missing, so the renderer reports it", () => {
    expect(project(order, { items: [] })).toEqual({ discount: null, items: [] })
  })

  it("passes values of the wrong kind through for the validator or renderer to reject", () => {
    expect(project(order, null)).toBeNull()
    expect(project(order, { name: "Ada", items: "nope" })).toEqual({
      name: "Ada",
      discount: null,
      items: "nope",
    })
  })
})

describe("validate (OUT-08)", () => {
  const model: Model = {
    type: "object",
    properties: {
      code: { type: "string", constraints: { minLength: 6, maxLength: 6, pattern: "^[0-9]+$" } },
      plan: { type: "string", enum: ["free", "pro"] },
      qty: { type: "integer", constraints: { minimum: 1, maximum: 10 } },
      price: { type: "number", constraints: { exclusiveMinimum: 0, multipleOf: 0.01 } },
      active: { type: "boolean" },
      link: { type: "string", url: true },
      note: { type: "string", nullable: true },
      tags: { type: "array", items: { type: "string" }, constraints: { maxItems: 2 } },
      lines: {
        type: "array",
        items: { type: "object", properties: { qty: { type: "number" } }, required: ["qty"] },
      },
    },
    required: ["code", "plan", "qty", "price", "active", "link", "note", "tags", "lines"],
  }
  const valid = {
    code: "123456",
    plan: "pro",
    qty: 3,
    price: 9.99,
    active: true,
    link: "https://shop.example/a?b=c",
    note: null,
    tags: ["a"],
    lines: [{ qty: 1 }],
  }

  it("accepts valid data, including null for a nullable field and unknown keys", () => {
    expect(validate(model, { ...valid, extra: "ignored" })).toEqual([])
  })

  it("reports each problem with its path", () => {
    expect(
      validate(model, {
        code: "12a",
        plan: "gold",
        qty: 2.5,
        price: 0,
        active: "yes",
        link: "javascript:alert(1)",
        tags: ["a", "b", 3],
        lines: [{ qty: 1 }, {}, { qty: "2" }],
      }),
    ).toEqual([
      { path: "code", message: "must be at least 6 characters" },
      { path: "code", message: "must match ^[0-9]+$" },
      { path: "plan", message: 'expected one of "free", "pro", got "gold"' },
      { path: "qty", message: "expected an integer, got 2.5" },
      { path: "price", message: "must be more than 0, got 0" },
      { path: "active", message: 'expected true or false, got "yes"' },
      { path: "link", message: 'must be an https URL, got "javascript:alert(1)"' },
      { path: "note", message: "is required" },
      { path: "tags", message: "must have at most 2 items" },
      { path: "tags[2]", message: "expected a string, got number 3" },
      { path: "lines[1].qty", message: "is required" },
      { path: "lines[2].qty", message: 'expected a number, got "2"' },
    ])
  })

  it("rejects the wrong root and non-finite numbers", () => {
    expect(validate(model, null)).toEqual([{ path: "data", message: "can't be null" }])
    expect(validate(model, [])).toEqual([
      { path: "data", message: "expected an object, got a list" },
    ])
    expect(validate({ type: "number" }, Number.NaN)).toEqual([
      { path: "data", message: "expected a number, got number NaN" },
    ])
  })

  it("counts characters, not UTF-16 units", () => {
    expect(validate({ type: "string", constraints: { maxLength: 2 } }, "👩🏽")).toEqual([])
  })
})

describe("createTemplate", () => {
  const model: Model = {
    type: "object",
    properties: {
      name: { type: "string" },
      discount: { type: "string" },
      currency: { type: "string" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: { label: { type: "string" }, currency: { type: "string" } },
          required: ["label"],
        },
      },
    },
    required: ["name", "currency", "items"],
  }
  const template = (checkData: boolean) =>
    createTemplate(
      "order",
      "transactional",
      model,
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
      checkData,
      {},
    )

  it("renders every part with the right profile and falls back by locale", () => {
    const email = template(true).render(
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
      template(true).render({ name: "A", currency: "EUR", items: [] }, { locale: "de-AT" }).subject,
    ).toBe("Bestellung für A")
  })

  it("lets an item's own optional key win over an outer value of the same name", () => {
    const html = template(true).render({
      name: "A",
      currency: "EUR",
      items: [{ label: "x", currency: "USD" }, { label: "y" }],
    }).html
    expect(html).toContain("<i>x USD</i><i>y </i>")
  })

  it("rejects invalid data before rendering, with every issue", () => {
    const run = () => template(true).render({ name: 1, items: [{}] })
    expect(run).toThrow(
      expect.objectContaining({
        code: "invalid-data",
        message:
          'The data for "order" doesn\'t match its schema:\n  name: expected a string, got number 1\n  currency: is required\n  items[0].label: is required',
        issues: [
          { path: "name", message: "expected a string, got number 1" },
          { path: "currency", message: "is required" },
          { path: "items[0].label", message: "is required" },
        ],
      }),
    )
  })

  it("skips validation when turned off, and still offers validate()", () => {
    // Without validation the renderer is the only guard: it reports the first missing value.
    expect(() => template(false).render({ items: [] })).toThrow(
      expect.objectContaining({ code: "missing-value" }),
    )
    expect(template(false).validate({ items: [] })).toEqual([
      { path: "name", message: "is required" },
      { path: "currency", message: "is required" },
    ])
  })

  it("rejects a line break in the subject", () => {
    expect(() => template(true).render({ name: "A\r\nBcc: x", currency: "", items: [] })).toThrow(
      expect.objectContaining({ code: "subject-line-break" }),
    )
  })
})

describe("runtime context (RUN-04)", () => {
  const template = createTemplate(
    "welcome",
    "transactional",
    {
      type: "object",
      properties: {
        name: { type: "string" },
        links: {
          type: "array",
          items: { type: "object", properties: { label: { type: "string" } }, required: ["label"] },
        },
      },
      required: ["name", "links"],
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
    true,
    {},
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
    expect(readContext(["productName"], { productName: "x", other: "y" })).toEqual({
      productName: "x",
    })
  })

  it("holds URL values to https and supportEmail to an address, as the config does", () => {
    for (const siteUrl of ["x", "http://shop.example", "https://", "https://a b", "javascript:x"]) {
      expect(() => readContext(["siteUrl"], { siteUrl })).toThrow(
        expect.objectContaining({ code: "invalid-context" }),
      )
    }
    expect(() => readContext(["helpUrl"], { helpUrl: "ftp://help.example" })).toThrow(
      'createEmails() needs "helpUrl" as an https URL, got "ftp://help.example"',
    )
    expect(() => readContext(["supportEmail"], { supportEmail: "help" })).toThrow(
      expect.objectContaining({ code: "invalid-context" }),
    )
    expect(
      readContext(["privacyUrl", "supportEmail"], {
        privacyUrl: "https://shop.example/privacy",
        supportEmail: "help@shop.example",
      }),
    ).toEqual({ privacyUrl: "https://shop.example/privacy", supportEmail: "help@shop.example" })
  })
})
