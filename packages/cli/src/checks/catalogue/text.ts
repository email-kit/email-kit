// A.8 Text part (`text.*`), A.9 preheader (`preheader.*`) and subject (`subject.*`): the plain-text
// part says what the HTML says, and the envelope lines are short, honest and safe (research 01 §9,
// 04, 05 §5).

import type { Field } from "../../compiler/schema.ts"
import { attr } from "../parse.ts"
import type { Check, CheckedEmail } from "../types.ts"
import { eachEmail, text as textOf, visibleText, withoutTags } from "./util.ts"

/** Renders with the project's own fixtures: generated variants are oversized on purpose. */
const named = (email: CheckedEmail) => !email.fixture?.startsWith("generated ")

const FILLER = /[\u034f\u200c\u2007\ufeff]/
const BOILERPLATE =
  /view (this|it)( email)? (in|on) (your |a )?(web )?browser|trouble (viewing|reading)|can'?t see (this|the) (email|images)/i
const GENERIC = new Set([
  "update",
  "updates",
  "an update",
  "important",
  "important update",
  "notification",
  "information",
  "hello",
  "hi",
  "newsletter",
  "reminder",
  "message",
  "news",
  "your account",
  "account update",
  "no subject",
  "test",
])

function hrefs(email: CheckedEmail): string[] {
  return email.parsed.elements
    .filter((e) => !e.mso && e.node.name === "a")
    .map((e) => attr(e.node, "href") ?? "")
    .filter((href) => href && !href.startsWith("#"))
}

function secretPaths(field: Field, prefix = ""): string[] {
  return (field.properties ?? []).flatMap((p) => {
    const path = prefix ? `${prefix}.${p.name}` : p.name
    return [
      ...(p.field.secret ? [path] : []),
      ...(p.field.type === "object" ? secretPaths(p.field, path) : []),
    ]
  })
}

