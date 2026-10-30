// The runtime half of a generated module (P1-074): locale fallback (OUT-09), validating data
// against the schema (OUT-08, RUN-05), projecting it onto the schema, the runtime context
// (RUN-04), and the per-template render() (OUT-10, RUN-06). The compiler inlines it after the
// renderer, so the same rules apply: no imports below the marker, ES2020, and nothing unused
// (hosts may compile with noUnusedLocals).

import { type ParsedTemplate, parse, render } from "./index.ts"

// --- inlined into generated modules from here ---

/** The four parts of one template in one locale, as mustache-core templates. */
interface TemplateParts {
  readonly subject: string
  readonly preheader: string
  readonly html: string
  readonly text: string
}

/**
 * A template's data model, from its schema: the portable subset of JSON Schema (R4) in a compact
 * form. Constraint names are JSON Schema's.
 */
interface Model {
  readonly type: "string" | "number" | "integer" | "boolean" | "array" | "object"
  readonly nullable?: true
  readonly enum?: readonly string[]
  readonly constraints?: Readonly<Record<string, number | string>>
  /** An https URL (AUTH-04) */
  readonly url?: true
  readonly items?: Model
  readonly properties?: Readonly<Record<string, Model>>
  readonly required?: readonly string[]
}

/** "1 character", "2 characters" */
function counted(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

/** A value that doesn't match the schema, at a path such as `items[1].qty`. */
interface DataIssue {
  readonly path: string
  readonly message: string
}

interface RenderedParts extends TemplateParts {
  readonly meta: { readonly id: string; readonly locale: string; readonly purpose: string }
}

interface RuntimeTemplate {
  readonly meta: {
    readonly id: string
    readonly purpose: string
    readonly locales: readonly string[]
  }
  readonly templates: Readonly<Record<string, TemplateParts>>
  validate(data: unknown): readonly DataIssue[]
  render(data: unknown, options?: { readonly locale?: string }): RenderedParts
}

/** An error from render() that isn't a mustache-core error, such as data that fails the schema. */
class EmailRenderError extends Error {
  readonly code: string
  /** For `invalid-data`: every value that doesn't match the schema */
  readonly issues: readonly DataIssue[]

  constructor(code: string, message: string, issues: readonly DataIssue[] = []) {
    super(message)
    this.name = "EmailRenderError"
    this.code = code
    this.issues = issues
  }
}

const parsedTemplates = new Map<string, ParsedTemplate>()

function fill(template: string, data: unknown, profile: "html" | "text"): string {
  let parsed = parsedTemplates.get(template)
  if (parsed === undefined) {
    parsed = parse(template)
    parsedTemplates.set(template, parsed)
  }
  return render(parsed, data, profile)
}

/**
 * BCP 47 lookup (RFC 4647 §3.4): try the tag, then drop subtags from the end (`pt-BR` → `pt`),
 * then fall back to the default locale. Matching ignores case.
 */
function resolveLocale(requested: string | undefined, available: readonly string[]): string {
  const fallback = available[0] as string
  let tag = requested?.toLowerCase()
  while (tag) {
    for (const locale of available) {
      if (locale.toLowerCase() === tag) return locale
    }
    const cut = tag.lastIndexOf("-")
    tag = cut > 0 ? tag.slice(0, cut) : undefined
  }
  return fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function has(record: Record<string, unknown>, key: string): boolean {
  // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn needs lib ES2022 in the host
  return Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined
}

function describe(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "a list"
  if (typeof value === "string")
    return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value)
  return typeof value === "object" ? "an object" : `${typeof value} ${String(value)}`
}

/**
 * Checks data against the model (OUT-08): types, required and nullable fields, enums, length
 * and range constraints, and https for url fields (RUN-05). Keys the schema doesn't declare are
 * ignored; projection drops them.
 */
function validate(model: Model, value: unknown, path = ""): DataIssue[] {
  const issues: DataIssue[] = []
  const at = path || "data"
  const fail = (message: string) => issues.push({ path: at, message })
  if (value === null || value === undefined) {
    if (value === null && model.nullable) return issues
    fail(value === null ? "can't be null" : "is required")
    return issues
  }
  // Constraints are read through these, never as c["minLength"]: a linter would rewrite that to
  // c.minLength, which hosts with noPropertyAccessFromIndexSignature reject.
  const constraints = model.constraints ?? {}
  const number = (name: string): number | undefined => {
    const limit = constraints[name]
    return typeof limit === "number" ? limit : undefined
  }
  const text = (name: string): string | undefined => {
    const limit = constraints[name]
    return typeof limit === "string" ? limit : undefined
  }
  switch (model.type) {
    case "string": {
      if (typeof value !== "string") {
        fail(`expected a string, got ${describe(value)}`)
        break
      }
      const length = Array.from(value).length
      if (model.enum && model.enum.indexOf(value) === -1) {
        fail(
          `expected one of ${model.enum.map((v) => JSON.stringify(v)).join(", ")}, got ${describe(value)}`,
        )
      }
      const min = number("minLength")
      const max = number("maxLength")
      const pattern = text("pattern")
      if (min !== undefined && length < min) fail(`must be at least ${counted(min, "character")}`)
      if (max !== undefined && length > max) fail(`must be at most ${counted(max, "character")}`)
      if (pattern !== undefined && !new RegExp(pattern, "u").test(value)) {
        fail(`must match ${pattern}`)
      }
      if (model.url && !/^https:\/\/[^\s/?#]+[^\s]*$/i.test(value)) {
        fail(`must be an https URL, got ${describe(value)}`)
      }
      break
    }
    case "number":
    case "integer": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        fail(`expected a number, got ${describe(value)}`)
        break
      }
      if (model.type === "integer" && Math.floor(value) !== value)
        fail(`expected an integer, got ${value}`)
      const bounds: readonly [string, (limit: number) => boolean, string][] = [
        ["minimum", (limit) => value >= limit, "at least"],
        ["maximum", (limit) => value <= limit, "at most"],
        ["exclusiveMinimum", (limit) => value > limit, "more than"],
        ["exclusiveMaximum", (limit) => value < limit, "less than"],
      ]
      for (const [name, ok, words] of bounds) {
        const limit = number(name)
        if (limit !== undefined && !ok(limit)) fail(`must be ${words} ${limit}, got ${value}`)
      }
      const step = number("multipleOf")
      if (step !== undefined && Math.abs(value / step - Math.round(value / step)) > 1e-9) {
        fail(`must be a multiple of ${step}`)
      }
      break
    }
    case "boolean":
      if (typeof value !== "boolean") fail(`expected true or false, got ${describe(value)}`)
      break
    case "array": {
      if (!Array.isArray(value)) {
        fail(`expected a list, got ${describe(value)}`)
        break
      }
      const minItems = number("minItems")
      const maxItems = number("maxItems")
      if (minItems !== undefined && value.length < minItems)
        fail(`must have at least ${counted(minItems, "item")}`)
      if (maxItems !== undefined && value.length > maxItems)
        fail(`must have at most ${counted(maxItems, "item")}`)
      value.forEach((item, index) => {
        issues.push(...validate(model.items as Model, item, `${path}[${index}]`))
      })
      break
    }
    case "object": {
      if (!isRecord(value)) {
        fail(`expected an object, got ${describe(value)}`)
        break
      }
      const required = model.required ?? []
      const properties = model.properties ?? {}
      for (const key of Object.keys(properties)) {
        const child = path ? `${path}.${key}` : key
        if (has(value, key)) {
          issues.push(...validate(properties[key] as Model, value[key], child))
        } else if (required.indexOf(key) !== -1) {
          issues.push({ path: child, message: "is required" })
        }
      }
      break
    }
  }
  return issues
}

