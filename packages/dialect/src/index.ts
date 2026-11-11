/**
 * mustache-core@1, the placeholder language of compiled email-kit templates: its parser and
 * reference renderer. The conformance suite in conformance/mustache-core/ decides how it behaves.
 *
 * Everything below the marker line, here and in runtime/, is copied into every generated module,
 * which compiles under the host project's tsconfig. So that code has no imports beyond these
 * files, uses nothing newer than ES2020, and stays small.
 *
 * @packageDocumentation
 */

// --- inlined into generated modules from here ---

/** The placeholder language compiled templates are written in, and its version. */
export const DIALECT = "mustache-core@1" as const

/** How values are written: escaped for `html`, as they are for `text`. */
export type Profile = "html" | "text"

/** The characters escaped in HTML, and what replaces them. */
export const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

/** What kind of problem a `MustacheCoreError` reports. */
export type ErrorCode =
  | "unclosed-tag"
  | "unsupported-tag"
  | "invalid-name"
  | "unclosed-section"
  | "unexpected-close"
  | "mismatched-close"
  | "missing-value"
  | "non-scalar-value"
  | "invalid-number"

/**
 * A template that can't be parsed, or data that can't fill it, such as a missing value. The
 * templates email-kit compiles always parse, so with them it means the data is wrong.
 */
export class MustacheCoreError extends Error {
  /** What kind of problem it is, such as `"missing-value"`. */
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = "MustacheCoreError"
    this.code = code
  }
}

/** A piece of a parsed template: literal text, a `{{variable}}` or a section. */
export type Node = string | VariableNode | SectionNode

/** `{{name}}`, escaped in HTML, or `{{{name}}}` when `raw`, never escaped. */
export interface VariableNode {
  readonly type: "variable"
  readonly name: string
  readonly raw: boolean
}

/** `{{#name}}…{{/name}}`, or `{{^name}}…{{/name}}` when `inverted`. */
export interface SectionNode {
  readonly type: "section" | "inverted"
  readonly name: string
  readonly children: readonly Node[]
}

/** A template parsed once, to render many times. */
export interface ParsedTemplate {
  readonly nodes: readonly Node[]
}

const NAME = /^(?:\.|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/
const UNSUPPORTED_SIGIL = /^[!>=&<$]/
const PADDING = /^[ \t]+|[ \t]+$/g
const LINE_END = /[ \t]*(?:\r?\n|$)/y

/**
 * Finds `name` in the innermost context that has its first part, then follows the rest of the
 * path in that context only. `.` is the innermost context itself.
 */
function lookup(stack: readonly unknown[], name: string): unknown {
  if (name === ".") return stack[stack.length - 1]
  const [first = "", ...rest] = name.split(".")
  for (let i = stack.length - 1; i >= 0; i--) {
    const context = stack[i]
    if (isObject(context) && hasOwn(context, first)) {
      let value = context[first]
      for (const key of rest) {
        if (!isObject(value) || !hasOwn(value, key)) return undefined
        value = value[key]
      }
      return value
    }
  }
  return undefined
}

/** Whether a section shows. Missing, `null`, `false`, `""`, `0` and an empty list don't. */
function isTruthy(value: unknown, name: string): boolean {
  if (typeof value === "number") return finite(value, name) !== 0
  if (Array.isArray(value)) return value.length > 0
  return !(value === undefined || value === null || value === false || value === "")
}

/** A value as text. A missing value, or one that isn't a string, number or boolean, throws. */
function toText(value: unknown, name: string): string {
  if (typeof value === "string") return value
  if (typeof value === "number") return String(finite(value, name))
  if (typeof value === "boolean") return value ? "true" : "false"
  if (value === undefined || value === null) fail("missing-value", `No value for "${name}"`)
  return fail("non-scalar-value", `"${name}" is not a string, number or boolean`)
}

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) fail("invalid-number", `"${name}" is ${value}`)
  return value
}

function hasOwn(object: object, key: string): boolean {
  // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn needs lib ES2022 in the host
  return Object.prototype.hasOwnProperty.call(object, key)
}

