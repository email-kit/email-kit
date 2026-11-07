// mustache-core@1 reference renderer. the conformance
// suite in conformance/mustache-core/ is the authority on behaviour.
//
// This file is self-contained on purpose: no imports and only standard ECMAScript up to ES2020,
// because the compiler inlines its source into every generated module, which compiles
// under the host's tsconfig. Keep it small. Everything below the marker is inlined.

// --- inlined into generated modules from here ---

export const DIALECT = "mustache-core@1" as const
export type Profile = "html" | "text"

export const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

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

export class MustacheCoreError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = "MustacheCoreError"
    this.code = code
  }
}

export type Node = string | VariableNode | SectionNode

export interface VariableNode {
  readonly type: "variable"
  readonly name: string
  readonly raw: boolean
}

export interface SectionNode {
  readonly type: "section" | "inverted"
  readonly name: string
  readonly children: readonly Node[]
}

export interface ParsedTemplate {
  readonly nodes: readonly Node[]
}

const NAME = /^(?:\.|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/
const UNSUPPORTED_SIGIL = /^[!>=&<$]/
const PADDING = /^[ \t]+|[ \t]+$/g
const LINE_END = /[ \t]*(?:\r?\n|$)/y

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

function isTruthy(value: unknown, name: string): boolean {
  if (typeof value === "number") return finite(value, name) !== 0
  if (Array.isArray(value)) return value.length > 0
  return !(value === undefined || value === null || value === false || value === "")
}

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

/** A plain object: not null and not an array. module.ts uses it too. */
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

export function render(template: string | ParsedTemplate, data: unknown, profile: Profile): string {
  const { nodes } = typeof template === "string" ? parse(template) : template
  return renderNodes(nodes, [data], profile !== "text")
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] as string)
}