/**
 * Copies data onto the model before rendering: unknown keys are dropped and missing optional
 * keys become null. Without this, mustache-core's context-stack lookup could find an outer value
 * through an item that lacks the key, or an extra key could shadow an outer one.
 */
function project(model: Model, value: unknown): unknown {
  if (model.type === "array") {
    return Array.isArray(value) ? value.map((item) => project(model.items as Model, item)) : value
  }
  if (model.type !== "object" || !isRecord(value)) return value
  const out: Record<string, unknown> = {}
  const required = model.required ?? []
  const properties = model.properties ?? {}
  for (const key of Object.keys(properties)) {
    if (has(value, key)) {
      out[key] = project(properties[key] as Model, value[key])
    } else if (required.indexOf(key) === -1) {
      out[key] = null
    }
  }
  return out
}

/** The section key for a select value: `v_` and the value, other characters as `_<hex>_`. */
function selectKey(value: string): string {
  return `v_${value.replace(/[^A-Za-z0-9]/gu, (c) => `_${(c.codePointAt(0) as number).toString(16)}_`)}`
}

type Tree = Record<string, unknown>

// The reserved key render() adds (§15). A constant, so strict consumers' noPropertyAccessFromIndexSignature
// accepts the access and formatters leave it bracketed.
const EK = "_ek"

/**
 * Data preparation (ADR 0003): every object gets `_ek.plural`, each number field's category and
 * `exact_N` for whole numbers, and `_ek.select`, each enum field's value as a key. An object's
 * own fields go over its parents' entries, the way mustache-core resolves names, so a message in
 * a list item still finds the fields outside it.
 */
