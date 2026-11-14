import {
  EmailKitError,
  type IrAttr,
  type IrConditional,
  type IrElement,
  type IrNode,
} from "@email-kit/core/internal"

import { placeholderTag, sectionTags } from "./tags.ts"

/** Elements without content or a closing tag, such as `<img>`. */
const VOID = new Set(["area", "br", "col", "hr", "img", "input", "meta", "source", "wbr"])

/**
 * Elements followed by a line break, which keeps lines short (email allows at most 998 bytes a
 * line) and the compiled HTML readable in diffs. Between block elements the break isn't shown.
 */
const BLOCK = new Set([
  ...["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li"],
  ...["table", "thead", "tbody", "tr", "td", "th"],
])

/** Where the output goes: into the HTML, or inside a double-quoted attribute. */
type Mode = "html" | "attribute"

/**
 * Renders IR as HTML, with mustache-core tags where data goes. `scopes` lists the contexts the open
 * sections pushed, innermost last. Conditional nodes become Outlook conditional comments: only
 * classic Outlook reads `mso` content, and it alone skips `notMso` content. `renderDocument()`
 * adds the document around the body.
 */
export function renderHtml(node: IrNode, scopes: readonly number[] = [0]): string {
  return render(node, scopes, "html")
}

/**
 * Text and placeholders, and sections around them, as an attribute value, such as `aria-label`.
 * Elements aren't allowed. An attribute can't hold a conditional comment, so content for classic
 * Outlook alone is left out, and content for every other client is kept.
 */
export function renderAttributeValue(node: IrNode, scopes: readonly number[] = [0]): string {
  return render(node, scopes, "attribute")
}

function render(node: IrNode, scopes: readonly number[], mode: Mode): string {
  const children = (nodes: readonly IrNode[], inner = scopes) =>
    nodes.map((child) => render(child, inner, mode)).join("")
  switch (node.kind) {
    case "text":
      return escapeHtml(node.value, mode)
    case "placeholder":
      return placeholderTag(node, scopes)
    case "fragment":
      return children(node.children)
    case "section": {
      const [open, close] = sectionTags(node, scopes)
      return open + children(node.children, [...scopes, node.opens]) + close
    }
    case "conditional":
      return conditional(node, mode, () => children(node.children))
    case "element":
      if (mode === "attribute") {
        throw new EmailKitError(
          "invalid-attribute",
          `<${node.tag}> can't be used here: this value is text only (for example the subject)`,
        )
      }
      return element(node, scopes, children(node.children))
  }
}

/**
 * Content for some renderers only. `textOnly` content belongs to the plain-text part, and in an
 * attribute `mso` content is left out too. Its children are only rendered when they're shown.
 */
function conditional(node: IrConditional, mode: Mode, inner: () => string): string {
  if (node.when === "textOnly" || (mode === "attribute" && node.when === "mso")) return ""
  if (mode === "attribute" || node.when === "htmlOnly") return inner()
  return node.when === "mso"
    ? `<!--[if mso]>${inner()}<![endif]-->`
    : `<!--[if !mso]><!-->${inner()}<!--<![endif]-->`
}

/** An element with its attributes and rendered children. */
function element(node: IrElement, scopes: readonly number[], children: string): string {
  const attrs = Object.entries(node.attrs)
    .map(([name, value]) => attribute(name, value, scopes))
    .join("")
  if (VOID.has(node.tag)) return `<${node.tag}${attrs}>`
  return `<${node.tag}${attrs}>${children}</${node.tag}>${BLOCK.has(node.tag) ? "\n" : ""}`
}

/**
 * One attribute: ` name="value"`, where the value mixes text and placeholders. An empty value is
 * a boolean attribute, written as just ` name`.
 */
function attribute(name: string, value: IrAttr, scopes: readonly number[]): string {
  if (value.length === 0) return ` ${name}`
  const parts = value.map((part) =>
    typeof part === "string" ? escapeHtml(part, "attribute") : placeholderTag(part, scopes),
  )
  return ` ${name}="${parts.join("")}"`
}

const ENTITIES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "{": "&#123;",
}

/**
 * Escapes text for HTML, and `"` too inside an attribute. `{` becomes an entity as well, so text
 * next to a placeholder can never form a mustache tag.
 */
function escapeHtml(value: string, mode: Mode): string {
  const special = mode === "attribute" ? /[&<>"{]/g : /[&<>{]/g
  return value.replace(special, (char) => ENTITIES[char] as string)
}
