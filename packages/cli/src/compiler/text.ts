// IR → the plain-text part, from the same tree as the HTML (TXT-01). Prototype (P0-03): wrapping
// at 78 columns, tables as `Label: value` and per-component text renderers arrive with P1-080+.

import { EmailKitError, type IrElement, type IrNode } from "@email-kit/core/internal"

import { placeholderTag, sectionTags } from "./tags.ts"

/** The text part: the preheader as its first line, then the body (BLD-07). */
export function renderTextPart(body: IrNode, preheader: string): string {
  const text = (preheader ? `${preheader}\n\n` : "") + renderText(body)
  return guard(`${text.replace(/\n{3,}/g, "\n\n").trim()}\n`)
}

/** A single line of text, such as the subject. */
export function renderLine(node: IrNode, what: string): string {
  const line = renderText(node).trim()
  if (line.includes("\n")) throw new EmailKitError("multi-line", `The ${what} must be one line`)
  return guard(line)
}

function renderText(node: IrNode, scopes: readonly number[] = [0]): string {
  switch (node.kind) {
    case "text":
      if (node.value.includes("{{")) {
        throw new EmailKitError(
          "literal-braces",
          `The text "${node.value}" contains "{{", which the text part can't express`,
        )
      }
      return node.value
    case "placeholder":
      return placeholderTag(node, scopes)
    case "fragment":
      return join(node.children, scopes)
    case "section": {
      const [open, close] = sectionTags(node, scopes)
      const inner = join(node.children, [...scopes, node.opens])
      // Block content puts the tags on their own lines; mustache-core removes such lines.
      return inner.endsWith("\n") ? `${open}\n${inner}${close}\n` : open + inner + close
    }
    case "conditional":
      // The text part follows every client but Outlook's Word engine, and has its own branch.
      return node.when === "notMso" || node.when === "textOnly" ? join(node.children, scopes) : ""
    case "element":
      return element(node, scopes)
  }
}

function element(node: IrElement, scopes: readonly number[]): string {
  const inner = join(node.children, scopes)
  const tag = node.tag
  switch (tag) {
    case "h1":
    case "h2": {
      const line = inner.trim()
      return `${line}\n${(tag === "h1" ? "=" : "-").repeat(width(line))}\n\n`
    }
    case "li":
      return `- ${inner.trim()}\n`
    case "ol": {
      // Number the items when they're all known at compile time; repeated items (<Each>) can't
      // be counted in a template, so those keep the bullet.
      const items = node.children.filter((child) => !(child.kind === "text" && !child.value.trim()))
      if (
        items.length === 0 ||
        !items.every((child) => child.kind === "element" && child.tag === "li")
      ) {
        return `${inner}\n`
      }
      return `${items.map((item, i) => `${i + 1}. ${renderText(item, scopes).slice(2)}`).join("")}\n`
    }
    case "ul":
      return `${inner}\n`
    case "br":
      return "\n"
    case "a": {
      const href = node.attrs.href
      if (!href) return inner
      const url = href.map((part) =>
        typeof part === "string" ? part : placeholderTag(part, scopes),
      )
      return `${inner.trim()}: ${url.join("")}`
    }
    case "img":
      // The alt carries what the image says, so the parts stay equivalent; decorative is "".
      return (node.attrs.alt ?? [])
        .map((part) => (typeof part === "string" ? part : placeholderTag(part, scopes)))
        .join("")
    case "p":
    case "div":
    case "td":
    case "th":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return inner.endsWith("\n") ? inner : `${inner.trim()}\n\n`
    default:
      return inner
  }
}

function join(children: readonly IrNode[], scopes: readonly number[]): string {
  return children.map((child) => renderText(child, scopes)).join("")
}

// Placeholders count as their name; the real width is only known at send time.
function width(line: string): number {
  return [...line.replace(/\{\{[#^/]?([^}]*)\}\}/g, "$1")].length
}

// A literal "{" right before a tag would turn it into "{{{": not expressible in the text part.
function guard(text: string): string {
  if (text.includes("{{{")) {
    throw new EmailKitError(
      "literal-braces",
      'A "{" directly before a placeholder can\'t be expressed in the text part',
    )
  }
  return text
}
