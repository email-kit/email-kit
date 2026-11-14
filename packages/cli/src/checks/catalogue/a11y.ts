import { type Element, isTag, isText } from "domhandler"

import { attr } from "../parse.ts"
import type { Check, CheckedEmail } from "../types.ts"
import { collapse, declarations, eachEmail, inlineStyles, text } from "./util.ts"

/** The elements of a table itself, not those inside a table nested in it. */
function own(table: Element): Element[] {
  const out: Element[] = []
  const walk = (node: Element) => {
    for (const child of node.children.filter(isTag)) {
      out.push(child)
      if (child.name !== "table") walk(child)
    }
  }
  walk(table)
  return out
}

/**
 * Link text that says nothing out of context, in each language. It's compared whole, ignoring
 * punctuation and case.
 */
const GENERIC_LINK_TEXT: Readonly<Record<string, readonly string[]>> = {
  en: ["click here", "here", "click", "more", "read more", "learn more", "link", "this link", "go"],
  de: ["hier", "hier klicken", "klicken", "mehr", "weiterlesen", "mehr erfahren", "link"],
  fr: ["ici", "cliquez ici", "plus", "en savoir plus", "lire la suite", "lien"],
  es: ["aquí", "haga clic aquí", "haz clic aquí", "más", "leer más", "más información", "enlace"],
}

/** What a screen reader announces for a link: aria-label, else its text and image alts. */
function linkName(link: Element): string {
  const label = attr(link, "aria-label")
  if (label !== undefined) return label.trim()
  const alts: string[] = []
  const walk = (node: Element) => {
    for (const child of node.children.filter(isTag)) {
      if (child.name === "img") alts.push(attr(child, "alt") ?? "")
      walk(child)
    }
  }
  walk(link)
  return collapse(`${text(link)} ${alts.join(" ")}`)
}

/** Whether a table says it's for layout, with `role="presentation"` or `role="none"`. */
const isPresentation = (table: Element) =>
  ["presentation", "none"].includes(attr(table, "role") ?? "")

/** Whether a table holds data: it has header cells or a caption. */
const isDataTable = (table: Element) =>
  own(table).some((e) => e.name === "th" || e.name === "caption")

/** The `scope` values a header cell can have. */
const SCOPES = ["col", "row", "colgroup", "rowgroup"]

