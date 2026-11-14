import { colorsNamed } from "culori"
import { type ChildNode, type Element, hasChildren, isTag, isText } from "domhandler"
import type { Node as CssNode, Declaration, Root } from "postcss"

import type { Field } from "../../compiler/schema/index.ts"
import type { Located } from "../parse.ts"
import type { CheckContext, CheckedEmail, CheckedTemplate, Problem } from "../types.ts"

/** How a check reports a problem. */
export type Report = (problem: Problem) => void

/** How a check that looks at one email reports a problem in it, at an offset in its HTML. */
export type EmailReport = (message: string, at?: number, fix?: string) => void

/** Runs `fn` for every email, for checks that look at one email at a time. */
export function eachEmail(
  context: CheckContext,
  report: Report,
  fn: (email: CheckedEmail, problem: EmailReport) => void,
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

/** The template an email was compiled from. */
export function templateOf(
  context: CheckContext,
  email: CheckedEmail,
): CheckedTemplate | undefined {
  return context.templates.find((template) => template.id === email.template)
}

/** The first element with the tag name, outside the HTML only classic Outlook reads. */
export function firstElement(email: CheckedEmail, name: string): Located<Element> | undefined {
  return email.parsed.elements.find((element) => !element.mso && element.node.name === name)
}

/** The wrapper around the email's content: the `role="article"` element of email-kit's skeleton. */
export function wrapperOf(email: CheckedEmail): Located<Element> | undefined {
  return email.parsed.elements.find(
    (element) => !element.mso && element.node.attribs.role === "article",
  )
}

/** Where a CSS node starts in the email's HTML: its `<style>` block's offset plus its own. */
export function offsetIn(style: Located<Root>, node: CssNode): number {
  return style.offset + (node.source?.start?.offset ?? 0)
}

/** The declarations in `<style>` blocks, with their offsets in the HTML. */
export function* declarations(
  styles: readonly Located<Root>[],
): Generator<{ decl: Declaration; offset: number; mso: boolean }> {
  for (const style of styles) {
    const found: Declaration[] = []
    style.node.walkDecls((decl) => {
      found.push(decl)
    })
    for (const decl of found) yield { decl, offset: offsetIn(style, decl), mso: style.mso }
  }
}

/** The elements with a `style` attribute, each with its declarations as property → value. */
export function* inlineStyles(elements: readonly Located<Element>[]): Generator<{
  element: Element
  offset: number
  mso: boolean
  style: string
  /** The declarations, with properties lowercased. */
  props: Map<string, string>
}> {
  for (const { node, offset, mso } of elements) {
    const style = node.attribs.style
    if (style === undefined) continue
    const props = new Map<string, string>()
    for (const part of style.split(";")) {
      const colon = part.indexOf(":")
      if (colon > 0) {
        props.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim())
      }
    }
    yield { element: node, offset, mso, style, props }
  }
}

/** One CSS declaration, from a `<style>` block or a `style` attribute. */
export interface StyleDeclaration {
  readonly prop: string
  readonly value: string
  readonly offset: number
  /** Whether only classic Outlook reads it. */
  readonly mso: boolean
  /** The element whose `style` attribute it's in; `undefined` in a `<style>` block. */
  readonly element: Element | undefined
}

/** Every CSS declaration in the email: those in `<style>` blocks, then the inline ones. */
export function* allDeclarations(email: CheckedEmail): Generator<StyleDeclaration> {
  for (const { decl, offset, mso } of declarations(email.parsed.styles)) {
    yield { prop: decl.prop, value: decl.value, offset, mso, element: undefined }
  }
  for (const { element, offset, mso, props } of inlineStyles(email.parsed.elements)) {
    for (const [prop, value] of props) yield { prop, value, offset, mso, element }
  }
}

/** A declaration's property as messages name it: `` `color` ``, or `` <td> `color` `` inline. */
export function propertyName(declaration: StyleDeclaration): string {
  return `${elementPrefix(declaration)}\`${declaration.prop}\``
}

/** A declaration as messages show it: `` `color: red` ``, or `` <td> `color: red` `` inline. */
export function describe(declaration: StyleDeclaration): string {
  return `${elementPrefix(declaration)}\`${declaration.prop}: ${declaration.value}\``
}

function elementPrefix({ element }: StyleDeclaration): string {
  return element ? `<${element.name}> ` : ""
}

/** Whether a `style` attribute hides its element with `display: none`. */
export function isHidden(style: string | undefined): boolean {
  return /display\s*:\s*none/i.test(style ?? "")
}

/** The text with each run of whitespace made one space, and trimmed. */
export function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

/** The CSS colour names, such as `tan` and `rebeccapurple`. */
export const NAMED_COLOURS: ReadonlySet<string> = new Set(Object.keys(colorsNamed))

