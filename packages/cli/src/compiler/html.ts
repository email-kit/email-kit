// IR → HTML, with placeholders left in (BLD-01). The document around it is document.ts.

import { EmailKitError, type IrAttr, type IrNode } from "@email-kit/core/internal"

import { placeholderTag, sectionTags } from "./tags.ts"

const VOID = new Set(["area", "br", "col", "hr", "img", "input", "meta", "source", "wbr"])
const BLOCK = new Set([
  ...["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li"],
  ...["table", "thead", "tbody", "tr", "td", "th"],
])

export function renderHtml(node: IrNode, scopes: readonly number[] = [0]): string {
  switch (node.kind) {
    case "text":
      return escapeText(node.value)
    case "placeholder":
      return placeholderTag(node, scopes)
    case "fragment":
      return node.children.map((child) => renderHtml(child, scopes)).join("")
    case "section": {
      const [open, close] = sectionTags(node, scopes)
      const inner = [...scopes, node.opens]
      return open + node.children.map((child) => renderHtml(child, inner)).join("") + close
    }
    case "conditional": {
      const inner = node.children.map((child) => renderHtml(child, scopes)).join("")
      // Word reads [if mso]; every other client hides it as a comment, and the reverse for notMso.
      if (node.when === "mso") return `<!--[if mso]>${inner}<![endif]-->`
      if (node.when === "notMso") return `<!--[if !mso]><!-->${inner}<!--<![endif]-->`
      return node.when === "htmlOnly" ? inner : ""
    }
    case "element": {
      const attrs = Object.entries(node.attrs)
        .map(([name, value]) => attribute(name, value, scopes))
        .join("")
      if (VOID.has(node.tag)) return `<${node.tag}${attrs}>`
      const children = node.children.map((child) => renderHtml(child, scopes)).join("")
      const end = BLOCK.has(node.tag) ? "\n" : ""
      return `<${node.tag}${attrs}>${children}</${node.tag}>${end}`
    }
  }
}

/** Text and placeholders (and sections around them) as an attribute value, such as aria-label. */
export function renderAttributeValue(node: IrNode, scopes: readonly number[] = [0]): string {
  switch (node.kind) {
    case "text":
      return escapeAttribute(node.value)
    case "placeholder":
      return placeholderTag(node, scopes)
    case "fragment":
      return node.children.map((child) => renderAttributeValue(child, scopes)).join("")
    case "section": {
      const [open, close] = sectionTags(node, scopes)
      const inner = [...scopes, node.opens]
      return (
        open + node.children.map((child) => renderAttributeValue(child, inner)).join("") + close
      )
    }
    case "conditional":
      return node.when === "textOnly" || node.when === "mso"
        ? ""
        : node.children.map((child) => renderAttributeValue(child, scopes)).join("")
    case "element":
      throw new EmailKitError(
        "invalid-attribute",
        `<${node.tag}> can't be used here: this value is text only (for example the subject)`,
      )
  }
}

function attribute(name: string, value: IrAttr, scopes: readonly number[]): string {
  if (value.length === 0) return ` ${name}`
  const parts = value.map((part) =>
    typeof part === "string" ? escapeAttribute(part) : placeholderTag(part, scopes),
  )
  return ` ${name}="${parts.join("")}"`
}

// "{" is written as an entity so static text can never form a tag with a placeholder next to it.
function escapeText(value: string): string {
  return value.replace(/[&<>{]/g, (char) => ENTITIES[char] as string)
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"{]/g, (char) => ENTITIES[char] as string)
}

const ENTITIES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "{": "&#123;",
}
