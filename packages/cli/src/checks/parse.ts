// The shared parse of a compiled email (P1-165, CHK-07): the DOM with source offsets, the HTML
// inside `<!--[if mso]>` comments parsed too (Word reads it), and every `<style>` through postcss.

import { type ChildNode, type Document, type Element, isComment, isTag, isText } from "domhandler"
import { parseDocument } from "htmlparser2"
import postcss, { type Root } from "postcss"

export interface Located<T> {
  readonly node: T
  /** Absolute offset of the node in the HTML */
  readonly offset: number
  /** Inside an `[if mso]` comment: only Word sees it */
  readonly mso: boolean
}

export interface ParsedEmail {
  readonly document: Document
  /** Every element in document order, Word-only ones included */
  readonly elements: readonly Located<Element>[]
  readonly styles: readonly Located<Root>[]
  readonly comments: readonly Located<string>[]
  position(offset: number): { line: number; column: number }
  offsetOf(node: ChildNode): number
}

const MSO = /^\[if ([^\]]+)\]>([\s\S]*)<!\[endif\]$/

export function parseEmail(html: string): ParsedEmail {
  const document = parseDocument(html, { withStartIndices: true, withEndIndices: true })
  const elements: Located<Element>[] = []
  const styles: Located<Root>[] = []
  const comments: Located<string>[] = []
  const offsets = new WeakMap<ChildNode, number>()

  const walk = (nodes: readonly ChildNode[], base: number, mso: boolean) => {
    for (const node of nodes) {
      const offset = base + (node.startIndex ?? 0)
      offsets.set(node, offset)
      if (isTag(node)) {
        elements.push({ node, offset, mso })
        if (node.name === "style") {
          const text = node.children.find(isText)
          if (text) {
            const start = base + (text.startIndex ?? 0)
            offsets.set(text, start)
            styles.push({ node: postcss.parse(text.data), offset: start, mso })
          }
        } else {
          walk(node.children, base, mso)
        }
      } else if (isComment(node)) {
        comments.push({ node: node.data, offset, mso })
        const match = MSO.exec(node.data)
        // `[if mso]>…<![endif]`: HTML for Word only. `[if !mso]><!` reveals what follows instead.
        if (
          match &&
          /\bmso\b/.test(match[1] as string) &&
          !(match[1] as string).trimStart().startsWith("!")
        ) {
          const inner = parseDocument(match[2] as string, {
            withStartIndices: true,
            withEndIndices: true,
          })
          walk(inner.children, offset + "<!--".length + `[if ${match[1]}]>`.length, true)
        }
      }
    }
  }
  walk(document.children, 0, false)

  const lines = [0]
  for (let i = 0; i < html.length; i++) if (html[i] === "\n") lines.push(i + 1)
  return {
    document,
    elements,
    styles,
    comments,
    position(offset) {
      let low = 0
      let high = lines.length - 1
      while (low < high) {
        const mid = (low + high + 1) >> 1
        if ((lines[mid] as number) <= offset) low = mid
        else high = mid - 1
      }
      return { line: low + 1, column: offset - (lines[low] as number) + 1 }
    },
    offsetOf: (node) => offsets.get(node) ?? 0,
  }
}

/** The element's attribute, or undefined. */
export function attr(element: Element, name: string): string | undefined {
  return element.attribs[name]
}

/** Ancestors up to the document, nearest first. */
export function ancestors(element: Element): Element[] {
  const out: Element[] = []
  for (let node = element.parent; node && isTag(node); node = node.parent) out.push(node)
  return out
}

/** Contains a mustache tag: the value is data, known only when rendered (fixture sweep). */
export function isData(value: string): boolean {
  return value.includes("{{")
}
