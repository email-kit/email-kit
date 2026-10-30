// Source files for the source.* checks: the project's templates and components, parsed once with
// rolldown's oxc parser (ESTree, UTF-16 offsets).

import { readFileSync } from "node:fs"
import { relative } from "node:path"

import { parseAst } from "rolldown/parseAst"

/** An ESTree node, loosely: checks read the fields they need. */
export interface Node {
  readonly type: string
  readonly start: number
  readonly end: number
  readonly [key: string]: unknown
}

export interface SourceFile {
  /** Relative to the project folder */
  readonly file: string
  readonly text: string
  /** The templates that bundle it */
  readonly templates: readonly string[]
  program(): Node
  position(offset: number): { line: number; column: number }
}

export function sourceFile(path: string, dir: string, templates: readonly string[]): SourceFile {
  const text = readFileSync(path, "utf8")
  let program: Node | undefined
  const lines = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") lines.push(i + 1)
  return {
    file: relative(dir, path),
    text,
    templates,
    program() {
      const lang = path.endsWith(".tsx")
        ? "tsx"
        : path.endsWith(".jsx")
          ? "jsx"
          : /\.[cm]?ts$/.test(path)
            ? "ts"
            : "js"
      program ??= parseAst(text, { lang }) as unknown as Node
      return program
    },
    position(offset) {
      let line = 0
      while (line + 1 < lines.length && (lines[line + 1] as number) <= offset) line++
      return { line: line + 1, column: offset - (lines[line] as number) + 1 }
    },
  }
}

/** Every node under `node`, depth first, with its parent. */
export function* walk(
  node: unknown,
  parent?: Node,
): Generator<{ node: Node; parent: Node | undefined }> {
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child, parent)
    return
  }
  if (!isNode(node)) return
  yield { node, parent }
  for (const [key, value] of Object.entries(node)) {
    if (key === "start" || key === "end" || key === "type") continue
    if (typeof value === "object" && value !== null) yield* walk(value, node)
  }
}

export function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as Node).type === "string"
}

/** A string literal or a template literal's static text; undefined for anything computed. */
export function staticString(node: Node | undefined): string | undefined {
  if (!node) return undefined
  if (node.type === "Literal" && typeof node.value === "string") return node.value
  if (node.type === "TemplateLiteral") {
    const quasis = node.quasis as { value: { cooked: string } }[]
    return quasis.map((q) => q.value.cooked).join(" ")
  }
  return undefined
}
