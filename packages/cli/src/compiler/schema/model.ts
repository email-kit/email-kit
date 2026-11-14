/** The JSON types a portable field can have. */
export type FieldType = "string" | "number" | "integer" | "boolean" | "array" | "object"

/**
 * One field in the portable model: a shape every target language can represent, read from the
 * template's schema. The generated types, the JSON Schema, the fixture variants and the checks
 * all work from it.
 */
export interface Field {
  readonly type: FieldType
  /** Whether `null` is allowed too. */
  readonly nullable: boolean
  readonly description?: string
  /** For string fields: the allowed values. */
  readonly enum?: readonly string[]
  /** For string fields: a format hint, such as `date-time`. */
  readonly format?: string
  /** Constraints such as `minLength`, `pattern`, `minimum`, `multipleOf` and `maxItems`. */
  readonly constraints?: Readonly<Record<string, number | string>>
  /** For arrays: the field each item has. */
  readonly items?: Field
  /** For objects: the properties, in schema order. */
  readonly properties?: readonly Property[]
  /** Marked with `secret`: a code or token, which mustn't appear in the subject or preheader. */
  readonly secret?: true
  /** Marked with `url`: the only fields that may start an `href` or `src`. */
  readonly url?: true
  /**
   * Marked with `formatted()`: the kind of value the caller formats before sending: `date`,
   * `time`, `date-time`, `money`, `number` or `percent`.
   */
  readonly formatted?: string
}

/** A property of an object field. */
export interface Property {
  readonly name: string
  /** Whether the data must have it. */
  readonly required: boolean
  readonly field: Field
}

/** Something in a schema that isn't portable, and why. */
export interface SchemaIssue {
  /** Where in the data, such as `items[].price`. Empty for the root. */
  readonly path: string
  readonly message: string
}

/** A template's schema, read into the portable model. */
export interface PortableSchema {
  /** The model of the data the template receives. */
  readonly model: Field | undefined
  /** The canonical JSON Schema 2020-12, when there are no issues. */
  readonly jsonSchema: Readonly<Record<string, unknown>> | undefined
  readonly issues: readonly SchemaIssue[]
}

/** The JSON Schema keyword that carries email-kit's field markers, such as `{ secret: true }`. */
export const MARKER_KEY = "x-email-kit"

/**
 * The names a field can have: letters, digits and `_`, not starting with a digit. Each name
 * becomes a mustache-core tag and a property in every target language.
 */
export const FIELD_NAME: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/
