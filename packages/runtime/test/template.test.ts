import { describe, expect, it } from "vitest"

import { readContext } from "../src/context.ts"
import {
  createTemplate,
  EmailRenderError,
  FORMAT,
  fill,
  type Model,
  type TemplateOptions,
} from "../src/index.ts"
import { resolveLocale } from "../src/locale.ts"
import { prepare } from "../src/plural.ts"
import { project } from "../src/project.ts"
import { validate } from "../src/validate.ts"

describe("fill", () => {
  it("writes text, escaped and raw variables, sections and inverted sections", () => {
    const template = [
      "Hi ",
      [0, "name"],
      " ",
      [1, "name"],
      [2, "items", [[0, "."], ","]],
      [3, "items", ["none"]],
    ] as const
    expect(fill(template, { name: "<A&B>", items: ["x", "y"] }, true)).toBe(
      "Hi &lt;A&amp;B&gt; <A&B>x,y,",
    )
    expect(fill(template, { name: "<A&B>", items: [] }, false)).toBe("Hi <A&B> <A&B>none")
  })

  it("reports a missing value as an EmailRenderError", () => {
    expect(() => fill([[0, "name"]], {}, true)).toThrow(EmailRenderError)
    expect(() => fill([[0, "name"]], {}, true)).toThrow(
      expect.objectContaining({ code: "missing-value", message: 'No value for "name"' }),
    )
  })
})

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
  const spec = {
    id: "order",
    purpose: "transactional",
    model,
    locales: ["en", "de"],
    parts: {
      en: {
        subject: ["Order for ", [0, "name"]],
        preheader: ["Thanks"],
        // An optional field renders inside its own section, as the compiler emits it.
        html: [
          "<p>",
          [0, "name"],
          "</p>",
          [2, "items", ["<i>", [0, "label"], " ", [2, "currency", [[0, "currency"]]], "</i>"]],
          [3, "discount", ["<b>none</b>"]],
        ],
        text: [[0, "name"], " & co"],
      },
      de: {
        subject: ["Bestellung für ", [0, "name"]],
        preheader: ["Danke"],
        html: ["<p>", [0, "name"], "</p>"],
        text: [[0, "name"]],
      },
    },
  } as const
  /** The template with validation and locale resolution on; `undefined` turns one off. */
  const template = (
    options: { [K in keyof TemplateOptions]?: TemplateOptions[K] | undefined } = {},
  ) =>
    createTemplate(spec, {
      format: FORMAT,
      validate,
      resolve: (requested, available) => resolveLocale(requested, available),
      ...options,
    } as TemplateOptions)

  it("renders every part with the right profile and falls back by locale", () => {
    const email = template().render(
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
      template().render({ name: "A", currency: "EUR", items: [] }, { locale: "de-AT" }).subject,
    ).toBe("Bestellung für A")
  })

  it("renders in the default locale without a resolver: the module has one locale", () => {
    const email = template({ resolve: undefined }).render(
      { name: "A", currency: "EUR", items: [] },
      { locale: "de" },
    )
    expect(email.meta.locale).toBe("en")
  })

  it("lets an item's own optional key win over an outer value of the same name", () => {
    const html = template().render({
      name: "A",
      currency: "EUR",
      items: [{ label: "x", currency: "USD" }, { label: "y" }],
    }).html
    expect(html).toContain("<i>x USD</i><i>y </i>")
  })

  it("rejects invalid data before rendering, with every issue", () => {
    const run = () => template().render({ name: 1, items: [{}] })
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
    expect(template().validate?.({ items: [] })).toEqual([
      { path: "name", message: "is required" },
      { path: "currency", message: "is required" },
    ])
  })

  it("without a validator, renders without checking and has no validate()", () => {
    const renderOnly = template({ validate: undefined })
    // The renderer is then the only guard: it reports the first missing value.
    expect(() => renderOnly.render({ items: [] })).toThrow(
      expect.objectContaining({ code: "missing-value" }),
    )
    expect(renderOnly.validate).toBeUndefined()
  })

  it("rejects a line break in the subject", () => {
    expect(() => template().render({ name: "A\r\nBcc: x", currency: "", items: [] })).toThrow(
      expect.objectContaining({ code: "subject-line-break" }),
    )
  })

  it("refuses a module compiled for another format", () => {
    expect(() => template({ format: FORMAT + 1 })).toThrow(
      expect.objectContaining({ code: "incompatible-module" }),
    )
  })

  it("adds the plural flags with the locale's rule when given them", () => {
    const counted = createTemplate(
      {
        id: "cart",
        purpose: "transactional",
        model: { type: "object", properties: { n: { type: "integer" } }, required: ["n"] },
        locales: ["en"],
        parts: {
          en: {
            subject: [
              [2, "_ek.plural.n.one", ["one item"]],
              [2, "_ek.plural.n.other", [[0, "n"], " items"]],
            ],
            preheader: [],
            html: [],
            text: [],
          },
        },
      },
      { format: FORMAT, plural: { prepare, rules: { en: (n) => (n === 1 ? "one" : "other") } } },
    )
    expect(counted.render({ n: 1 }).subject).toBe("one item")
    expect(counted.render({ n: 3 }).subject).toBe("3 items")
  })
})

describe("runtime context (RUN-04)", () => {
  const template = createTemplate(
    {
      id: "welcome",
      purpose: "transactional",
      model: {
        type: "object",
        properties: {
          name: { type: "string" },
          links: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" } },
              required: ["label"],
            },
          },
        },
        required: ["name", "links"],
      },
      locales: ["en"],
      parts: {
        en: {
          subject: ["Welcome"],
          preheader: [],
          html: [
            '<a href="',
            [0, "_ek.context.siteUrl"],
            '">',
            [0, "name"],
            "</a>",
            [2, "links", ["<i>", [0, "label"], " ", [0, "_ek.context.siteUrl"], "</i>"]],
          ],
          text: [[0, "_ek.context.siteUrl"]],
        },
      },
    },
    {
      format: FORMAT,
      validate,
      context: readContext(["siteUrl"], { siteUrl: "https://shop.example", ignored: "x" }),
    },
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