export const TEXT: readonly Check[] = [
  {
    id: "text.present",
    level: "error",
    rule: "The text part has at least 80 characters of its own copy.",
    fix: "Every email needs a real text part: spam filters score a missing or token one, and some readers only see it.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const length = withoutTags(email.text).length
          if (length < 80) problem(`The text part has ${length} characters of copy`)
        },
        report,
      ),
  },
  {
    id: "text.no-markup",
    level: "error",
    rule: "The text part has no HTML tags.",
    fix: "Text-part copy comes from the same messages as the HTML: remove markup from the message.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const tag = /<\/?[a-z][a-z0-9-]*(\s[^<>]*)?\/?>/i.exec(
            email.text.replace(/\{\{[^}]*\}\}\}?/g, ""),
          )
          if (tag) problem(`The text part has ${tag[0]}`)
        },
        report,
      ),
  },
  {
    id: "text.no-entities",
    level: "error",
    rule: "The text part has no HTML entities.",
    fix: "Write the character itself (é, ’, &): entities show up literally in plain text.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const entity = /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.exec(email.text)
          if (entity) problem(`The text part has ${entity[0]}`)
        },
        report,
      ),
  },
  {
    id: "text.wrap-78",
    level: "warn",
    rule: "Text-part lines are at most 78 characters, except lines with a URL.",
    fix: "Shorten the copy or split the paragraph: RFC 5322 recommends 78, and some clients wrap long lines badly.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const long = email.text
            .split("\n")
            .find((line) => line.length > 78 && !/:\/\/|\{\{/.test(line))
          if (long) problem(`A ${long.length}-character line: "${long.slice(0, 40)}…"`)
        },
        report,
      ),
  },
  {
    id: "text.urls-full",
    level: "error",
    rule: "Links are absolute URLs, so the text part can show them.",
    fix: "Use https:// URLs (or a url field): a relative link can't be followed from plain text, or from a forward.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const href of hrefs(email)) {
            if (!/^(https?:\/\/|mailto:|tel:|\{\{)/i.test(href))
              problem(`href="${href}" isn't absolute`)
          }
        },
        report,
      ),
  },
  {
    id: "text.links-match",
    level: "error",
    rule: "Every HTML link appears in the text part, and every URL in the text part is a link in the HTML.",
    fix: "Write links with Link or Button, which put them in both parts; don't paste URLs into copy.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const links = new Set(hrefs(email))
          for (const href of links)
            if (!email.text.includes(href)) problem(`${href} is in the HTML but not the text part`)
          for (const url of email.text.match(/https?:\/\/[^\s<>")]+/g) ?? []) {
            if (![...links].some((href) => href === url || href.startsWith(url)))
              problem(`${url} is in the text part but not linked in the HTML`)
          }
        },
        report,
      ),
  },
  {
    id: "text.parity",
    level: "warn",
    rule: "The text part carries the words of the HTML (at least 80% of them).",
    fix: "Spam filters compare the parts (MPART_ALT_DIFF): keep the same copy in both.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const words = (s: string) =>
            new Set(
              withoutTags(s)
                .toLowerCase()
                .match(/\p{L}{3,}/gu) ?? [],
            )
          const html = words(visibleText(email))
          const text = words(email.text)
          if (html.size === 0) return
          const shared = [...html].filter((w) => text.has(w)).length / html.size
          if (shared < 0.8)
            problem(`The text part has ${Math.round(shared * 100)}% of the HTML's words`)
        },
        report,
      ),
  },
  {
    id: "text.preheader-first",
    level: "warn",
    rule: "The text part starts with the preheader.",
    fix: "Keep email-kit's text part: clients preview the first line of text when there's no HTML.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          if (email.preheader && !email.text.startsWith(email.preheader))
            problem("The text part doesn't start with the preheader")
        },
        report,
      ),
  },
  {
    id: "text.no-preheader-padding",
    level: "error",
    rule: "The text part has none of the preheader's filler characters.",
    fix: "The filler pads the HTML preview only; in plain text it shows as junk.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          if (FILLER.test(email.text)) problem("The text part has preheader filler characters")
        },
        report,
      ),
  },
  {
    id: "text.no-decorative-runs",
    level: "warn",
    rule: "No long runs of =, -, * or _ beyond heading underlines.",
    fix: "Screen readers read every character: drop the decoration.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const lines = email.text.split("\n")
          lines.forEach((line, i) => {
            if (!/[=\-*_]{4,}/.test(line)) return
            const underline = /^[=-]+$/.test(line) && (lines[i - 1] ?? "").trim() !== ""
            if (!underline) problem(`A decorative run: "${line.trim().slice(0, 30)}"`)
          })
        },
        report,
      ),
  },
  {
    id: "preheader.first",
    level: "error",
    rule: "The first text in the wrapper is the hidden preheader.",
    fix: "Set the preheader in defineEmail(): clients preview the first text they find.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          if (!email.preheader) return
          const wrapper = email.parsed.elements.find(
            (e) => !e.mso && attr(e.node, "role") === "article",
          )
          const first = wrapper?.node.children.find(
            (c) => c.type === "tag" || (c.type === "text" && (c as { data: string }).data.trim()),
          )
          const hidden =
            first?.type === "tag" && /display\s*:\s*none/.test(attr(first as never, "style") ?? "")
          if (!hidden || !textOf(first as never).startsWith(email.preheader))
            problem("The wrapper doesn't start with the hidden preheader")
        },
        report,
      ),
  },
  {
    id: "preheader.not-subject",
    level: "error",
    rule: "The preheader isn't the subject again.",
    fix: "Use the preheader to add something: the inbox shows both side by side.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()
          if (email.preheader && norm(email.preheader) === norm(email.subject))
            problem("The preheader repeats the subject")
        },
        report,
      ),
  },
  {
    id: "preheader.length",
    level: "warn",
    on: "render",
    rule: "The preheader has 1–90 visible characters.",
    fix: "Without one, clients preview the first body text; past about 90 characters it's cut.",
    run: (context, report) => {
      for (const email of context.emails.filter(named)) {
        const length = [...email.preheader].length
        if (length === 0) report({ message: "There's no preheader", email })
        else if (length > 90) report({ message: `The preheader is ${length} characters`, email })
      }
    },
  },
  {
    id: "preheader.padding",
    level: "warn",
    rule: "The hidden preheader is padded with filler, so body text doesn't leak into the preview.",
    fix: "Keep email-kit's preheader block: the filler pushes the body text out of the preview.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          if (!email.preheader) return
          const block = email.parsed.elements.find(
            (e) =>
              !e.mso &&
              attr(e.node, "aria-hidden") === "true" &&
              /display\s*:\s*none/.test(attr(e.node, "style") ?? ""),
          )
          const filler = block ? [...textOf(block.node)].filter((c) => FILLER.test(c)).length : 0
          if (filler < 50) problem(`The preheader has ${filler} filler characters`, block?.offset)
        },
        report,
      ),
  },
  {
    id: "preheader.no-boilerplate",
    level: "error",
    rule: 'The preheader has no "view in browser" or "trouble viewing" text.',
    fix: "Say what the email is about: boilerplate wastes the preview and reads as spam.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          if (BOILERPLATE.test(email.preheader)) problem(`The preheader says "${email.preheader}"`)
        },
        report,
      ),
  },
  {
    id: "subject.length",
    level: "warn",
    on: "render",
    rule: "The subject is at most 60 characters.",
    fix: "Phones show about 30–40 characters: put the key words first and cut the rest.",
    run: (context, report) => {
      for (const email of context.emails.filter(named)) {
        const length = [...email.subject].length
        if (length > 60) report({ message: `The subject is ${length} characters`, email })
      }
    },
  },
  {
    id: "subject.no-fake-reply",
    level: "error",
    rule: "The subject doesn't start with Re: or Fwd:.",
    fix: "A fake reply prefix is deceptive and a spam signal: describe the email instead.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          if (/^\s*(re|fw|fwd|aw|wg|sv|vs|tr)\s*:/i.test(email.subject))
            problem(`The subject starts "${email.subject.slice(0, 10)}"`)
        },
        report,
      ),
  },
  {
    id: "subject.no-secret",
    level: "error",
    rule: "No secret field (a code or token) in the subject or the preheader.",
    fix: "Subjects show on lock screens and in provider logs: put the code in the body only (research 04 §5.1).",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const model = context.templates.find((t) => t.id === email.template)?.model
          if (!model) return
          const secrets = new Set(secretPaths(model))
          for (const [part, value] of [
            ["subject", email.subject],
            ["preheader", email.preheader],
          ] as const) {
            for (const match of value.matchAll(/\{\{\{?\s*([\w.]+)\s*\}?\}\}/g)) {
              if (secrets.has(match[1] as string))
                problem(`The ${part} shows the secret field ${match[1]}`)
            }
          }
        },
        report,
      ),
  },
  {
    id: "subject.generic",
    level: "warn",
    rule: 'The subject isn\'t generic ("Update", "Notification", "Important").',
    fix: "Say what happened: generic subjects get ignored and look like spam.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const plain = withoutTags(email.subject)
            .toLowerCase()
            .replace(/[^\p{L}\s]/gu, "")
            .trim()
          if (GENERIC.has(plain)) problem(`The subject is "${email.subject}"`)
        },
        report,
      ),
  },
]
