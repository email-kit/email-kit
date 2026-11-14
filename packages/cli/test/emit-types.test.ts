import { describe, expect, it } from "vitest"

import { dataInterface } from "../src/compiler/emit/types.ts"
import type { Field } from "../src/compiler/schema/index.ts"

const str: Field = { type: "string", nullable: false }
const list = (items: Field): Field => ({ type: "array", nullable: false, items })
const root = (fields: Record<string, Field>): Field => ({
  type: "object",
  nullable: false,
  properties: Object.entries(fields).map(([name, field]) => ({ name, required: true, field })),
})

describe("generated data types", () => {
  it("wraps an array's item type in parentheses when it's a union", () => {
    const row: Field = { ...root({ a: str }), nullable: true }
    const type = dataInterface(
      "Data",
      root({
        rows: list(row),
        tags: list({ ...str, nullable: true }),
        plans: list({ ...str, enum: ["free", "pro"] }),
        names: list(str),
        only: list({ ...str, enum: ["one"] }),
      }),
      "Test.",
    )
    expect(type).toContain("rows: readonly ({\n    a: string\n  } | null)[]")
    expect(type).toContain("tags: readonly (string | null)[]")
    expect(type).toContain('plans: readonly ("free" | "pro")[]')
    expect(type).toContain("names: readonly string[]")
    expect(type).toContain('only: readonly "one"[]')
  })
})
