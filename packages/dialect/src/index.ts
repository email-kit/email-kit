/**
 * mustache-core@1, the placeholder language of compiled email-kit templates: its parser, the
 * compiler from parsed templates to what `@email-kit/runtime` renders, and the reference renderer
 * (parse, compile, then the runtime's `fill`). The conformance suite in conformance/mustache-core/
 * decides how it behaves, so it tests the renderer that ships.
 *
 * @packageDocumentation
 */

import { type Node as CompiledNode, EmailRenderError, escapeHtml, fill } from "@email-kit/runtime"

export { escapeHtml }

/** The placeholder language compiled templates are written in, and its version. */
export const DIALECT = "mustache-core@1" as const

/** How values are written: escaped for `html`, as they are for `text`. */
export type Profile = "html" | "text"

/** The characters escaped in HTML, and what replaces them (the runtime's table, §6). */
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

function isBlank(text: string, from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    if (text[i] !== " " && text[i] !== "\t") return false
  }
  return true
}

function fail(code: ErrorCode, message: string): never {
  throw new MustacheCoreError(code, message)
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

/**
 * A parsed template in the compact form the generated module carries and `@email-kit/runtime`
 * renders: text, and `[kind, name, children?]` for each tag (see the runtime's `Node`).
 */
export function compile(template: string | ParsedTemplate): CompiledNode[] {
  const { nodes } = typeof template === "string" ? parse(template) : template
  return nodes.map(compileNode)
}

function compileNode(node: Node): CompiledNode {
  if (typeof node === "string") return node
  if (node.type === "variable") return [node.raw ? 1 : 0, node.name]
  return [node.type === "section" ? 2 : 3, node.name, node.children.map(compileNode)]
}

/** The render errors the spec defines (§10), which the runtime reports as `EmailRenderError`. */
const RENDER_CODES: ReadonlySet<string> = new Set([
  "missing-value",
  "non-scalar-value",
  "invalid-number",
])

/**
 * Fills a template with data. Values are escaped for the `html` profile only. It's the runtime's
 * renderer on the compiled template, so errors are `MustacheCoreError`s as the spec names them.
 */
export function render(template: string | ParsedTemplate, data: unknown, profile: Profile): string {
  try {
    return fill(compile(template), data, profile !== "text")
  } catch (error) {
    if (error instanceof EmailRenderError && RENDER_CODES.has(error.code)) {
      throw new MustacheCoreError(error.code as ErrorCode, error.message)
    }
    throw error
  }
}
