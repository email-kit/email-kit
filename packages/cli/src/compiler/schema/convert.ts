import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

import type { StandardSchemaV1 } from "@email-kit/core"
import { EmailKitError } from "@email-kit/core/internal"

/** The Standard Schema properties, with the JSON Schema converter Zod 4 and ArkType 2 add. */
type StandardWithJsonSchema = StandardSchemaV1.Props & {
  readonly jsonSchema?: Record<"input" | "output", (options: { target: string }) => unknown>
}

/** Valibot's official converter, from `@valibot/to-json-schema`. */
interface ValibotConverter {
  toJsonSchema(schema: unknown, config: Record<string, unknown>): unknown
}

/**
 * The library's own JSON Schema for a schema, for its `input` or `output` type. Zod 4 and ArkType 2
 * give it through `~standard.jsonSchema`. Valibot doesn't, so its official converter is used,
 * which the project installs. Its refinements are ignored, as Zod and ArkType ignore theirs: they
 * stay TypeScript-only checks.
 */
export async function toJsonSchema(
  schema: StandardSchemaV1,
  io: "input" | "output",
  resolveFrom: string,
): Promise<unknown> {
  const standard = schema["~standard"] as StandardWithJsonSchema
  if (standard.jsonSchema) return standard.jsonSchema[io]({ target: "draft-2020-12" })
  if (standard.vendor !== "valibot") {
    throw new EmailKitError(
      "unsupported-schema",
      `A "${standard.vendor}" schema can't be converted to JSON Schema. Use Zod 4, ArkType 2 or ` +
        "Valibot with @valibot/to-json-schema",
    )
  }
  const converter = await valibotConverter(resolveFrom)
  return converter.toJsonSchema(schema, {
    target: "draft-2020-12",
    typeMode: io,
    errorMode: "throw",
    ignoreActions: ["check"],
  })
}

/**
 * Imports `@valibot/to-json-schema` from the project, resolved from the template, so it's the copy
 * that matches the project's Valibot.
 */
async function valibotConverter(resolveFrom: string): Promise<ValibotConverter> {
  let path: string
  try {
    path = createRequire(resolveFrom).resolve("@valibot/to-json-schema")
  } catch {
    throw new EmailKitError(
      "missing-converter",
      "Valibot schemas need @valibot/to-json-schema: install it as a devDependency",
    )
  }
  return (await import(pathToFileURL(path).href)) as ValibotConverter
}
