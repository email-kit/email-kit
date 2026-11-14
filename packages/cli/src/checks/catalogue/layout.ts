import type { Check } from "../types.ts"
import { eachEmail, inlineStyles } from "./util.ts"

/** The characters around a comment's text: `<!--` and `-->`. */
const COMMENT_DELIMITERS = "<!---->".length

/** The `layout.*` checks: the hybrid page container. */
export const LAYOUT: readonly Check[] = [
  {
    id: "layout.ghost-table",
    level: "error",
    rule: "Each `max-width` container sits inside an MSO ghost table of the same px width.",
    fix: 'Classic Outlook ignores max-width and stretches the content across the reading pane: wrap the container in `<!--[if mso]><table width="N">…<![endif]-->`, as email-kit\'s page shell does.',
    outlookClassic: true,
    /** The comment that ends right before the container must open a table of its width. */
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { element, offset, mso, props } of inlineStyles(email.parsed.elements)) {
          const width = /^(\d+)px$/.exec(props.get("max-width") ?? "")?.[1]
          if (mso || element.name !== "div" || !width) continue
          const comment = email.parsed.comments.findLast((c) => c.offset < offset)
          const end = comment ? comment.offset + comment.node.length + COMMENT_DELIMITERS : -1
          const ghost =
            comment &&
            !email.html.slice(end, offset).trim() &&
            /^\[if mso\]>[\s\S]*<table\b[^>]*\bwidth="(\d+)"/.exec(comment.node)?.[1]
          if (!ghost) problem(`A max-width:${width}px <div> has no MSO ghost table`, offset)
          else if (ghost !== width)
            problem(`A max-width:${width}px <div> sits in a ${ghost}px ghost table`, offset)
        }
      }),
  },
]
