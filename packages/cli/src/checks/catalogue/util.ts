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

/** Visible text directly inside the element: not whitespace, the &nbsp; of a spacer cell, or the
 * section tags (`{{#x}}`, `{{/x}}`) of an <If> or <Each>, which are structure. */
export function ownText(element: Element): boolean {
  return element.children.some(
    (child) =>
      child.type === "text" &&
      /[^\s\u00a0]/.test(
        (child as unknown as { data: string }).data.replace(/\{\{[#^/][^}]*\}\}/g, ""),
      ),
  )
}

export const TEXT_CELLS: ReadonlySet<string> = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "td",
  "th",
  "caption",
])

/** The words a reader sees in the HTML body: not head, styles, Word-only or hidden content. */
export function visibleText(email: CheckedEmail): string {
  const out: string[] = []
  const walk = (node: {
    type: string
    children?: unknown[]
    data?: string
    name?: string
    attribs?: Record<string, string>
  }) => {
    if (node.type === "text") out.push(node.data ?? "")
    if (node.type !== "tag" && node.type !== "root") return
    if (node.name === "head" || node.name === "style" || node.name === "script") return
    if (/display\s*:\s*none/i.test(node.attribs?.style ?? "")) return
    for (const child of (node.children ?? []) as (typeof node)[]) walk(child)
  }
  walk(email.parsed.document as never)
  return out.join(" ").replace(/\s+/g, " ").trim()
}

/** Mustache tags out, whitespace collapsed: the copy a template writes itself. */
export function withoutTags(text: string): string {
  return text
    .replace(/\{\{[^}]*\}\}\}?/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
