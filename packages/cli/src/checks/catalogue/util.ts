import type { Element } from "domhandler"
import type { Declaration, Root } from "postcss"

import type { Located } from "../parse.ts"
import type { CheckContext, CheckedEmail, Problem } from "../types.ts"

export type Report = (problem: Problem) => void

/** Runs `fn` for every email; checks that look at one email at a time. */
export function eachEmail(
  context: CheckContext,
  fn: (email: CheckedEmail, report: (message: string, at?: number, fix?: string) => void) => void,
  report: Report,
): void {
  for (const email of context.emails) {
    fn(email, (message, at, fix) =>
      report({
        message,
        email,
        ...(at !== undefined && { at }),
        ...(fix !== undefined && { fix }),
      }),
    )
  }
}

/** Declarations in `<style>` blocks, with their absolute offsets. */
export function* declarations(
  styles: readonly Located<Root>[],
): Generator<{ decl: Declaration; offset: number; mso: boolean }> {
  for (const style of styles) {
    const found: Declaration[] = []
    style.node.walkDecls((decl) => {
      found.push(decl)
    })
    for (const decl of found) {
      yield { decl, offset: style.offset + (decl.source?.start?.offset ?? 0), mso: style.mso }
    }
  }
}

/** `style` attributes as property → value, with the element's offset. */
export function* inlineStyles(elements: readonly Located<Element>[]): Generator<{
  element: Element
  offset: number
  mso: boolean
  style: string
  props: Map<string, string>
}> {
  for (const { node, offset, mso } of elements) {
    const style = node.attribs.style
    if (style === undefined) continue
    const props = new Map<string, string>()
    for (const part of style.split(";")) {
      const colon = part.indexOf(":")
      if (colon > 0)
        props.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim())
    }
    yield { element: node, offset, mso, style, props }
  }
}

export function text(element: Element): string {
  let out = ""
  for (const child of element.children) {
    if (child.type === "text") out += (child as unknown as { data: string }).data
    else if ("children" in child) out += text(child as Element)
  }
  return out
}
