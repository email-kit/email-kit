// IR → the HTML part, with placeholders left in (BLD-01). Prototype (P0-03): the real document
// skeleton, CSS pipeline and table shell arrive with P1-061 to P1-063.

import type { IrAttr, IrNode } from "@email-kit/core/internal"

import { placeholderTag, sectionTags } from "./tags.ts"

const VOID = new Set(["area", "br", "col", "hr", "img", "input", "meta", "source", "wbr"])
const BLOCK = new Set([
  ...["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li"],
  ...["table", "thead", "tbody", "tr", "td", "th"],
])

export interface HtmlDocument {
  readonly lang: string
  readonly dir: "ltr" | "rtl"
  readonly title: IrNode
  readonly preheader: IrNode | undefined
  readonly body: IrNode
}

export function renderDocument(doc: HtmlDocument): string {
  const preheader = doc.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${renderHtml(doc.preheader)}</div>\n`
    : ""
  return [
    "<!DOCTYPE html>",
    `<html lang="${doc.lang}" dir="${doc.dir}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${renderHtml(doc.title)}</title>`,
    "</head>",
    "<body>",
    `${preheader}${renderHtml(doc.body).trimEnd()}`,
    "</body>",
    "</html>",
    "",
  ].join("\n")
}

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
