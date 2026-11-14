import { type ChildNode, type Document, type Element, isComment, isTag, isText } from "domhandler"
import { parseDocument } from "htmlparser2"
import postcss, { type Root } from "postcss"

import { type Position, positionsIn } from "./position.ts"

/** A node of a parsed email, with where it is. */
export interface Located<T> {
  readonly node: T
  /** The node's offset in the email's HTML. */
  readonly offset: number
  /** Whether it's inside an `<!--[if mso]>` comment, which only classic Outlook reads. */
  readonly mso: boolean
}

/** A compiled email, parsed once for every check. */
export interface ParsedEmail {
  readonly document: Document
  /** Every element in document order, those only classic Outlook reads included. */
  readonly elements: readonly Located<Element>[]
  /** Every `<style>` block, parsed with postcss. */
  readonly styles: readonly Located<Root>[]
  /** The text of every comment, conditional comments included. */
  readonly comments: readonly Located<string>[]
  /** The line and column of an offset in the HTML. */
  position(offset: number): Position
}

/** A conditional comment: its condition, and the HTML inside it. */
const CONDITIONAL = /^\[if ([^\]]+)\]>([\s\S]*)<!\[endif\]$/

/**
 * Parses a compiled email once, for every check: the DOM with source offsets, and every `<style>`
 * through postcss. The HTML inside an `<!--[if mso]>…<![endif]-->` comment is parsed too, since
 * classic Outlook reads it. An `[if !mso]><!` comment instead shows what follows to other clients.
 */
export function parseEmail(html: string): ParsedEmail {
  const options = { withStartIndices: true, withEndIndices: true }
  const document = parseDocument(html, options)
  const elements: Located<Element>[] = []
  const styles: Located<Root>[] = []
  const comments: Located<string>[] = []

  /** Walks nodes whose offsets count from `base`, as a comment's inner HTML does. */
  const walk = (nodes: readonly ChildNode[], base: number, mso: boolean) => {
    for (const node of nodes) {
      const offset = base + (node.startIndex ?? 0)
      if (isTag(node)) {
        elements.push({ node, offset, mso })
        if (node.name !== "style") walk(node.children, base, mso)
        else {
          const css = node.children.find(isText)
          if (css) {
            const start = base + (css.startIndex ?? 0)
            styles.push({ node: postcss.parse(css.data), offset: start, mso })
          }
        }
      } else if (isComment(node)) {
        comments.push({ node: node.data, offset, mso })
        const [, condition = "", inner = ""] = CONDITIONAL.exec(node.data) ?? []
        if (/\bmso\b/.test(condition) && !condition.trimStart().startsWith("!")) {
          const opening = `<!--[if ${condition}]>`.length
          walk(parseDocument(inner, options).children, offset + opening, true)
        }
      }
    }
  }
  walk(document.children, 0, false)
  return { document, elements, styles, comments, position: positionsIn(html) }
}

/** The element's attribute, or `undefined`. */
export function attr(element: Element, name: string): string | undefined {
  return element.attribs[name]
}

/** The element's ancestors up to the document, nearest first. */
export function ancestors(element: Element): Element[] {
  const out: Element[] = []
  for (let node = element.parent; node && isTag(node); node = node.parent) out.push(node)
  return out
}

/** Whether a value holds a mustache tag: it's data, known only once rendered (fixture sweep). */
export function isData(value: string): boolean {
  return value.includes("{{")
}
