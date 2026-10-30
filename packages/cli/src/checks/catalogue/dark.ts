// A.6 Dark mode (`dark.*`): research 02 D2, D5–D7.

import type { AtRule, Rule } from "postcss"

import { attr } from "../parse.ts"
import type { Check, CheckedEmail } from "../types.ts"
import { eachEmail } from "./util.ts"

interface DarkCss {
  /** Rules inside @media (prefers-color-scheme: dark), with absolute offsets */
  media: { rule: Rule; offset: number }[]
  /** Rules for Outlook.com's [data-ogsc]/[data-ogsb] */
  outlook: { rule: Rule; offset: number }[]
  rootScheme: string | undefined
}

function darkCss(email: CheckedEmail): DarkCss {
  const found: DarkCss = { media: [], outlook: [], rootScheme: undefined }
  for (const style of email.parsed.styles) {
    if (style.mso) continue
    style.node.walkRules((rule) => {
      const offset = style.offset + (rule.source?.start?.offset ?? 0)
      const parent = rule.parent as AtRule | undefined
      if (parent?.type === "atrule" && /prefers-color-scheme\s*:\s*dark/.test(parent.params)) {
        found.media.push({ rule, offset })
      } else if (/\[data-og[sa][cb]\]/.test(rule.selector)) {
        found.outlook.push({ rule, offset })
      }
      if (rule.selector.trim() === ":root") {
        rule.walkDecls("color-scheme", (decl) => {
          found.rootScheme = decl.value
        })
      }
    })
  }
  return found
}

function metaScheme(email: CheckedEmail): string | undefined {
  const meta = email.parsed.elements.find(
    (e) => e.node.name === "meta" && attr(e.node, "name") === "color-scheme",
  )
  return meta ? attr(meta.node, "content") : undefined
}

export const DARK: readonly Check[] = [
  {
    id: "dark.scheme-declared",
    level: "error",
    rule: "Dark CSS is present if, and only if, the color-scheme meta and `:root { color-scheme }` are.",
    fix: "Apple Mail applies dark CSS only after both declarations; without dark CSS, declaring them turns unstyled text light.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const css = darkCss(email)
          const dark = css.media.length > 0 || css.outlook.length > 0
          const meta = metaScheme(email)
          const declared =
            (meta === "light dark" || meta === "light only") && css.rootScheme !== undefined
          if (dark && !declared) {
            const missing = [
              meta === "light dark" || meta === "light only"
                ? undefined
                : '<meta name="color-scheme" content="light dark">',
              css.rootScheme === undefined ? ":root { color-scheme: light dark }" : undefined,
            ].filter((part) => part !== undefined)
            problem(`The email has dark CSS but no ${missing.join(" and no ")}`)
          }
          if (!dark && (meta !== undefined || css.rootScheme !== undefined)) {
            problem(
              "The email declares color-scheme but has no dark CSS: unstyled text turns light on the client's dark ground",
            )
          }
        },
        report,
      ),
  },
  {
    id: "dark.ogsc-twin",
    level: "warn",
    rule: "Every `prefers-color-scheme` rule has a `[data-ogsc]`/`[data-ogsb]` descendant twin; no `.x[data-og*]`.",
    fix: "Outlook.com ignores the media query and matches attribute selectors only in descendant form, `[data-ogsc] .x`.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const css = darkCss(email)
          const twins = new Set(
            css.outlook.map(({ rule }) => rule.selector.replace(/^\[data-og[sa][cb]\]\s+/, "")),
          )
          for (const { rule, offset } of css.media) {
            if (!twins.has(rule.selector))
              problem(`\`${rule.selector}\` has no [data-ogsc]/[data-ogsb] twin`, offset)
          }
          for (const { rule, offset } of css.outlook) {
            if (/\S\[data-og/.test(rule.selector))
              problem(`\`${rule.selector}\` is a compound selector Outlook.com won't match`, offset)
          }
        },
        report,
      ),
  },
  {
    id: "dark.light-only-css-twin",
    level: "warn",
    rule: "A `light only` meta with a dark palette also has `:root { color-scheme: light dark }`.",
    fix: "Apple Mail lets the CSS override the meta, so the authored dark palette still applies there.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const css = darkCss(email)
          if (
            metaScheme(email) === "light only" &&
            css.media.length > 0 &&
            css.rootScheme !== "light dark"
          ) {
            problem('"light only" with dark CSS but no :root { color-scheme: light dark }')
          }
        },
        report,
      ),
  },
  {
    id: "dark.no-blend-hack",
    level: "warn",
    rule: "No `u + .body` blend-mode hack.",
    fix: "It breaks in current Gmail apps and inverts images; author a dark palette instead.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const style of email.parsed.styles) {
            style.node.walkRules((rule) => {
              if (/\bu\s*\+\s*\.body\b/.test(rule.selector)) {
                problem(`\`${rule.selector}\``, style.offset + (rule.source?.start?.offset ?? 0))
              }
            })
          }
        },
        report,
      ),
  },
]
