/** @jsxImportSource @email-kit/core */
// The components compiled end to end with the built-in theme: both parts, and the dark CSS.

import { Callout, KeyValue, List, ListItem, OtpCode, Text } from "@email-kit/components"
import {
  defineEmail,
  Each,
  type EmailDefinitionInput,
  type StandardSchemaV1,
} from "@email-kit/core"
import { describe, expect, it } from "vitest"

import { compileEmail } from "../src/compiler/compile.ts"

interface Data {
  code: string
  orderNumber: string
  steps: { title: string }[]
}

const schema = {
  "~standard": { version: 1, vendor: "test", validate: (value: unknown) => ({ value }) },
} as Schema

type Schema = StandardSchemaV1<Data, Data>

function compile(component: EmailDefinitionInput<Schema>["component"]) {
  const definition = defineEmail<Schema>({
    id: "test",
    purpose: "transactional",
    schema,
    subject: () => "Subject",
    fixtures: {},
    component,
  })
  const email = compileEmail(definition, { locale: "en", messages: {} })
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

describe("Text in the default theme", () => {
  it("is ink on the canvas the wrapper paints", () => {
    const email = compile(() => <Text>Hello</Text>)
    expect(email.body).toContain(
      'style="background-color:#ffffff;color:#0a0a0a" class="ek-bg--canvas ek-c--ink"',
    )
  })
})
