import { readFileSync } from "node:fs"

import { parseAst } from "rolldown/parseAst"

import { relativePath } from "../paths.ts"
import { type Position, positionsIn } from "./position.ts"

/** An ESTree node, loosely: checks read the fields they need. */
export interface Node {
  readonly type: string
  readonly start: number
  readonly end: number
  readonly [key: string]: unknown
}

/** A project source file for the `source.*` checks: a template or a component. */
export interface SourceFile {
  /** Relative to the project folder. */
  readonly file: string
  readonly text: string
  /** The templates that bundle it. */
  readonly templates: readonly string[]
  /** The file's syntax tree, parsed the first time it's asked for. */
  program(): Node
  /** The line and column of an offset in the text. */
  position(offset: number): Position
}

/**
 * Reads a project file for the `source.*` checks. It's parsed only when a check asks, and only
 * once, with rolldown's oxc parser: an ESTree with UTF-16 offsets.
 */
export function sourceFile(path: string, dir: string, templates: readonly string[]): SourceFile {
  const text = readFileSync(path, "utf8")
  let program: Node | undefined
  return {
    file: relativePath(dir, path),
    text,
    templates,
    program() {
      program ??= parseAst(text, { lang: languageOf(path) }) as unknown as Node
      return program
    },
    position: positionsIn(text),
  }
}

/** The language the parser reads a file as, by its extension. */
function languageOf(path: string): "tsx" | "jsx" | "ts" | "js" {
  if (path.endsWith(".tsx")) return "tsx"
  if (path.endsWith(".jsx")) return "jsx"
  return /\.[cm]?ts$/.test(path) ? "ts" : "js"
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

/** Whether a value is an ESTree node. */
export function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as Node).type === "string"
}

/** A string literal or a template literal's static text; `undefined` for anything computed. */
export function staticString(node: Node | undefined): string | undefined {
  if (!node) return undefined
  if (node.type === "Literal" && typeof node.value === "string") return node.value
  if (node.type === "TemplateLiteral") {
    const quasis = node.quasis as { value: { cooked: string } }[]
    return quasis.map((q) => q.value.cooked).join(" ")
  }
  return undefined
}
