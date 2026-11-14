import { attr } from "../parse.ts"
import type { Check, CheckedEmail } from "../types.ts"
import {
  collapse,
  eachEmail,
  PREHEADER_FILLER,
  stripTags,
  visibleText,
  withoutTags,
} from "./util.ts"

/** The least copy a text part needs, in characters. */
const MIN_COPY = 80

/** The longest line RFC 5322 recommends. */
const MAX_LINE = 78

/** The share of the HTML's words the text part must carry. */
const MIN_PARITY = 0.8

/** The links in the HTML that a reader can follow: not Word-only, empty or `#` anchors. */
function hrefs(email: CheckedEmail): string[] {
  return email.parsed.elements
    .filter((e) => !e.mso && e.node.name === "a")
    .map((e) => attr(e.node, "href") ?? "")
    .filter((href) => href && !href.startsWith("#"))
}

/** The `text.*` checks: the plain-text part says what the HTML says, readably. */
export const TEXT: readonly Check[] = [
  {
    id: "text.present",
    level: "error",
    rule: "The text part has at least 80 characters of its own copy.",
    fix: "Every email needs a real text part: spam filters score a missing or token one, and some readers only see it.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const length = withoutTags(email.text).length
        if (length < MIN_COPY) problem(`The text part has ${length} characters of copy`)
      }),
  },
  {
    id: "text.no-markup",
    level: "error",
    rule: "The text part has no HTML tags.",
    fix: "Text-part copy comes from the same messages as the HTML: remove markup from the message.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const tag = /<\/?[a-z][a-z0-9-]*(\s[^<>]*)?\/?>/i.exec(stripTags(email.text))
        if (tag) problem(`The text part has ${tag[0]}`)
      }),
  },
  {
    id: "text.no-entities",
    level: "error",
    rule: "The text part has no HTML entities.",
    fix: "Write the character itself (é, ’, &): entities show up literally in plain text.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const entity = /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.exec(email.text)
        if (entity) problem(`The text part has ${entity[0]}`)
      }),
  },
  {
    id: "text.wrap-78",
    level: "warn",
    rule: "Text-part lines are at most 78 characters, except lines with a URL.",
    fix: "Shorten the copy or split the paragraph: RFC 5322 recommends 78, and some clients wrap long lines badly.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const long = email.text
          .split("\n")
          .find((line) => line.length > MAX_LINE && !/:\/\/|\{\{/.test(line))
        if (long) problem(`A ${long.length}-character line: "${long.slice(0, 40)}…"`)
      }),
  },
  {
    id: "text.urls-full",
    level: "error",
    rule: "Links are absolute URLs, so the text part can show them.",
    fix: "Use https:// URLs (or a url field): a relative link can't be followed from plain text, or from a forward.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const href of hrefs(email)) {
          if (!/^(https?:\/\/|mailto:|tel:|\{\{)/i.test(href))
            problem(`href="${href}" isn't absolute`)
        }
      }),
  },
  {
    id: "text.links-match",
    level: "error",
    rule: "Every HTML link appears in the text part, and every URL in the text part is a link in the HTML.",
    fix: "Write links with Link or Button, which put them in both parts; don't paste URLs into copy.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const links = new Set(hrefs(email))
        for (const href of links) {
          if (!email.text.includes(href)) problem(`${href} is in the HTML but not the text part`)
        }
        for (const url of email.text.match(/https?:\/\/[^\s<>")]+/g) ?? []) {
          if (![...links].some((href) => href === url || href.startsWith(url))) {
            problem(`${url} is in the text part but not linked in the HTML`)
          }
        }
      }),
  },
  {
    id: "text.parity",
    level: "warn",
    rule: "The text part carries the words of the HTML (at least 80% of them).",
    fix: "Spam filters compare the parts (MPART_ALT_DIFF): keep the same copy in both.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const words = (s: string) =>
          new Set(
            withoutTags(s)
              .toLowerCase()
              .match(/\p{L}{3,}/gu) ?? [],
          )
        const html = words(visibleText(email))
        const text = words(email.text)
        if (html.size === 0) return
        const shared = [...html].filter((word) => text.has(word)).length / html.size
        if (shared < MIN_PARITY) {
          problem(`The text part has ${Math.round(shared * 100)}% of the HTML's words`)
        }
      }),
  },
  {
    id: "text.preheader-first",
    level: "warn",
    rule: "The text part starts with the preheader.",
    fix: "Keep email-kit's text part: clients preview the first line of text when there's no HTML.",
    /** A preheader over 78 columns wraps in the text part, so only the words are compared. */
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        if (email.preheader && !collapse(email.text).startsWith(collapse(email.preheader))) {
          problem("The text part doesn't start with the preheader")
        }
      }),
  },
  {
    id: "text.no-preheader-padding",
    level: "error",
    rule: "The text part has none of the preheader's filler characters.",
    fix: "The filler pads the HTML preview only; in plain text it shows as junk.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        if (PREHEADER_FILLER.test(email.text)) {
          problem("The text part has preheader filler characters")
        }
      }),
  },
  {
    id: "text.no-decorative-runs",
    level: "warn",
    rule: "No long runs of =, -, * or _ beyond heading underlines.",
    fix: "Screen readers read every character: drop the decoration.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const lines = email.text.split("\n")
        lines.forEach((line, i) => {
          if (!/[=\-*_]{4,}/.test(line)) return
          const underline = /^[=-]+$/.test(line) && (lines[i - 1] ?? "").trim() !== ""
          if (!underline) problem(`A decorative run: "${line.trim().slice(0, 30)}"`)
        })
      }),
  },
]