/** The `a11y.*` checks: headings, links, type size, zoom and tables. */
export const A11Y: readonly Check[] = [
  {
    id: "a11y.layout-table-role",
    level: "error",
    rule: 'Layout tables have `role="presentation"` and no `th`, `caption`, `summary` or `scope`.',
    fix: 'Add role="presentation" to tables used for layout; otherwise screen readers announce rows and columns.',
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of email.parsed.elements) {
          if (node.name !== "table") continue
          if (isPresentation(node)) {
            const conflict = own(node).find(
              (e) => e.name === "th" || e.name === "caption" || attr(e, "scope"),
            )
            if (conflict || attr(node, "summary") !== undefined) {
              problem(
                `A presentation table has ${conflict ? `<${conflict.name}>` : "summary"}: use a data table or drop it`,
                offset,
              )
            }
          } else if (!isDataTable(node)) {
            problem('A layout table has no role="presentation"', offset)
          }
        }
      }),
  },
  {
    id: "a11y.data-table",
    level: "error",
    rule: "Data tables have `th scope`, a caption or a heading before them, at least 2 × 2 cells, and no presentation role.",
    fix: "Use DataTable, which writes all of these.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of email.parsed.elements) {
          if (node.name !== "table" || isPresentation(node) || !isDataTable(node)) continue
          const cells = own(node)
          const headers = cells.filter((e) => e.name === "th")
          if (headers.some((th) => !SCOPES.includes(attr(th, "scope") ?? ""))) {
            problem("A data table has a <th> without scope", offset)
          }
          let previous = node.prev
          while (previous && isText(previous) && !previous.data.trim()) previous = previous.prev
          const heading = previous && isTag(previous) && /^h[1-6]$/.test(previous.name)
          if (!cells.some((e) => e.name === "caption") && !heading) {
            problem("A data table has no <caption> and no heading right before it", offset)
          }
          const rows = cells.filter((e) => e.name === "tr")
          const columns = Math.max(0, ...rows.map((tr) => tr.children.filter(isTag).length))
          if (rows.length < 2 || columns < 2) {
            problem(
              `A data table is ${rows.length} × ${columns}; NVDA in classic Outlook treats it as layout`,
              offset,
            )
          }
        }
      }),
  },
  {
    id: "a11y.one-h1",
    level: "error",
    rule: "Exactly one `h1` (a warning when there is none).",
    fix: "Start the email with one Heading (level 1): screen reader users jump to it, and a second one splits the email in two.",
    run: (context, report) => {
      for (const email of context.emails) {
        const h1s = email.parsed.elements.filter((e) => !e.mso && e.node.name === "h1")
        if (h1s.length === 0)
          report({ email, level: "warn", message: "No <h1>: the email has no main heading" })
        for (const extra of h1s.slice(1))
          report({ email, at: extra.offset, message: `${h1s.length} <h1> elements; keep one` })
      }
    },
  },
  {
    id: "a11y.link-text",
    level: "error",
    rule: 'No empty links (error) and no generic link text such as "click here" (warning).',
    fix: 'Say where the link goes ("View your order"): screen reader users list links out of context.',
    run: (context, report) => {
      for (const email of context.emails) {
        const generic = new Set(GENERIC_LINK_TEXT[email.locale.split("-")[0] as string] ?? [])
        for (const { node, offset, mso } of email.parsed.elements) {
          if (mso || node.name !== "a" || attr(node, "href") === undefined) continue
          const name = linkName(node)
          if (!name) {
            report({ email, at: offset, message: "A link with no text, alt or aria-label" })
            continue
          }
          const words = name.toLowerCase().replace(/[\s.!?:…»›→>]+$/u, "")
          if (generic.has(words))
            report({ email, at: offset, level: "warn", message: `Generic link text "${name}"` })
        }
      }
    },
  },
  {
    id: "a11y.font-size",
    level: "error",
    rule: "Text is at least 12 px (error), and 14 px or more (warning below).",
    fix: "Use a type step from the theme: body is 16 px and the smallest step 14 px.",
    /** Sizes of 0 and 1px are the spacer-cell technique, not text. */
    run: (context, report) => {
      const check = (email: CheckedEmail, value: string, at: number, where: string) => {
        const px = /^(\d+(?:\.\d+)?)px$/.exec(value.replace(/\s*!important$/, ""))?.[1]
        const size = px === undefined ? undefined : Number(px)
        if (size === undefined || size <= 1 || size >= 14) return
        report({
          email,
          at,
          ...(size >= 12 && { level: "warn" as const }),
          message: `${where} font-size: ${size}px`,
        })
      }
      for (const email of context.emails) {
        for (const { element, offset, mso, props } of inlineStyles(email.parsed.elements)) {
          const size = props.get("font-size")
          if (!mso && size) check(email, size, offset, `<${element.name}>`)
        }
        for (const { decl, offset, mso } of declarations(email.parsed.styles)) {
          if (!mso && decl.prop === "font-size")
            check(email, decl.value, offset, "A <style> rule's")
        }
      }
    },
  },
  {
    id: "a11y.viewport",
    level: "error",
    rule: "The viewport meta doesn't block zoom (`user-scalable=no` or `maximum-scale` below 2).",
    fix: "Use `width=device-width, initial-scale=1` only: people with low vision zoom to read.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of email.parsed.elements) {
          if (node.name !== "meta" || attr(node, "name")?.toLowerCase() !== "viewport") continue
          const content = (attr(node, "content") ?? "").toLowerCase()
          const scale = /maximum-scale\s*=\s*([\d.]+)/.exec(content)?.[1]
          if (/user-scalable\s*=\s*(no|0)\b/.test(content))
            problem("The viewport sets user-scalable=no", offset)
          else if (scale !== undefined && Number(scale) < 2)
            problem(`The viewport sets maximum-scale=${scale}`, offset)
        }
      }),
  },
]
