import type { Element } from "domhandler"

import { attr } from "../parse.ts"
import { type Node, walk } from "../source.ts"
import type { Check } from "../types.ts"
import { eachEmail, firstElement, inlineStyles, ownText, TEXT_CELLS } from "./util.ts"

/** The currency symbols that mustn't be written next to a value. */
const CURRENCY = "$€£¥₹₩₽¢₺₦₱₫₪"

/** A currency symbol next to a message argument: `${amount}` or `{amount} €`. */
const SYMBOL_ARGUMENT = new RegExp(
  `[${CURRENCY}]\\s?\\{[A-Za-z_]\\w*\\}|\\{[A-Za-z_]\\w*\\}\\s?[${CURRENCY}]`,
)

/** A date built from three arguments: `{day}/{month}/{year}`. */
const DATE_PARTS = /\{[A-Za-z_]\w*\}\s*[/.-]\s*\{[A-Za-z_]\w*\}\s*[/.-]\s*\{[A-Za-z_]\w*\}/

/** JSX text that ends with a currency symbol, before a value: `$` in `${total}`. */
const SYMBOL_BEFORE = new RegExp(`[${CURRENCY}]\\s?$`)

/** JSX text that starts with a currency symbol, after a value: ` €` in `{total} €`. */
const SYMBOL_AFTER = new RegExp(`^\\s?[${CURRENCY}]`)

/**
 * The `i18n.*` checks: the pseudo-locales, values the caller formats, message hygiene, and
 * right-to-left text cells.
 */
export const I18N: readonly Check[] = [
  {
    id: "i18n.expansion",
    level: "error",
    rule: "Every template compiles in the pseudo-locales en-XA (accented, bracketed, longer by length) and ar-XB (right to left), and passes the static checks there.",
    fix: "Translations run up to three times longer and right to left: don't build copy from fragments, and don't let the layout depend on a string's length.",
    run: (context, report) => {
      for (const error of context.pseudoErrors) {
        report({
          message: `${error.template} doesn't compile in ${error.locale}: ${error.message}`,
          subject: { template: error.template, locale: error.locale },
        })
      }
    },
  },
  {
    id: "i18n.intl-format",
    level: "error",
    rule: "No currency symbols next to an argument, and no dates built from parts, in messages or templates.",
    fix: 'Format the value in the backend for the recipient\'s locale (Intl.NumberFormat with a currency, Intl.DateTimeFormat with a time zone) and pass it as a field marked formatted("money") or formatted("date").',
    run: (context, report) => {
      for (const entry of context.messages) {
        for (const [key, source] of Object.entries(entry.messages)) {
          const what = SYMBOL_ARGUMENT.test(source)
            ? "puts a currency symbol next to an argument"
            : DATE_PARTS.test(source)
              ? "builds a date from parts"
              : undefined
          if (what) {
            report({
              message: `"${key}" ${what}: ${source}`,
              subject: { template: entry.template, locale: entry.locale, file: entry.file },
            })
          }
        }
      }
      for (const source of context.sources) {
        for (const { node } of walk(source.program())) {
          if (node.type !== "JSXElement" && node.type !== "JSXFragment") continue
          const children = node.children as Node[]
          children.forEach((child, i) => {
            if (child.type !== "JSXText") return
            const text = String(child.value)
            const before =
              children[i + 1]?.type === "JSXExpressionContainer" && SYMBOL_BEFORE.test(text)
            const after =
              children[i - 1]?.type === "JSXExpressionContainer" && SYMBOL_AFTER.test(text)
            if (before || after) {
              report({
                message: `A currency symbol is written next to a value: "${text.trim()}"`,
                source,
                at: child.start,
              })
            }
          })
        }
      }
    },
  },
  {
    id: "i18n.unused-keys",
    level: "warn",
    rule: "Every message key is used by its template.",
    fix: "Delete the key from every locale, or use it. Translators spend time on every key.",
    run: (context, report) => {
      for (const entry of context.messages) {
        for (const key of Object.keys(entry.messages)) {
          if (!entry.used.has(key)) {
            report({
              message: `"${key}" isn't used by ${entry.template}`,
              subject: { template: entry.template, locale: entry.locale, file: entry.file },
            })
          }
        }
      }
    },
  },
  {
    id: "i18n.rtl-explicit",
    level: "error",
    rule: "In right-to-left emails, every text cell (p, h1–h6, li, td, th, caption) carries dir and an explicit alignment.",
    fix: 'Use email-kit\'s components, which do this, or add dir="rtl" and text-align to the element: Orange strips dir from tables and cells, and Outlook mishandles inherited direction.',
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const root = firstElement(email, "html")
        if (!root || attr(root.node, "dir") !== "rtl") return
        const aligned = new Set<Element>()
        for (const { element, props } of inlineStyles(email.parsed.elements)) {
          if (props.has("text-align")) aligned.add(element)
        }
        for (const { node, offset } of email.parsed.elements) {
          if (!TEXT_CELLS.has(node.name) || !ownText(node)) continue
          const missing = [
            ...(attr(node, "dir") ? [] : ["dir"]),
            ...(aligned.has(node) || attr(node, "align") ? [] : ["text-align"]),
          ]
          if (missing.length > 0)
            problem(`A <${node.name}> with text has no ${missing.join(" or ")}`, offset)
        }
      }),
  },
]
