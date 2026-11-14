import { findNodeAtLocation, type Node, parseTree } from "jsonc-parser"

/** A value as JSON on one line, with spaces as people write it: `{ "a": [1, 2] }`. */
function inline(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inline).join(", ")}]`
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  const entries = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`)
  return `{ ${entries.join(", ")} }`
}

/**
 * `text` with `path` set to `value`, and nothing else touched, so a tsconfig keeps its comments,
 * formatting and every other line. Missing parents are created, inline. jsonc-parser finds the
 * spot, and the text is inserted by hand, in the style of the property before it: in place in an
 * empty `{}`, after a trailing comma if there is one, and otherwise with a comma right after the
 * value and the new line after any comment that ends the line.
 */
export function insertProperty(text: string, path: readonly string[], value: unknown): string {
  const tree = parseTree(text)
  if (!tree) return text
  const key = path.at(-1) as string
  const parent = path.length === 1 ? tree : findNodeAtLocation(tree, path.slice(0, -1))
  if (!parent) return insertProperty(text, path.slice(0, -1), { [key]: value })
  if (parent.type !== "object") return text
  const entry = `${JSON.stringify(key)}: ${inline(value)}`
  const properties = parent.children ?? []
  const last = properties.at(-1)
  if (!last) {
    return `${text.slice(0, parent.offset)}{ ${entry} }${text.slice(parent.offset + parent.length)}`
  }
  const end = last.offset + last.length
  const multiline = text.slice(parent.offset, (properties[0] as Node).offset).includes("\n")
  const afterValue = /^(\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)?)*\s*,/.exec(text.slice(end))
  if (!multiline) {
    const at = afterValue ? end + afterValue[0].length : end
    return `${text.slice(0, at)}${afterValue ? " " : ", "}${entry}${text.slice(at)}`
  }
  const lineStart = text.lastIndexOf("\n", last.offset) + 1
  const indent = /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? ""
  if (afterValue) {
    const at = end + afterValue[0].length
    const lineEnd = text.indexOf("\n", at)
    const insertAt = lineEnd < 0 ? text.length : lineEnd
    return `${text.slice(0, insertAt)}\n${indent}${entry},${text.slice(insertAt)}`
  }
  const lineEnd = text.indexOf("\n", end)
  const insertAt = lineEnd < 0 ? text.length : lineEnd
  return `${text.slice(0, end)},${text.slice(end, insertAt)}\n${indent}${entry}${text.slice(insertAt)}`
}
