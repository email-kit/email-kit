// A.4 Layout (`layout.*`): the hybrid page shell (research 01 §10).

import type { Check } from "../types.ts"
import { eachEmail, inlineStyles } from "./util.ts"

export const LAYOUT: readonly Check[] = [
  {
    id: "layout.ghost-table",
    level: "error",
    rule: "Each `max-width` container sits inside an MSO ghost table of the same px width.",
    fix: 'Classic Outlook ignores max-width and stretches the content across the reading pane: wrap the container in `<!--[if mso]><table width="N">…<![endif]-->`, as email-kit\'s page shell does.',
    outlookClassic: true,
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { element, offset, mso, props } of inlineStyles(email.parsed.elements)) {
            const width = /^(\d+)px$/.exec(props.get("max-width") ?? "")?.[1]
            if (mso || element.name !== "div" || !width) continue
            // The comment that ends right before the container must open a table of its width.
            const comment = email.parsed.comments.findLast((c) => c.offset < offset)
            const end = comment ? comment.offset + comment.node.length + 7 : -1
            const ghost =
              comment &&
              !email.html.slice(end, offset).trim() &&
              /^\[if mso\]>[\s\S]*<table\b[^>]*\bwidth="(\d+)"/.exec(comment.node)?.[1]
            if (!ghost) problem(`A max-width:${width}px <div> has no MSO ghost table`, offset)
            else if (ghost !== width)
              problem(`A max-width:${width}px <div> sits in a ${ghost}px ghost table`, offset)
          }
        },
        report,
      ),
  },
]
