import { attr } from "../parse.ts"
import type { Check } from "../types.ts"
import { eachEmail, placeholders, templateOf } from "./util.ts"

/** Attributes that load or open a URL, VML's included. */
const URL_ATTRIBUTES = ["href", "src", "background", "action", "poster", "xlink:href"]

/** Image URLs: img.https checks the literal ones. */
const IMAGE = new Set(["src", "background", "poster"])

/**
 * Schemes that run code or reach outside the email. Browsers ignore whitespace and control
 * characters inside a scheme, so `java\tscript:` still runs, and `scheme()` removes them first.
 */
const DANGEROUS = /^(javascript|vbscript|data|file):/i

/** The URL without whitespace and control characters, as browsers read its scheme. */
const scheme = (value: string) =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
  value.replace(/[\u0000-\u0020\u007f]/g, "")

/** The `link.*` checks: what an `href` or `src` may hold. */
export const LINK: readonly Check[] = [
  {
    id: "link.dangerous-schemes",
    level: "error",
    rule: "No `javascript:`, `vbscript:`, `data:` or `file:` URLs.",
    fix: "Link to an https:// page instead: clients strip these URLs or flag the email as phishing.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of email.parsed.elements) {
          for (const name of URL_ATTRIBUTES) {
            const value = attr(node, name)
            const match = value === undefined ? null : DANGEROUS.exec(scheme(value))
            if (match) problem(`<${node.name} ${name}> uses ${match[1]?.toLowerCase()}:`, offset)
          }
        }
      }),
  },
  {
    id: "link.url-fields",
    level: "error",
    rule: "An `href` or `src` starts with a literal https:// (or mailto:/tel:) URL or a `url` field.",
    fix: "Mark the field with `url` in the schema (`z.string().meta(url)`): render() then accepts only https URLs.",
    /**
     * A value that starts with a placeholder must start with a url field. Sender values
     * (`_ek.context.*`) come from the config, not from data, so they pass.
     */
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const model = templateOf(context, email)?.model
        const fields = new Map(
          (model ? placeholders(email.html, model) : []).map((p) => [p.offset, p]),
        )
        for (const { node, offset } of email.parsed.elements) {
          for (const name of URL_ATTRIBUTES) {
            const value = attr(node, name)
            if (value === undefined || DANGEROUS.test(scheme(value))) continue
            const start = value.trimStart()
            if (start.startsWith("{{")) {
              const at = email.html.indexOf(` ${name}="{{`, offset)
              const use = at < 0 ? undefined : fields.get(at + name.length + 3)
              if (!use || use.name.startsWith("_ek.")) continue
              if (use.field === "none" || use.field?.url) continue
              problem(`<${node.name} ${name}> starts with {{${use.name}}}, not a url field`, offset)
            } else if (!IMAGE.has(name) && !/^(https:\/\/|mailto:|tel:|#)/i.test(start)) {
              problem(`<${node.name} ${name}="${start.slice(0, 40)}"> isn't an https URL`, offset)
            }
          }
        }
      }),
  },
]