/** All the text inside an element, hidden text included. */
export function text(element: Element): string {
  let out = ""
  for (const child of element.children) {
    if (isText(child)) out += child.data
    else if (hasChildren(child)) out += text(child as Element)
  }
  return out
}

/** The section tags of an `<If>` or `<Each>`, such as `{{#x}}` and `{{/x}}`. */
const SECTION_TAG = /\{\{[#^/][^}]*\}\}/g

/**
 * Whether the element has visible text directly inside it: not whitespace, the `&nbsp;` of a
 * spacer cell, or section tags, which are structure.
 */
export function ownText(element: Element): boolean {
  return element.children.some(
    (child) => isText(child) && /\S/.test(child.data.replace(SECTION_TAG, "")),
  )
}

/** The elements that hold text, which the text-cell checks look at. */
export const TEXT_CELLS: ReadonlySet<string> = new Set([
  ...["p", "h1", "h2", "h3", "h4", "h5", "h6"],
  ...["li", "td", "th", "caption"],
])

/** The elements whose content a reader never sees. */
const UNSEEN = new Set(["head", "style", "script"])

/** The words a reader sees in the HTML body: not the head, styles, scripts or hidden elements. */
export function visibleText(email: CheckedEmail): string {
  const out: string[] = []
  const walk = (nodes: readonly ChildNode[]) => {
    for (const node of nodes) {
      if (isText(node)) out.push(node.data)
      else if (isTag(node) && !UNSEEN.has(node.name) && !isHidden(node.attribs.style)) {
        walk(node.children)
      }
    }
  }
  walk(email.parsed.document.children)
  return collapse(out.join(" "))
}

/** Every mustache tag, such as `{{name}}`, `{{{html}}}` or `{{#items}}`. */
const TAG = /\{\{[^}]*\}\}\}?/g

/** The text without its mustache tags. */
export function stripTags(text: string): string {
  return text.replace(TAG, "")
}

/** The text without its mustache tags, whitespace collapsed: the copy a template writes itself. */
export function withoutTags(text: string): string {
  return collapse(stripTags(text))
}

/** The invisible characters email-kit pads the hidden preheader with. */
export const PREHEADER_FILLER: RegExp = /[\u034f\u200c\u2007\ufeff]/

/**
 * Whether a render uses one of the project's own fixtures. Generated variants are oversized on
 * purpose, so the length checks skip them.
 */
export function ownFixture(email: CheckedEmail): boolean {
  return !email.fixture?.startsWith("generated ")
}

/** A placeholder in compiled HTML, with the schema field it names. */
export interface PlaceholderUse {
  /** The path as written: `orderUrl`, `item.name`, `.` or `_ek.context.siteUrl`. */
  readonly name: string
  /** The offset of `{{` in the HTML. */
  readonly offset: number
  /** `#` or `^` opens a section, `/` closes one, and `` is a value. */
  readonly sigil: "" | "#" | "^" | "/"
  /**
   * The schema field it names: `undefined` for values render() adds (`_ek.*`) and for `.` in an
   * untyped scope, `"none"` when it names no field.
   */
  readonly field: Field | undefined | "none"
}

/**
 * The placeholders in compiled HTML, with the fields they name. Sections are resolved as
 * mustache-core does: a name is looked up in the innermost scope that has it, and a section over a
 * list makes its items the scope.
 */
export function placeholders(html: string, model: Field): PlaceholderUse[] {
  const scopes: (Field | undefined)[] = [model]
  const out: PlaceholderUse[] = []
  const resolve = (name: string): Field | undefined | "none" => {
    if (name === ".") return scopes.at(-1)
    if (name === "_ek" || name.startsWith("_ek.")) return undefined
    const [first, ...rest] = name.split(".")
    for (let i = scopes.length - 1; i >= 0; i--) {
      let field = scopes[i]?.properties?.find((p) => p.name === first)?.field
      if (!field) continue
      for (const segment of rest) field = field?.properties?.find((p) => p.name === segment)?.field
      return field ?? "none"
    }
    return "none"
  }
  for (const match of html.matchAll(/\{\{\{?\s*([#^/]?)\s*([^}]+?)\s*\}?\}\}/g)) {
    const [, sigil = "", name = ""] = match
    const kind = sigil as PlaceholderUse["sigil"]
    if (kind === "/") {
      scopes.pop()
      out.push({ name, offset: match.index, sigil: kind, field: undefined })
      continue
    }
    const field = resolve(name)
    out.push({ name, offset: match.index, sigil: kind, field })
    if (kind === "#" || kind === "^") {
      const scope = field === "none" ? undefined : field
      scopes.push(
        scope?.type === "array" ? scope.items : scope?.type === "object" ? scope : undefined,
      )
    }
  }
  return out
}
