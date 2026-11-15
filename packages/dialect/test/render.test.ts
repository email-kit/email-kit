// Behaviour the JSON conformance suite can't express: non-JSON values, the parsed-template API
// and the error object.

import { describe, expect, it } from "vitest"

import {
  compile,
  escapeHtml,
  HTML_ESCAPES,
  MustacheCoreError,
  type Profile,
  parse,
  render,
} from "../src/index.ts"

describe("parse", () => {
  it("builds a tree of text, variables and sections", () => {
    expect(parse("Hi {{name}}{{#items}}{{{.}}}{{/items}}{{^items}}none{{/items}}").nodes).toEqual([
      "Hi ",
      { type: "variable", name: "name", raw: false },
      {
        type: "section",
        name: "items",
        children: [{ type: "variable", name: ".", raw: true }],
      },
      { type: "inverted", name: "items", children: ["none"] },
    ])
  })

  it("drops standalone lines from the tree", () => {
    expect(parse("{{#a}}\nx\n{{/a}}\n").nodes).toEqual([
      { type: "section", name: "a", children: ["x\n"] },
    ])
  })

  it("reports the code and offset of a syntax error", () => {
    let error: unknown
    try {
      parse("ok {{#a}} {{/b}}")
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(MustacheCoreError)
    expect(error).toMatchObject({
      name: "MustacheCoreError",
      code: "mismatched-close",
      message: '"{{/b}}" at offset 10 does not close "a" (offset 3)',
    })
  })
})

describe("compile", () => {
  it("writes the compact form the runtime renders", () => {
    expect(compile("Hi {{name}}{{#items}}{{{.}}}{{/items}}{{^items}}none{{/items}}")).toEqual([
      "Hi ",
      [0, "name"],
      [2, "items", [[1, "."]]],
      [3, "items", ["none"]],
    ])
  })
})

describe("render", () => {
  it("renders a parsed template many times", () => {
    const template = parse("{{#items}}{{.}} {{/items}}")
    expect(render(template, { items: [1, 2] }, "html")).toBe("1 2 ")
    expect(render(template, { items: ["a"] }, "html")).toBe("a ")
  })

  it("escapes for any profile other than text", () => {
    expect(render("{{v}}", { v: "<&>" }, "xml" as Profile)).toBe("&lt;&amp;&gt;")
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects the non-finite number %s",
    (n) => {
      expect(() => render("{{n}}", { n }, "text")).toThrow(
        expect.objectContaining({ code: "invalid-number" }),
      )
      expect(() => render("{{#n}}x{{/n}}", { n }, "text")).toThrow(
        expect.objectContaining({ code: "invalid-number" }),
      )
    },
  )

  it.each([
    ["bigint", 1n],
    ["function", () => "x"],
    ["symbol", Symbol("x")],
  ])("rejects a %s value", (_, value) => {
    expect(() => render("{{v}}", { v: value }, "text")).toThrow(
      expect.objectContaining({ code: "non-scalar-value" }),
    )
  })

  it("does not read inherited properties", () => {
    const data = Object.create({ inherited: "x" }) as object
    expect(() => render("{{inherited}}", data, "text")).toThrow(
      expect.objectContaining({ code: "missing-value" }),
    )
  })

  it("treats a missing (undefined) value like null", () => {
    expect(() => render("{{v}}", { v: undefined }, "text")).toThrow(
      expect.objectContaining({ code: "missing-value" }),
    )
    expect(render("[{{#v}}x{{/v}}{{^v}}y{{/v}}]", { v: undefined }, "text")).toBe("[y]")
  })

  it("does not mutate the data", () => {
    const data = Object.freeze({ items: Object.freeze([Object.freeze({ a: "1" })]) })
    expect(render("{{#items}}{{a}}{{/items}}", data, "html")).toBe("1")
  })
})

describe("escapeHtml", () => {
  it("escapes exactly the characters in HTML_ESCAPES", () => {
    expect(Object.keys(HTML_ESCAPES)).toEqual(["&", "<", ">", '"', "'"])
    expect(escapeHtml("&<>\"'/`=")).toBe("&amp;&lt;&gt;&quot;&#39;/`=")
  })
})
