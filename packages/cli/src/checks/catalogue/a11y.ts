// A.7 Accessibility (`a11y.*`): tables (research 02 A5, A6, A23).

import type { Element } from "domhandler"

import { attr } from "../parse.ts"
import type { Check } from "../types.ts"
import { eachEmail } from "./util.ts"

/** Elements of this table itself: not inside a nested table. */
function own(table: Element): Element[] {
  const out: Element[] = []
  const walk = (node: Element) => {
    for (const child of node.children) {
      if (child.type !== "tag") continue
      const element = child as Element
      out.push(element)
      if (element.name !== "table") walk(element)
    }
  }
  walk(table)
  return out
}

const isPresentation = (table: Element) =>
  ["presentation", "none"].includes(attr(table, "role") ?? "")
const isData = (table: Element) => own(table).some((e) => e.name === "th" || e.name === "caption")

export const A11Y: readonly Check[] = [
  {
    id: "a11y.layout-table-role",
    level: "error",
    rule: 'Layout tables have `role="presentation"` and no `th`, `caption`, `summary` or `scope`.',
    fix: 'Add role="presentation" to tables used for layout; otherwise screen readers announce rows and columns.',
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
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
            } else if (!isData(node)) {
              problem('A layout table has no role="presentation"', offset)
            }
          }
        },
        report,
      ),
  },
  {
    id: "a11y.data-table",
    level: "error",
    rule: "Data tables have `th scope`, a caption or a heading before them, at least 2 × 2 cells, and no presentation role.",
    fix: "Use DataTable, which writes all of these.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { node, offset } of email.parsed.elements) {
            if (node.name !== "table" || isPresentation(node) || !isData(node)) continue
            const cells = own(node)
            const headers = cells.filter((e) => e.name === "th")
            if (
              headers.some(
                (th) => !["col", "row", "colgroup", "rowgroup"].includes(attr(th, "scope") ?? ""),
              )
            ) {
              problem("A data table has a <th> without scope", offset)
            }
            let previous = node.prev
            while (
              previous &&
              previous.type === "text" &&
              !(previous as unknown as { data: string }).data.trim()
            ) {
              previous = previous.prev
            }
            const heading = previous?.type === "tag" && /^h[1-6]$/.test((previous as Element).name)
            if (!cells.some((e) => e.name === "caption") && !heading) {
              problem("A data table has no <caption> and no heading right before it", offset)
            }
            const rows = cells.filter((e) => e.name === "tr")
            const columns = Math.max(
              0,
              ...rows.map((tr) => tr.children.filter((c) => c.type === "tag").length),
            )
            if (rows.length < 2 || columns < 2) {
              problem(
                `A data table is ${rows.length} × ${columns}; NVDA in classic Outlook treats it as layout`,
                offset,
              )
            }
          }
        },
        report,
      ),
  },
]
