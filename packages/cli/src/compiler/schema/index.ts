import type { StandardSchemaV1 } from "@email-kit/core"
import { isEmailKitError } from "@email-kit/core/internal"

import { toJsonSchema } from "./convert.ts"
import { emitJsonSchema } from "./emit.ts"
import { toField } from "./field.ts"
import type { Field, PortableSchema, SchemaIssue } from "./model.ts"

export {
  FIELD_NAME,
  type Field,
  type FieldType,
  MARKER_KEY,
  type PortableSchema,
  type Property,
  type SchemaIssue,
} from "./model.ts"

/**
 * Reads a template's schema into the portable data model, which is what every target language can
 * represent, and writes canonical JSON Schema from it. Schema libraries write different JSON
 * Schema for the same shape (nullable as `type: [t, "null"]` or `anyOf`, integer bounds, open or
 * closed objects, property order), so the compiler doesn't pass theirs through. Anything outside
 * the model is an issue, for `source.schema-portable`.
 *
 * Both the input and the output type are read. They must match: data reaches the template as the
 * backend sends it, so a default, transform or coercion would make the two disagree.
 */
export async function readSchema(
  schema: StandardSchemaV1,
  options: { readonly resolveFrom: string },
): Promise<PortableSchema> {
  const issues: SchemaIssue[] = []
  const models: Partial<Record<"input" | "output", Field>> = {}
  for (const io of ["input", "output"] as const) {
    let json: unknown
    try {
      json = await toJsonSchema(schema, io, options.resolveFrom)
    } catch (error) {
      if (isEmailKitError(error)) throw error
      issues.push({ path: "", message: `JSON Schema conversion failed: ${firstLine(error)}` })
      break
    }
    const model = toField(json, "", issues)
    if (model) models[io] = model
  }
  const { input, output } = models
  const emitted = output && emitJsonSchema(output)
  if (output && output.type !== "object") {
    issues.push({
      path: "",
      message: "The schema must be an object (z.object, type({…}), v.object)",
    })
  } else if (output?.nullable) {
    issues.push({ path: "", message: "The schema root can't be nullable" })
  }
  if (input && emitted && JSON.stringify(emitJsonSchema(input)) !== JSON.stringify(emitted)) {
    issues.push({
      path: "",
      message:
        "The schema's input and output types differ (defaults, transforms or coercions). Data " +
        "reaches the template as sent, so the schema must not change it",
    })
  }
  const unique = dedupe(issues)
  return {
    model: output,
    jsonSchema:
      emitted && unique.length === 0
        ? { $schema: "https://json-schema.org/draft/2020-12/schema", ...emitted }
        : undefined,
    issues: unique,
  }
}

/** The issues without repeats: reading both the input and the output type finds most twice. */
function dedupe(issues: readonly SchemaIssue[]): SchemaIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.path}\0${issue.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function firstLine(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? ""
}
