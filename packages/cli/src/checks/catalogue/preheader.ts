import { isTag, isText } from "domhandler"

import { attr } from "../parse.ts"
import type { Check } from "../types.ts"
import {
  collapse,
  eachEmail,
  isHidden,
  ownFixture,
  PREHEADER_FILLER,
  text,
  wrapperOf,
} from "./util.ts"

/** Text that wastes the preview: "View this email in your browser", "Trouble viewing?". */
const BOILERPLATE =
  /view (this|it)( email)? (in|on) (your |a )?(web )?browser|trouble (viewing|reading)|can'?t see (this|the) (email|images)/i

/** The most characters inbox lists show of a preheader. */
const MAX_LENGTH = 90

/** The filler characters a preheader block needs to keep body text out of the preview. */
const MIN_FILLER = 50

/**
 * The `preheader.*` checks: the preview text after the subject comes first, is padded, and says
 * something of its own.
 */
export const PREHEADER: readonly Check[] = [
  {
    id: "preheader.first",
    level: "error",
    rule: "The first text in the wrapper is the hidden preheader.",
    fix: "Set the preheader in defineEmail(): clients preview the first text they find.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        if (!email.preheader) return
        const first = wrapperOf(email)?.node.children.find(
          (child) => isTag(child) || (isText(child) && child.data.trim()),
        )
        const hidden = first !== undefined && isTag(first) && isHidden(attr(first, "style"))
        if (!hidden || !text(first).startsWith(email.preheader)) {
          problem("The wrapper doesn't start with the hidden preheader")
        }
      }),
  },
  {
    id: "preheader.not-subject",
    level: "error",
    rule: "The preheader isn't the subject again.",
    fix: "Use the preheader to add something: the inbox shows both side by side.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const same = (a: string, b: string) =>
          collapse(a.toLowerCase()) === collapse(b.toLowerCase())
        if (email.preheader && same(email.preheader, email.subject)) {
          problem("The preheader repeats the subject")
        }
      }),
  },
  {
    id: "preheader.length",
    level: "warn",
    on: "render",
    rule: "The preheader has 1–90 visible characters.",
    fix: "Without one, clients preview the first body text; past about 90 characters it's cut.",
    run: (context, report) => {
      for (const email of context.emails.filter(ownFixture)) {
        const length = [...email.preheader].length
        if (length === 0) report({ message: "There's no preheader", email })
        else if (length > MAX_LENGTH) {
          report({ message: `The preheader is ${length} characters`, email })
        }
      }
    },
  },
  {
    id: "preheader.padding",
    level: "warn",
    rule: "The hidden preheader is padded with filler, so body text doesn't leak into the preview.",
    fix: "Keep email-kit's preheader block: the filler pushes the body text out of the preview.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        if (!email.preheader) return
        const block = email.parsed.elements.find(
          (e) =>
            !e.mso && attr(e.node, "aria-hidden") === "true" && isHidden(attr(e.node, "style")),
        )
        const filler = block
          ? [...text(block.node)].filter((c) => PREHEADER_FILLER.test(c)).length
          : 0
        if (filler < MIN_FILLER) {
          problem(`The preheader has ${filler} filler characters`, block?.offset)
        }
      }),
  },
  {
    id: "preheader.no-boilerplate",
    level: "error",
    rule: 'The preheader has no "view in browser" or "trouble viewing" text.',
    fix: "Say what the email is about: boilerplate wastes the preview and reads as spam.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        if (BOILERPLATE.test(email.preheader)) problem(`The preheader says "${email.preheader}"`)
      }),
  },
]
