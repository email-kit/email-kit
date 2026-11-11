// Evaluation tests that call the JSX runtime directly. TSX templates, the transform and type
// tests live in @email-kit/cli, which consumes the built package.

import { describe, expect, it } from "vitest"

import {
  type Data,
  defineEmail,
  Each,
  type EmailProps,
  If,
  type StandardSchemaV1,
  Unless,
} from "../src/index.ts"
import { evaluate } from "../src/internal.ts"
import { jsx } from "../src/jsx-runtime.ts"

interface Order {
  orderNumber: string
  items: { name: string; qty: number }[]
  tags: string[]
  discount?: string
}

function schema<T>(): StandardSchemaV1<unknown, T> {
  return {
    "~standard": { version: 1, vendor: "test", validate: (value) => ({ value: value as T }) },
  }
}

function email(component: (props: EmailProps<Order>) => unknown, messages = {}) {
  const definition = defineEmail({
    id: "order-confirmation",
    purpose: "transactional",
    schema: schema<Order>(),
    subject: (data) => data.orderNumber,
    fixtures: {},
    component: component as never,
  })
  return () => evaluate(definition, { locale: "en", messages })
}

describe("evaluate", () => {
  it("turns data access into placeholders and control flow into sections", () => {
    const { body, subject } = email(({ data }) => [
      jsx("p", { children: data.orderNumber }),
      jsx(Each, {
        of: data.items,
        children: (item: Data<Order["items"][number]>) => jsx("li", { children: item.name }),
      }),
      jsx(Each, { of: data.tags, children: (tag: Data<string>) => tag }),
      jsx(If, { when: data.discount, children: "-" }),
      jsx(Unless, { when: data.discount, children: "none" }),
    ])()

    expect(subject).toEqual({ kind: "placeholder", path: ["orderNumber"], scope: 0 })
    expect(body).toEqual({
      kind: "fragment",
      children: [
        {
          kind: "element",
          tag: "p",
          attrs: {},
          children: [{ kind: "placeholder", path: ["orderNumber"], scope: 0 }],
        },
        {
          kind: "section",
          inverted: false,
          path: ["items"],
          scope: 0,
          opens: 1,
          children: [
            {
              kind: "element",
              tag: "li",
              attrs: {},
              children: [{ kind: "placeholder", path: ["name"], scope: 1 }],
            },
          ],
        },
        {
          kind: "section",
          inverted: false,
          path: ["tags"],
          scope: 0,
          opens: 2,
          children: [{ kind: "placeholder", path: [], scope: 2 }],
        },
        {
          kind: "section",
          inverted: false,
          path: ["discount"],
          scope: 0,
          opens: 3,
          children: [{ kind: "text", value: "-" }],
        },
        {
          kind: "section",
          inverted: true,
          path: ["discount"],
          scope: 0,
          opens: 4,
          children: [{ kind: "text", value: "none" }],
        },
      ],
    })
  })

  it("puts placeholders and messages into attributes", () => {
    const { body } = email(
      ({ data, t }) =>
        jsx("img", { alt: t("alt", { order: data.orderNumber }), width: 600, hidden: true }),
      { alt: "Order {order}" },
    )()
    expect(body).toMatchObject({
      attrs: {
        alt: ["Order ", { kind: "placeholder", path: ["orderNumber"] }],
        width: ["600"],
        hidden: [],
      },
    })
  })

  it("decides static conditions at compile time", () => {
    const { body } = email(() => [false && "never", null, "always"])()
    expect(body).toEqual({ kind: "text", value: "always" })
  })
})

describe("placeholder misuse", () => {
  it.each([
    ["arithmetic", ({ data }: EmailProps<Order>) => (data.items as unknown as number) * 2],
    [
      "a template literal",
      ({ data }: EmailProps<Order>) => `#${data.orderNumber as unknown as string}`,
    ],
    [
      "a string method",
      ({ data }: EmailProps<Order>) => (data.orderNumber as unknown as string).toUpperCase(),
    ],
    ["spreading a list", ({ data }: EmailProps<Order>) => [...(data.tags as unknown as string[])]],
  ])("rejects %s", (_, component) => {
    expect(email(component)).toThrow(expect.objectContaining({ code: "placeholder-misuse" }))
  })

  it("points .map() at <Each>", () => {
    const run = email(({ data }) => (data.items as unknown as unknown[]).map(() => "x"))
    expect(run).toThrow(/\{\{items\.map\}\} was called like a function.*<Each of/)
  })

  it("rejects data in styles", () => {
    const run = email(({ data }) => jsx("p", { style: { color: data.orderNumber } }))
    expect(run).toThrow(expect.objectContaining({ code: "data-dependent-style" }))
  })

  it("does not make placeholders thenable", async () => {
    let data: unknown
    email((props) => {
      data = props.data
      return null
    })()
    expect((data as { then?: unknown }).then).toBeUndefined()
  })
})

describe("messages", () => {
  const run = (messages: Record<string, string>, params?: Record<string, string>) =>
    email(({ t }) => t("key", params), messages)

  it("fills simple arguments", () => {
    expect(run({ key: "Hi {name}!" }, { name: "Ada" })().body).toEqual({
      kind: "fragment",
      children: [
        { kind: "text", value: "Hi " },
        { kind: "text", value: "Ada" },
        { kind: "text", value: "!" },
      ],
    })
  })

  it.each([
    ["missing-message", {}, undefined],
    ["missing-message-param", { key: "Hi {name}" }, {}],
    ["unused-message-param", { key: "Hi" }, { name: "Ada" }],
    ["unsupported-message", { key: "{n, number}" }, { n: "1" }],
    ["invalid-plural", { key: "{n, plural, one {# item} other {# items}}" }, { n: "1" }],
    ["invalid-message", { key: "a } b" }, {}],
  ])("rejects %s", (code, messages, params) => {
    expect(run(messages, params)).toThrow(expect.objectContaining({ code }))
  })
})

describe("sender values", () => {
  const withSender = (component: (props: EmailProps<Order>) => unknown) => {
    const definition = defineEmail({
      id: "order-confirmation",
      purpose: "transactional",
      schema: schema<Order>(),
      subject: () => "Subject",
      fixtures: {},
      component: component as never,
    })
    return () =>
      evaluate(definition, {
        locale: "en",
        messages: {},
        sender: { constants: { productName: "Acme" }, runtime: ["siteUrl"] },
      }).body
  }

  it("gives constants as text and runtime keys as reserved placeholders", () => {
    expect(withSender(({ sender }) => [sender.productName, sender.siteUrl])()).toEqual({
      kind: "fragment",
      children: [
        { kind: "text", value: "Acme" },
        { kind: "placeholder", path: ["_ek", "context", "siteUrl"], scope: 0 },
      ],
    })
  })

  it("explains a sender value the config doesn't set", () => {
    expect(withSender(({ sender }) => sender.postalAddress)).toThrow(
      expect.objectContaining({ code: "sender-value-missing" }),
    )
  })
})

describe("defineEmail", () => {
  it("rejects an invalid id", () => {
    expect(() =>
      defineEmail({
        id: "Order_Confirmation",
        purpose: "transactional",
        schema: schema<Order>(),
        subject: () => "x",
        fixtures: {},
        component: () => null,
      }),
    ).toThrow(expect.objectContaining({ code: "invalid-id" }))
  })

  it("rejects control flow outside evaluation", () => {
    expect(() => Each({ of: {} as never, children: () => null })).toThrow()
  })
})
