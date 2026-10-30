// P0-10: Zod 4, ArkType and Valibot schemas → the portable model → canonical JSON Schema 2020-12,
// with non-portable constructs reported. The matrix is written to a golden file for the docs.

import { fileURLToPath } from "node:url"

import { type StandardSchemaV1, secret, secretUrl, url } from "@email-kit/core"
import { type } from "arktype"
import * as v from "valibot"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { type PortableSchema, readSchema } from "../src/compiler/schema.ts"

const resolveFrom = fileURLToPath(import.meta.url)
const read = (schema: unknown) => readSchema(schema as StandardSchemaV1, { resolveFrom })

type Library = "Zod" | "ArkType" | "Valibot"
const LIBRARIES: readonly Library[] = ["Zod", "ArkType", "Valibot"]

interface Row {
  readonly construct: string
  /** `portable` and `issue` are asserted; `record` only goes into the matrix. */
  readonly expect: "portable" | "issue" | "record"
  readonly schemas: Partial<Record<Library, () => unknown>>
}

// ArkType's metadata type doesn't list our key; the value is passed through unchanged.
const meta = (value: object) => value as never

const ROWS: readonly Row[] = [
  {
    construct: "string, number, integer, boolean",
    expect: "portable",
    schemas: {
      Zod: () => z.object({ s: z.string(), n: z.number(), i: z.number().int(), b: z.boolean() }),
      ArkType: () => type({ s: "string", n: "number", i: "number.integer", b: "boolean" }),
      Valibot: () =>
        v.object({
          s: v.string(),
          n: v.number(),
          i: v.pipe(v.number(), v.integer()),
          b: v.boolean(),
        }),
    },
  },
  {
    construct: "string enum",
    expect: "portable",
    schemas: {
      Zod: () => z.object({ plan: z.enum(["free", "pro"]) }),
      ArkType: () => type({ plan: "'free' | 'pro'" }),
      Valibot: () => v.object({ plan: v.picklist(["free", "pro"]) }),
    },
  },
  {
    construct: "optional, nullable, both",
    expect: "portable",
    schemas: {
      Zod: () =>
        z.object({ o: z.string().optional(), n: z.number().nullable(), b: z.string().nullish() }),
      ArkType: () => type({ "o?": "string", n: "number | null", "b?": "string | null" }),
      Valibot: () =>
        v.object({
          o: v.optional(v.string()),
          n: v.nullable(v.number()),
          b: v.nullish(v.string()),
        }),
    },
  },
  {
    construct: "nullable enum",
    expect: "portable",
    schemas: {
      Zod: () => z.object({ plan: z.enum(["free", "pro"]).nullable() }),
      ArkType: () => type({ plan: "'free' | 'pro' | null" }),
      Valibot: () => v.object({ plan: v.nullable(v.picklist(["free", "pro"])) }),
    },
  },
  {
    construct: "list of objects, nested object",
    expect: "portable",
    schemas: {
      Zod: () =>
        z.object({
          items: z.array(z.object({ name: z.string(), qty: z.number() })),
          customer: z.object({ name: z.string() }),
        }),
      ArkType: () =>
        type({
          items: type({ name: "string", qty: "number" }).array(),
          customer: { name: "string" },
        }),
      Valibot: () =>
        v.object({
          items: v.array(v.object({ name: v.string(), qty: v.number() })),
          customer: v.object({ name: v.string() }),
        }),
    },
  },
  {
    construct: "length and range constraints",
    expect: "portable",
    schemas: {
      Zod: () => z.object({ s: z.string().min(1).max(10), n: z.number().min(0) }),
      ArkType: () => type({ s: "0 < string <= 10", n: "number >= 0" }),
      Valibot: () =>
        v.object({
          s: v.pipe(v.string(), v.minLength(1), v.maxLength(10)),
          n: v.pipe(v.number(), v.minValue(0)),
        }),
    },
  },
  {
    construct: "format hint, secret and url markers",
    expect: "portable",
    schemas: {
      Zod: () =>
        z.object({
          placedAt: z.string().meta({ format: "date-time" }),
          code: z.string().meta(secret),
          orderUrl: z.string().meta(url),
          magicLink: z.string().meta(secretUrl),
        }),
      ArkType: () =>
        type({
          placedAt: type.string.configure(meta({ format: "date-time" })),
          code: type.string.configure(meta(secret)),
          orderUrl: type.string.configure(meta(url)),
          magicLink: type.string.configure(meta(secretUrl)),
        }),
      Valibot: () =>
        v.object({
          placedAt: v.pipe(v.string(), v.metadata({ format: "date-time" })),
          code: v.pipe(v.string(), v.metadata(secret)),
          orderUrl: v.pipe(v.string(), v.metadata(url)),
          magicLink: v.pipe(v.string(), v.metadata(secretUrl)),
        }),
    },
  },
  {
    construct: "union of types",
    expect: "issue",
    schemas: {
      Zod: () => z.object({ id: z.union([z.string(), z.number()]) }),
      ArkType: () => type({ id: "string | number" }),
      Valibot: () => v.object({ id: v.union([v.string(), v.number()]) }),
    },
  },
  {
    construct: "record (dynamic keys)",
    expect: "issue",
    schemas: {
      Zod: () => z.object({ labels: z.record(z.string(), z.string()) }),
      ArkType: () => type({ labels: "Record<string, string>" }),
      Valibot: () => v.object({ labels: v.record(v.string(), v.string()) }),
    },
  },
  {
    construct: "tuple",
    expect: "issue",
    schemas: {
      Zod: () => z.object({ pair: z.tuple([z.string(), z.number()]) }),
      ArkType: () => type({ pair: ["string", "number"] }),
      Valibot: () => v.object({ pair: v.tuple([v.string(), v.number()]) }),
    },
  },
  {
    construct: "Date object",
    expect: "issue",
    schemas: {
      Zod: () => z.object({ at: z.date() }),
      ArkType: () => type({ at: "Date" }),
      Valibot: () => v.object({ at: v.date() }),
    },
  },
  {
    construct: "bigint",
    expect: "issue",
    schemas: {
      Zod: () => z.object({ n: z.bigint() }),
      ArkType: () => type({ n: "bigint" }),
      Valibot: () => v.object({ n: v.bigint() }),
    },
  },
  {
    construct: "unknown / any",
    expect: "issue",
    schemas: {
      Zod: () => z.object({ x: z.unknown() }),
      ArkType: () => type({ x: "unknown" }),
      Valibot: () => v.object({ x: v.unknown() }),
    },
  },
  {
    construct: "numeric literals",
    expect: "issue",
    schemas: {
      Zod: () => z.object({ level: z.union([z.literal(1), z.literal(2)]) }),
      ArkType: () => type({ level: "1 | 2" }),
      Valibot: () => v.object({ level: v.picklist([1, 2]) }),
    },
  },
  {
    construct: "default value",
    expect: "issue",
    schemas: {
      Zod: () => z.object({ greeting: z.string().default("Hi") }),
      ArkType: () => type({ greeting: "string = 'Hi'" }),
      Valibot: () => v.object({ greeting: v.optional(v.string(), "Hi") }),
    },
  },
  {
    construct: "transform",
    expect: "issue",
    schemas: {
      Zod: () => z.object({ n: z.string().transform(Number) }),
      ArkType: () => type({ n: "string.numeric.parse" }),
      Valibot: () => v.object({ n: v.pipe(v.string(), v.transform(Number)) }),
    },
  },
  {
    construct: "intersection",
    expect: "record",
    schemas: {
      Zod: () => z.intersection(z.object({ a: z.string() }), z.object({ b: z.string() })),
      ArkType: () => type({ a: "string" }).and({ b: "string" }),
      Valibot: () => v.intersect([v.object({ a: v.string() }), v.object({ b: v.string() })]),
    },
  },
  {
    construct: "recursive schema",
    expect: "issue",
    schemas: {
      Zod: () => {
        const node = z.object({
          name: z.string(),
          get children(): z.ZodArray<typeof node> {
            return z.array(node)
          },
        })
        return z.object({ tree: node })
      },
    },
  },
  {
    construct: "field name with a hyphen",
    expect: "issue",
    schemas: {
      Zod: () => z.object({ "first-name": z.string() }),
      ArkType: () => type({ "first-name": "string" }),
      Valibot: () => v.object({ "first-name": v.string() }),
    },
  },
  {
    construct: "root is not an object",
    expect: "issue",
    schemas: {
      Zod: () => z.string(),
      ArkType: () => type("string"),
      Valibot: () => v.string(),
    },
  },
  {
    construct: "custom refinement (allowed; runs in the TS validator only)",
    expect: "portable",
    schemas: {
      Zod: () => z.object({ code: z.string().refine((s) => s.length === 6) }),
      ArkType: () => type({ code: type.string.narrow((s) => s.length === 6) }),
      Valibot: () =>
        v.object({
          code: v.pipe(
            v.string(),
            v.check((s) => s.length === 6),
          ),
        }),
    },
  },
]

