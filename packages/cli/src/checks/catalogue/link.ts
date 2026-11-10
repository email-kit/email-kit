// A.12 Links (`link.*`): what an `href` or `src` may hold (research 04, PRD C8).

import { attr } from "../parse.ts"
import type { Check } from "../types.ts"
import { eachEmail, placeholders } from "./util.ts"

/** Attributes that load or open a URL, VML's included. */
const URL_ATTRIBUTES = ["href", "src", "background", "action", "poster", "xlink:href"]

/** Image URLs: img.https checks the literal ones. */
const IMAGE = new Set(["src", "background", "poster"])

// Browsers ignore whitespace and control characters inside a scheme: "java\tscript:" still runs.
const DANGEROUS = /^(javascript|vbscript|data|file):/i
const scheme = (value: string) =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
  value.replace(/[\u0000-\u0020\u007f]/g, "")

export const LINK: readonly Check[] = [
  {
    id: "link.dangerous-schemes",
    level: "error",
    rule: "No `javascript:`, `vbscript:`, `data:` or `file:` URLs.",
    fix: "Link to an https:// page instead: clients strip these URLs or flag the email as phishing.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { node, offset } of email.parsed.elements) {
            for (const name of URL_ATTRIBUTES) {
              const value = attr(node, name)
              const match = value === undefined ? null : DANGEROUS.exec(scheme(value))
              if (match) problem(`<${node.name} ${name}> uses ${match[1]?.toLowerCase()}:`, offset)
            }
          }
        },
        report,
      ),
  },
  {
    id: "link.url-fields",
    level: "error",
    rule: "An `href` or `src` starts with a literal https:// (or mailto:/tel:) URL or a `url` field.",
    fix: "Mark the field with `url` in the schema (`z.string().meta(url)`): render() then accepts only https URLs.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const model = context.templates.find((t) => t.id === email.template)?.model
          const fields = new Map(
            (model ? placeholders(email.html, model) : []).map((p) => [p.offset, p]),
          )
          for (const { node, offset } of email.parsed.elements) {
            for (const name of URL_ATTRIBUTES) {
              const value = attr(node, name)
              if (value === undefined || DANGEROUS.test(scheme(value))) continue
              const start = value.trimStart()
              if (start.startsWith("{{")) {
                // The placeholder that opens the value, in the raw HTML of this tag.
                const at = email.html.indexOf(` ${name}="{{`, offset)
                const use = at < 0 ? undefined : fields.get(at + name.length + 3)
                // Sender values (`_ek.context.*`) come from the config, not from data.
                if (!use || use.name.startsWith("_ek.")) continue
                if (use.field === "none" || use.field?.url) continue
                problem(
                  `<${node.name} ${name}> starts with {{${use.name}}}, not a url field`,
                  offset,
                )
              } else if (!IMAGE.has(name) && !/^(https:\/\/|mailto:|tel:|#)/i.test(start)) {
                problem(`<${node.name} ${name}="${start.slice(0, 40)}"> isn't an https URL`, offset)
              }
            }
          }
        },
        report,
      ),
  },
]
