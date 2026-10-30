// Adds one property to a JSON-with-comments file without touching anything else (INIT-04: the
// user's tsconfig keeps its comments, formatting and every other line). jsonc-parser finds the
// spot; the text is inserted by hand, in the style of the property before it.

import { findNodeAtLocation, type Node, parseTree } from "jsonc-parser"

const inline = (value: unknown): string =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? `{ ${Object.entries(value)
        .map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`)
        .join(", ")} }`
    : Array.isArray(value)
      ? `[${value.map(inline).join(", ")}]`
      : JSON.stringify(value)

/** `text` with `path` set to `value`; parents that are missing are created, inline. */
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
    // `{}` or `{ }`: fill it in place.
    return `${text.slice(0, parent.offset)}{ ${entry} }${text.slice(parent.offset + parent.length)}`
  }
  const end = last.offset + last.length
  const multiline = text.slice(parent.offset, (properties[0] as Node).offset).includes("\n")
  // A trailing comma after the last property (JSONC allows it) stays; we go after it.
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
  // The comma goes right after the value; the new line after any comment that ends the line.
  const lineEnd = text.indexOf("\n", end)
  const insertAt = lineEnd < 0 ? text.length : lineEnd
  return `${text.slice(0, end)},${text.slice(end, insertAt)}\n${indent}${entry}${text.slice(insertAt)}`
}