/** A plain object: not `null` and not an array. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isBlank(text: string, from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    if (text[i] !== " " && text[i] !== "\t") return false
  }
  return true
}

function fail(code: ErrorCode, message: string): never {
  throw new MustacheCoreError(code, message)
}

/** Renders nodes against a stack of contexts, the innermost last. */
function renderNodes(nodes: readonly Node[], stack: unknown[], html: boolean): string {
  let out = ""
  for (const node of nodes) {
    if (typeof node === "string") {
      out += node
    } else if (node.type === "variable") {
      const value = toText(lookup(stack, node.name), node.name)
      out += html && !node.raw ? escapeHtml(value) : value
    } else {
      const value = lookup(stack, node.name)
      const truthy = isTruthy(value, node.name)
      if (node.type === "inverted") {
        if (!truthy) out += renderNodes(node.children, stack, html)
      } else if (Array.isArray(value)) {
        for (const item of value) {
          stack.push(item)
          out += renderNodes(node.children, stack, html)
          stack.pop()
        }
      } else if (value === true) {
        out += renderNodes(node.children, stack, html)
      } else if (truthy) {
        stack.push(value)
        out += renderNodes(node.children, stack, html)
        stack.pop()
      }
    }
  }
  return out
}

/**
 * Parses a template. A section tag alone on its line removes the whole line, so sections leave no
 * blank lines behind. Bad syntax throws a `MustacheCoreError` with its offset.
 */
export function parse(template: string): ParsedTemplate {
  const nodes: Node[] = []
  const open: { name: string; offset: number; parent: Node[] }[] = []
  let children = nodes
  let pos = 0

  for (;;) {
    const start = template.indexOf("{{", pos)
    if (start === -1) break

    const raw = template[start + 2] === "{"
    const closer = raw ? "}}}" : "}}"
    const close = template.indexOf(closer, start + closer.length)
    if (close === -1) fail("unclosed-tag", `Tag at offset ${start} is not closed with "${closer}"`)

    const content = template.slice(start + closer.length, close)
    const sigil = !raw && /^[#^/]/.test(content) ? content.charAt(0) : ""
    const name = content.slice(sigil.length).replace(PADDING, "")
    if (!NAME.test(name)) {
      if (UNSUPPORTED_SIGIL.test(content)) {
        fail("unsupported-tag", `Unsupported tag "{{${content}}}" at offset ${start}`)
      }
      fail("invalid-name", `Invalid name "${name}" at offset ${start}`)
    }

    let textEnd = start
    let end = close + closer.length
    if (sigil) {
      const lineStart = template.lastIndexOf("\n", start - 1) + 1
      LINE_END.lastIndex = end
      const after = LINE_END.exec(template)
      if (after && isBlank(template, lineStart, start)) {
        textEnd = lineStart
        end += after[0].length
      }
    }
    if (textEnd > pos) children.push(template.slice(pos, textEnd))
    pos = end

    if (sigil === "/") {
      const section = open.pop()
      if (!section) fail("unexpected-close", `"{{/${name}}}" at offset ${start} closes nothing`)
      if (section.name !== name) {
        fail(
          "mismatched-close",
          `"{{/${name}}}" at offset ${start} does not close "${section.name}" (offset ${section.offset})`,
        )
      }
      children = section.parent
    } else if (sigil) {
      const inner: Node[] = []
      children.push({ type: sigil === "#" ? "section" : "inverted", name, children: inner })
      open.push({ name, offset: start, parent: children })
      children = inner
    } else {
      children.push({ type: "variable", name, raw })
    }
  }

  if (pos < template.length) children.push(template.slice(pos))
  const unclosed = open.pop()
  if (unclosed) {
    fail(
      "unclosed-section",
      `Section "${unclosed.name}" at offset ${unclosed.offset} is not closed`,
    )
  }
  return { nodes }
}

/** Fills a template with data. Values are escaped for the `html` profile only. */
export function render(template: string | ParsedTemplate, data: unknown, profile: Profile): string {
  const { nodes } = typeof template === "string" ? parse(template) : template
  return renderNodes(nodes, [data], profile !== "text")
}

/** Escapes `&`, `<`, `>`, `"` and `'` for HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] as string)
}
