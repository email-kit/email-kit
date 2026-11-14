import { EmailKitError, type IrElement, type IrNode } from "@email-kit/core/internal"

import { placeholderTag, sectionTags } from "./tags.ts"

/**
 * The plain-text part, from the same tree as the HTML: the preheader as its first line, then the
 * body, wrapped at 78 columns.
 */
export function renderTextPart(body: IrNode, preheader: string): string {
  const text = (preheader ? `${preheader}\n\n` : "") + renderText(body)
  return guard(`${wrap(text.replace(/\n{3,}/g, "\n\n").trim())}\n`)
}

/** A single line of text, such as the subject. */
export function renderLine(node: IrNode, what: string): string {
  const line = renderText(node).trim()
  if (line.includes("\n")) throw new EmailKitError("multi-line", `The ${what} must be one line`)
  return guard(line)
}

/**
 * Renders IR as plain text, with mustache-core tags where data goes. Headings are underlined,
 * links become `text: url`, and an image becomes its alt text, so both parts say the same thing.
 * Conditionals follow every client but classic Outlook, plus the `textOnly` branch. A section
 * around block content puts its tags on their own lines, which mustache-core removes. An ordered
 * list is numbered only when its items are all known at compile time: items repeated by `<Each>`
 * can't be counted in a template, so they keep the bullet.
 */
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
      return inner.endsWith("\n") ? `${open}\n${inner}${close}\n` : open + inner + close
    }
    case "conditional":
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

const WIDTH = 78

/**
 * Wraps each line over 78 characters at spaces, the width RFC 5322 recommends. List items keep
 * their indent. Lines with a URL stay whole, so the URL stays clickable, and so do lines with
 * sections, such as a plural or an `<If>`: their rendered width isn't known here, and a break
 * inside a branch would show up mid-sentence.
 */
function wrap(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (line.length <= WIDTH || /:\/\/|\{\{[#^/]|\{\{[^}]*\}\}\s*$/.test(line)) return line
      const indent = line.startsWith("- ") ? "  " : ""
      const lines: string[] = []
      let current = ""
      for (const word of line.split(" ")) {
        const next = current ? `${current} ${word}` : word
        if (next.length > WIDTH && current) {
          lines.push(current)
          current = `${indent}${word}`
        } else {
          current = next
        }
      }
      lines.push(current)
      return lines.join("\n")
    })
    .join("\n")
}

function join(children: readonly IrNode[], scopes: readonly number[]): string {
  return children.map((child) => renderText(child, scopes)).join("")
}

/** A line's width, counting each tag as its name: the real width is known only at send time. */
function width(line: string): number {
  return [...line.replace(/\{\{[#^/]?([^}]*)\}\}/g, "$1")].length
}

/** Rejects a literal `{` right before a tag, which would make `{{{`: text can't express it. */
function guard(text: string): string {
  if (text.includes("{{{")) {
    throw new EmailKitError(
      "literal-braces",
      'A "{" directly before a placeholder can\'t be expressed in the text part',
    )
  }
  return text
}
