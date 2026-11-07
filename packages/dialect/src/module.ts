import { isObject, type ParsedTemplate, parse, render } from "./index.ts"

// --- inlined into generated modules from here ---
interface TemplateParts {
  readonly subject: string
  readonly preheader: string
  readonly html: string
  readonly text: string
}

interface Model {
  readonly type: "string" | "number" | "integer" | "boolean" | "array" | "object"
  readonly nullable?: true
  readonly enum?: readonly string[]
  readonly constraints?: Readonly<Record<string, number | string>>
  readonly url?: true
  readonly items?: Model
  readonly properties?: Readonly<Record<string, Model>>
  readonly required?: readonly string[]
}

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

function counted(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

class EmailRenderError extends Error {
  readonly code: string
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

/** CLDR data for resolving a requested locale. */
interface LocaleData {
  readonly parents: Readonly<Record<string, string>>
  readonly scripts: Readonly<Record<string, string>>
  readonly regions: Readonly<Record<string, string>>
}

const NO_LOCALE_DATA: LocaleData = { parents: {}, scripts: {}, regions: {} }

function resolveLocale(
  requested: string | undefined,
  available: readonly string[],
  data: LocaleData = NO_LOCALE_DATA,
): string {
  const fallback = available[0] as string
  const keyOf = (tag: string) => {
    const parts = tag.toLowerCase().replace(/_/g, "-").split("-")
    const region =
      parts.length >= 2 && (parts[1] as string).length !== 4
        ? data.regions[`${parts[0]}-${parts[1]}`]
        : undefined
    return (region ? [parts[0], region, ...parts.slice(1)] : parts).join("-")
  }
  const compiled: Record<string, string> = {}
  for (const locale of available) compiled[keyOf(locale)] = locale
  let tag = requested ? keyOf(requested) : undefined
  for (let steps = 0; tag && steps < 32; steps++) {
    if (has(compiled, tag)) return compiled[tag] as string
    const next = has(data.parents, tag) ? data.parents[tag] : truncate(tag, data)
    tag = next === "und" || next === "root" ? undefined : next
  }
  return fallback
}

function truncate(tag: string, data: LocaleData): string | undefined {
  const parts = tag.split("-")
  parts.pop()
  while (parts.length > 0 && (parts[parts.length - 1] as string).length === 1) parts.pop()
  if (parts.length === 0) return undefined
  const script = tag.split("-")[1] as string
  const likely = data.scripts[parts[0] as string]
  if (parts.length === 1 && script.length === 4 && likely && script !== likely) return undefined
  return parts.join("-")
}

function has(record: Record<string, unknown>, key: string): boolean {
  // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn needs lib ES2022 in the host
  return Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined
}

const HTTPS_URL = /^https:\/\/[^\s/?#]+[^\s]*$/i
const URL_CONTEXT_KEYS: readonly string[] = ["helpUrl", "privacyUrl", "siteUrl"]
const EMAIL_ADDRESS = /^[^\s@<>"]+@[^\s@<>"]+$/

function describe(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "a list"
  if (typeof value === "string")
    return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value)
  return typeof value === "object" ? "an object" : `${typeof value} ${String(value)}`
}

function validate(model: Model, value: unknown, path = ""): DataIssue[] {
  const issues: DataIssue[] = []
  const at = path || "data"
  const fail = (message: string) => issues.push({ path: at, message })
  if (value === null || value === undefined) {
    if (value === null && model.nullable) return issues
    fail(value === null ? "can't be null" : "is required")
    return issues
  }

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
      if (model.url && !HTTPS_URL.test(value)) {
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
      if (!isObject(value)) {
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

function project(model: Model, value: unknown): unknown {
  if (model.type === "array") {
    return Array.isArray(value) ? value.map((item) => project(model.items as Model, item)) : value
  }
  if (model.type !== "object" || !isObject(value)) return value
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

function selectKey(value: string): string {
  return `v_${value.replace(/[^A-Za-z0-9]/gu, (c) => `_${(c.codePointAt(0) as number).toString(16)}_`)}`
}

type Tree = Record<string, unknown>
const EK = "_ek"

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
  if (model.type !== "object" || !isObject(value)) return
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
    } else if (field.type === "object" && isObject(v)) {
      const p: Tree = isObject(plural[key]) ? { ...(plural[key] as Tree) } : {}
      const s: Tree = isObject(select[key]) ? { ...(select[key] as Tree) } : {}
      collect(field, v, p, s, category)
      plural[key] = p
      select[key] = s
    }
  }
}

function readContext(keys: readonly string[], context: unknown): Readonly<Record<string, string>> {
  const values: Record<string, string> = {}
  for (const key of keys) {
    const value = isObject(context) ? context[key] : undefined
    if (typeof value !== "string" || value === "") {
      throw new EmailRenderError(
        "missing-context",
        `createEmails() needs "${key}" as a non-empty string`,
      )
    }
    if (URL_CONTEXT_KEYS.includes(key) && !HTTPS_URL.test(value)) {
      throw new EmailRenderError(
        "invalid-context",
        `createEmails() needs "${key}" as an https URL, got ${describe(value)}`,
      )
    }
    if (key === "supportEmail" && !EMAIL_ADDRESS.test(value)) {
      throw new EmailRenderError(
        "invalid-context",
        `createEmails() needs "supportEmail" as an email address, got ${describe(value)}`,
      )
    }
    values[key] = value
  }
  return values
}

function createTemplate(
  id: string,
  purpose: string,
  model: Model,
  locales: readonly string[],
  templates: Readonly<Record<string, TemplateParts>>,
  context: Readonly<Record<string, string>>,
  checkData: boolean,
  plurals: Readonly<Record<string, (n: number) => string>>,
  localeData: LocaleData = NO_LOCALE_DATA,
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
      const locale = resolveLocale(options.locale, locales, localeData)
      const parts = templates[locale] as TemplateParts
      const projected = project(model, data)
      prepare(model, projected, plurals[locale] ?? (() => "other"))
      const values = isObject(projected)
        ? { ...projected, [EK]: { ...(isObject(projected[EK]) ? projected[EK] : {}), context } }
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
  type LocaleData,
  type Model,
  prepare,
  project,
  readContext,
  resolveLocale,
  selectKey,
  type TemplateParts,
  validate,
}
