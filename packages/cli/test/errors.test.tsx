/** @jsxImportSource @email-kit/core */
// Compile errors for data use the dialect can't express.

import type { Child, Data } from "@email-kit/core"
import { defineEmail, Each, If } from "@email-kit/core"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { compileEmail } from "../src/compiler/compile.ts"

const schema = z.object({
  name: z.string(),
  names: z.array(z.string()),
  tags: z.array(z.string()),
  note: z.string().optional(),
})

function compile(
  component: (data: Data<z.output<typeof schema>>) => Child,
  subject: () => Child = () => "Subject",
) {
  const definition = defineEmail({
    id: "errors",
    purpose: "transactional",
    schema,
    subject,
    fixtures: {},
    component: ({ data }) => component(data),
  })
  return () => compileEmail(definition, { locale: "en", messages: {} })
}

describe("compile errors", () => {
  it("rejects an outer list item inside a nested <Each>", () => {
    const run = compile((data) => (
      <Each of={data.names}>{(name) => <Each of={data.tags}>{() => <p>{name}</p>}</Each>}</Each>
    ))
    expect(run).toThrow(expect.objectContaining({ code: "shadowed-item" }))
  })

  it("rejects a list item inside an <If> that pushes a value", () => {
    const run = compile((data) => (
      <Each of={data.names}>{(name) => <If when={data.note}>{name}</If>}</Each>
    ))
    expect(run).toThrow(expect.objectContaining({ code: "shadowed-item" }))
  })

  it("allows the item of the innermost <Each>", () => {
    const run = compile((data) => (
      <Each of={data.names}>{() => <Each of={data.tags}>{(tag) => <p>{tag}</p>}</Each>}</Each>
    ))
    expect(run().html).toContain("{{#names}}{{#tags}}<p>{{.}}</p>\n{{/tags}}{{/names}}")
  })

  it('rejects "{{" in text, which the text part can\'t express', () => {
    const run = compile(() => <p>{"Type {{code}} here"}</p>)
    expect(run).toThrow(expect.objectContaining({ code: "literal-braces" }))
  })

  it('rejects a "{" directly before a placeholder', () => {
    const run = compile((data) => (
      <p>
        {"{"}
        {data.name}
      </p>
    ))
    expect(run).toThrow(expect.objectContaining({ code: "literal-braces" }))
  })

  it("writes literal braces as entities in HTML", () => {
    const run = compile(() => <p>{"a { b"}</p>)
    expect(run().html).toContain("<p>a &#123; b</p>")
  })

  it("rejects a multi-line subject", () => {
    const run = compile(
      () => null,
      () => "two\nlines",
    )
    expect(run).toThrow(expect.objectContaining({ code: "multi-line" }))
  })
})
