import { EmailRenderError, type RenderErrorCode } from "./errors.ts"
import { hasOwn, isObject } from "./shared.ts"

/**
 * A piece of a compiled template, as the compiler writes it: literal text, or a tag. The compiler
 * parses each `{{placeholder}}` template once, so nothing is parsed when an email is sent.
 * - `[0, name]`: `{{name}}`, HTML-escaped in the `html` part;
 * - `[1, name]`: `{{{name}}}`, never escaped;
 * - `[2, name, children]`: `{{#name}}…{{/name}}`, shown for a truthy value, once per list item;
 * - `[3, name, children]`: `{{^name}}…{{/name}}`, shown for a falsy value or an empty list.
 */
export type Node =
  | string
  | readonly [kind: 0 | 1, name: string]
  | readonly [kind: 2 | 3, name: string, children: readonly Node[]]

/** A compiled template: its pieces, in order. */
export type Template = readonly Node[]

/** The characters escaped in HTML, and what replaces them. */
const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

/** Escapes `&`, `<`, `>`, `"` and `'` for HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] as string)
}

/**
 * Fills a compiled template with data, following mustache-core@1. Values are HTML-escaped when
 * `html` is set (the `html` part), and written as they are otherwise (`subject`, `preheader`,
 * `text`). A missing value or one that isn't a string, number or boolean throws an
 * `EmailRenderError`.
 */
export function fill(template: Template, data: unknown, html: boolean): string {
  return renderNodes(template, [data], html)
}

/** Renders nodes against a stack of contexts, the innermost last. */
function renderNodes(nodes: Template, stack: unknown[], html: boolean): string {
  let out = ""
  for (const node of nodes) {
    if (typeof node === "string") {
      out += node
      continue
    }
    const [kind, name] = node
    if (kind < 2) {
      const value = toText(lookup(stack, name), name)
      out += html && kind === 0 ? escapeHtml(value) : value
      continue
    }
    const children = node[2] as Template
    const value = lookup(stack, name)
    const truthy = isTruthy(value, name)
    if (kind === 3) {
      if (!truthy) out += renderNodes(children, stack, html)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        stack.push(item)
        out += renderNodes(children, stack, html)
        stack.pop()
      }
    } else if (value === true) {
      out += renderNodes(children, stack, html)
    } else if (truthy) {
      stack.push(value)
      out += renderNodes(children, stack, html)
      stack.pop()
    }
  }
  return out
}

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

function fail(code: RenderErrorCode, message: string): never {
  throw new EmailRenderError(code, message)
}