function prepare(
  model: Model,
  value: unknown,
  category: (n: number) => string,
  inherited: { readonly plural: Tree; readonly select: Tree } = { plural: {}, select: {} },
): void {
  if (model.type === "array") {
    if (Array.isArray(value))
      for (const item of value) prepare(model.items as Model, item, category, inherited)
    return
  }
  if (model.type !== "object" || !isRecord(value)) return
  const plural: Tree = { ...inherited.plural }
  const select: Tree = { ...inherited.select }
  collect(model, value, plural, select, category)
  if (Object.keys(plural).length > 0 || Object.keys(select).length > 0)
    value[EK] = { plural, select }
  const properties = model.properties ?? {}
  for (const key of Object.keys(properties)) {
    prepare(properties[key] as Model, value[key], category, { plural, select })
  }
}

// The entries for an object's fields, down through nested objects but not into lists.
function collect(
  model: Model,
  value: Record<string, unknown>,
  plural: Tree,
  select: Tree,
  category: (n: number) => string,
): void {
  const properties = model.properties ?? {}
  for (const key of Object.keys(properties)) {
    const field = properties[key] as Model
    const v = value[key]
    if (
      (field.type === "number" || field.type === "integer") &&
      typeof v === "number" &&
      Number.isFinite(v)
    ) {
      const entry: Tree = { [category(v)]: true }
      if (Number.isSafeInteger(v) && v >= 0) entry[`exact_${v}`] = true
      plural[key] = entry
    } else if (field.type === "string" && field.enum && typeof v === "string") {
      select[key] = { [selectKey(v)]: true }
    } else if (field.type === "object" && isRecord(v)) {
      const p: Tree = isRecord(plural[key]) ? { ...(plural[key] as Tree) } : {}
      const s: Tree = isRecord(select[key]) ? { ...(select[key] as Tree) } : {}
      collect(field, v, p, s, category)
      plural[key] = p
      select[key] = s
    }
  }
}

/**
 * Checks the values passed to createEmails() (RUN-04): every runtime key is a non-empty string.
 * Only the declared keys are kept.
 */
function readContext(keys: readonly string[], context: unknown): Readonly<Record<string, string>> {
  const values: Record<string, string> = {}
  for (const key of keys) {
    const value = isRecord(context) ? context[key] : undefined
    if (typeof value !== "string" || value === "") {
      throw new EmailRenderError(
        "missing-context",
        `createEmails() needs "${key}" as a non-empty string`,
      )
    }
    values[key] = value
  }
  return values
}

/**
 * Builds one entry of the generated `emails` object. `locales[0]` is the default locale. With
 * `checkData`, render() validates the data first. The context goes under the reserved `_ek` key
 * after projection, so data can't override it: the schema can't declare `_ek`, and projection
 * drops every undeclared key.
 */
function createTemplate(
  id: string,
  purpose: string,
  model: Model,
  locales: readonly string[],
  templates: Readonly<Record<string, TemplateParts>>,
  context: Readonly<Record<string, string>>,
  checkData: boolean,
  plurals: Readonly<Record<string, (n: number) => string>>,
): RuntimeTemplate {
  return {
    meta: { id, purpose, locales },
    templates,
    validate: (data) => validate(model, data),
    render(data, options = {}) {
      if (checkData) {
        const issues = validate(model, data)
        if (issues.length > 0) {
          throw new EmailRenderError(
            "invalid-data",
            `The data for "${id}" doesn't match its schema:\n${issues
              .map((issue) => `  ${issue.path}: ${issue.message}`)
              .join("\n")}`,
            issues,
          )
        }
      }
      const locale = resolveLocale(options.locale, locales)
      const parts = templates[locale] as TemplateParts
      const projected = project(model, data)
      prepare(model, projected, plurals[locale] ?? (() => "other"))
      const values = isRecord(projected)
        ? { ...projected, [EK]: { ...(isRecord(projected[EK]) ? projected[EK] : {}), context } }
        : projected
      const subject = fill(parts.subject, values, "text")
      if (/[\r\n]/.test(subject)) {
        throw new EmailRenderError(
          "subject-line-break",
          `The subject of "${id}" contains a line break; check the data for CR or LF characters`,
        )
      }
      return {
        subject,
        preheader: fill(parts.preheader, values, "text"),
        html: fill(parts.html, values, "html"),
        text: fill(parts.text, values, "text"),
        meta: { id, locale, purpose },
      }
    },
  }
}

export {
  createTemplate,
  type DataIssue,
  EmailRenderError,
  type Model,
  prepare,
  project,
  readContext,
  resolveLocale,
  selectKey,
  type TemplateParts,
  validate,
}