async function cell(make: (() => unknown) | undefined): Promise<PortableSchema | "n/a"> {
  return make ? read(make()) : "n/a"
}

describe("portability matrix", () => {
  it("matches the golden matrix and the expectations", async () => {
    const lines = ["| Construct | Zod 4.6 | ArkType 2.2 | Valibot 1.5 |", "|---|---|---|---|"]
    for (const row of ROWS) {
      const cells: string[] = []
      for (const library of LIBRARIES) {
        const result = await cell(row.schemas[library])
        if (result === "n/a") {
          cells.push("—")
          continue
        }
        if (row.expect === "portable")
          expect(result.issues, `${row.construct} in ${library}`).toEqual([])
        if (row.expect === "issue") {
          expect(result.issues.length, `${row.construct} in ${library}`).toBeGreaterThan(0)
        }
        const [first] = result.issues
        cells.push(
          first ? `✗ ${first.path ? `\`${first.path}\`: ` : ""}${first.message}` : "✓ portable",
        )
      }
      lines.push(`| ${row.construct} | ${cells.join(" | ")} |`)
    }
    await expect(`${lines.join("\n")}\n`).toMatchFileSnapshot("__golden__/schema-portability.md")
  })
})

describe("canonical JSON Schema", () => {
  // Keys in alphabetical order: ArkType sorts properties, so only then can all three match.
  const zod = z.object({
    code: z.string().meta(secret),
    customer: z.object({ email: z.string().meta({ format: "email" }), name: z.string() }),
    discount: z.string().optional(),
    items: z.array(z.object({ name: z.string(), qty: z.number().int() })),
    note: z.string().nullable(),
    orderUrl: z.string().meta(url),
    plan: z.enum(["free", "pro"]),
    total: z.number(),
  })
  const ark = type({
    code: type.string.configure(meta(secret)),
    customer: { email: type.string.configure(meta({ format: "email" })), name: "string" },
    "discount?": "string",
    items: type({ name: "string", qty: "number.integer" }).array(),
    note: "string | null",
    orderUrl: type.string.configure(meta(url)),
    plan: "'free' | 'pro'",
    total: "number",
  })
  const vali = v.object({
    code: v.pipe(v.string(), v.metadata(secret)),
    customer: v.object({
      email: v.pipe(v.string(), v.metadata({ format: "email" })),
      name: v.string(),
    }),
    discount: v.optional(v.string()),
    items: v.array(v.object({ name: v.string(), qty: v.pipe(v.number(), v.integer()) })),
    note: v.nullable(v.string()),
    orderUrl: v.pipe(v.string(), v.metadata(url)),
    plan: v.picklist(["free", "pro"]),
    total: v.number(),
  })

  it("is identical for the same shape in all three libraries", async () => {
    const [fromZod, fromArk, fromVali] = await Promise.all([read(zod), read(ark), read(vali)])
    expect(fromZod.issues).toEqual([])
    expect(fromArk.jsonSchema).toEqual(fromZod.jsonSchema)
    expect(fromVali.jsonSchema).toEqual(fromZod.jsonSchema)
    await expect(`${JSON.stringify(fromZod.jsonSchema, null, 2)}\n`).toMatchFileSnapshot(
      "__golden__/schema.json",
    )
  })

  it("keeps the source property order", async () => {
    const result = await read(z.object({ b: z.string(), a: z.string() }))
    expect(Object.keys(result.jsonSchema?.properties as object)).toEqual(["b", "a"])
  })

  it("reports the path of a nested issue", async () => {
    const result = await read(
      z.object({ items: z.array(z.object({ price: z.union([z.string(), z.number()]) })) }),
    )
    expect(result.issues).toEqual([
      {
        path: "items[].price",
        message: "Unions aren't portable: use one type, optionally nullable",
      },
    ])
    expect(result.jsonSchema).toBeUndefined()
  })

  it("rejects a schema library without JSON Schema support", async () => {
    const custom = {
      "~standard": { version: 1, vendor: "custom", validate: () => ({ value: {} }) },
    }
    await expect(read(custom)).rejects.toThrow(
      expect.objectContaining({ code: "unsupported-schema" }),
    )
  })
})
