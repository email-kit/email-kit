// A.4 CSS (`css.*`): CSS strict clients accept (research 01 §3, §5).

import { colorsNamed } from "culori"

import { isData } from "../parse.ts"
import type { Check } from "../types.ts"
import { declarations, eachEmail, inlineStyles, ownText, TEXT_CELLS } from "./util.ts"

const MODERN = /\b(oklch|oklab|lch|lab|color-mix|color|light-dark|hsl|hsla)\(/i
const SPACE_RGB = /\brgba?\(\s*[\d.]+%?\s+[\d.]/i
const STYLE_LIMIT = 16_384
const STYLE_WARN = 12 * 1024

export const CSS: readonly Check[] = [
  {
    id: "css.no-double-brace",
    level: "error",
    rule: "No `}}` in CSS.",
    fix: "Separate closing braces with a space or a newline: Outlook on the web and the Outlook apps drop all CSS after `}}`.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const style of email.parsed.styles) {
            const css = style.node.source?.input.css ?? ""
            for (let i = css.indexOf("}}"); i !== -1; i = css.indexOf("}}", i + 2)) {
              problem("`}}` in a <style> block", style.offset + i)
            }
          }
        },
        report,
      ),
  },
  {
    id: "css.important-lowercase",
    level: "error",
    rule: "`!important` is lowercase with a space before it, and never inline.",
    fix: "Write ` !important`; Gmail drops the whole <style> block for `!IMPORTANT`. Inline styles win without it.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { decl, offset } of declarations(email.parsed.styles)) {
            // postcss keeps raws.important only when it isn't exactly " !important".
            if (decl.important && decl.raws.important !== undefined) {
              problem(`\`${decl.prop}\` is marked "${decl.raws.important.trim()}"`, offset)
            }
          }
          for (const { element, offset, style } of inlineStyles(email.parsed.elements)) {
            if (/!\s*important/i.test(style))
              problem(`<${element.name}> has !important in its style attribute`, offset)
          }
        },
        report,
      ),
  },
  {
    id: "css.no-nesting",
    level: "error",
    rule: "No nested rules, and no at-rule inside an at-rule.",
    fix: "Flatten the CSS: Gmail drops the block, Yahoo applies nested properties to the parent.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const style of email.parsed.styles) {
            style.node.walk((node) => {
              const parent = node.parent
              const nested =
                (node.type === "rule" && parent?.type === "rule") ||
                (node.type === "atrule" && parent?.type === "atrule")
              if (nested) {
                problem(
                  `A nested ${node.type === "rule" ? "rule" : "at-rule"} in a <style> block`,
                  style.offset + (node.source?.start?.offset ?? 0),
                )
              }
            })
          }
        },
        report,
      ),
  },
  {
    id: "css.no-modern-colour",
    level: "error",
    rule: "No oklch(), oklab(), lch(), lab(), color-mix(), color(), light-dark() or hsl(), and no space-separated rgb().",
    fix: "Use #rrggbb: Gmail drops the whole <style> block for modern colour syntax. Theme colours are converted for you.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { decl, offset } of declarations(email.parsed.styles)) {
            if (MODERN.test(decl.value) || SPACE_RGB.test(decl.value))
              problem(`\`${decl.prop}: ${decl.value}\``, offset)
          }
          for (const { element, offset, props } of inlineStyles(email.parsed.elements)) {
            for (const [prop, value] of props) {
              if (MODERN.test(value) || SPACE_RGB.test(value))
                problem(`<${element.name}> \`${prop}: ${value}\``, offset)
            }
          }
        },
        report,
      ),
  },
  {
    id: "css.no-custom-props",
    level: "error",
    rule: "No custom properties (`--x:`) or `var()`.",
    fix: "Most clients don't support them; email-kit writes resolved values from the theme.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { decl, offset } of declarations(email.parsed.styles)) {
            if (decl.prop.startsWith("--") || /\bvar\(/.test(decl.value))
              problem(`\`${decl.prop}: ${decl.value}\``, offset)
          }
          for (const { element, offset, props } of inlineStyles(email.parsed.elements)) {
            for (const [prop, value] of props) {
              if (prop.startsWith("--") || /\bvar\(/.test(value))
                problem(`<${element.name}> \`${prop}: ${value}\``, offset)
            }
          }
        },
        report,
      ),
  },
  {
    id: "css.style-size",
    level: "error",
    rule: "All `<style>` blocks together stay under 16,384 bytes (a warning from 12 KB).",
    fix: "Gmail ignores styles past about 16 KB. Move rules inline or drop unused ones.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const bytes = email.parsed.styles
            .filter((s) => !s.mso)
            .reduce((sum, s) => sum + Buffer.byteLength(s.node.source?.input.css ?? "", "utf8"), 0)
          if (bytes >= STYLE_LIMIT) problem(`The <style> blocks total ${bytes} bytes`)
          else if (bytes >= STYLE_WARN) {
            report({
              message: `The <style> blocks total ${bytes} bytes, close to Gmail's limit`,
              email,
              level: "warn",
            })
          }
        },
        report,
      ),
  },
  {
    id: "css.colour-hex",
    level: "error",
    rule: "Every colour, in CSS and in attributes, is #rrggbb or transparent.",
    fix: "Write six-digit hex: three-digit hex, names and functions break in some clients. Theme roles are hex already.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const check = (where: string, value: string, at: number) => {
            for (const colour of colourTokens(value)) {
              if (
                !/^#[0-9a-f]{6}$/i.test(colour) &&
                !/^(transparent|inherit|currentcolor|initial)$/i.test(colour)
              ) {
                problem(`${where}: ${colour}`, at)
              }
            }
          }
          for (const { decl, offset } of declarations(email.parsed.styles)) {
            if (COLOUR_PROPS.test(decl.prop)) check(`\`${decl.prop}\``, decl.value, offset)
          }
          for (const { element, offset, props } of inlineStyles(email.parsed.elements)) {
            for (const [prop, value] of props)
              if (COLOUR_PROPS.test(prop)) check(`<${element.name}> \`${prop}\``, value, offset)
          }
          for (const { node, offset } of email.parsed.elements) {
            for (const name of ["bgcolor", "color", "bordercolor"]) {
              const value = node.attribs[name]
              if (value !== undefined && !/^#[0-9a-f]{6}$/i.test(value) && !isData(value))
                problem(`<${node.name} ${name}="${value}">`, offset)
            }
          }
        },
        report,
      ),
  },
  {
    id: "css.no-alpha",
    level: "warn",
    rule: "No rgba(), hsla(), 8-digit hex or opacity.",
    fix: "Clients that ignore alpha show the colour solid or not at all: flatten it against its background (the theme does).",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const alpha = (value: string) => /\b(rgba|hsla)\(|#[0-9a-f]{8}\b/i.test(value)
          for (const { decl, offset } of declarations(email.parsed.styles)) {
            if (decl.prop === "opacity" || alpha(decl.value))
              problem(`\`${decl.prop}: ${decl.value}\``, offset)
          }
          for (const { element, offset, props } of inlineStyles(email.parsed.elements)) {
            for (const [prop, value] of props)
              if (prop === "opacity" || alpha(value))
                problem(`<${element.name}> \`${prop}: ${value}\``, offset)
          }
        },
        report,
      ),
  },
  {
    id: "css.banned-layout",
    level: "error",
    rule: "No flex, grid, float, position, calc(), clamp(), min(), max(), :has() or @supports.",
    fix: "Classic Outlook and many webmail clients drop these: lay out with tables, as email-kit's components do.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const banned = (prop: string, value: string) =>
            (prop === "display" && /\b(inline-)?(flex|grid)\b/.test(value)) ||
            (prop === "float" && value !== "none") ||
            (prop === "position" && value !== "static") ||
            /\b(calc|clamp|min|max)\(/.test(value)
          for (const { decl, offset } of declarations(email.parsed.styles)) {
            if (banned(decl.prop, decl.value)) problem(`\`${decl.prop}: ${decl.value}\``, offset)
          }
          for (const { element, offset, props } of inlineStyles(email.parsed.elements)) {
            for (const [prop, value] of props)
              if (banned(prop, value)) problem(`<${element.name}> \`${prop}: ${value}\``, offset)
          }
          for (const style of email.parsed.styles) {
            style.node.walkAtRules("supports", (rule) =>
              problem("@supports", style.offset + (rule.source?.start?.offset ?? 0)),
            )
            style.node.walkRules((rule) => {
              if (rule.selector.includes(":has("))
                problem(`\`${rule.selector}\``, style.offset + (rule.source?.start?.offset ?? 0))
            })
          }
        },
        report,
      ),
  },
  {
    id: "css.media-allowlist",
    level: "warn",
    rule: "Media queries use only width, orientation, resolution and prefers-color-scheme.",
    fix: "Other features are unsupported or rewritten by email clients; keep the query to these.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const style of email.parsed.styles) {
            style.node.walkAtRules("media", (rule) => {
              for (const match of rule.params.matchAll(/\(\s*([a-z-]+)\s*[:)]/gi)) {
                const feature = (match[1] as string).toLowerCase()
                if (!MEDIA_FEATURES.test(feature))
                  problem(`@media (${feature})`, style.offset + (rule.source?.start?.offset ?? 0))
              }
            })
          }
        },
        report,
      ),
  },
  {
    id: "css.inline-parse",
    level: "error",
    rule: "Every inline style parses cleanly.",
    fix: "Gmail, Outlook on the web and Office 365 drop a whole style attribute with a stray character: fix the declaration.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { element, offset, style } of inlineStyles(email.parsed.elements)) {
            for (const part of style.split(";")) {
              const declaration = part.trim()
              if (!declaration) continue
              const outsideUrls = declaration.replace(/url\([^)]*\)/g, "")
              if (!/^-?[a-zA-Z-]+\s*:\s*\S/.test(declaration) || /[`=]/.test(outsideUrls)) {
                problem(`<${element.name}> style has "${declaration}"`, offset)
              }
            }
          }
        },
        report,
      ),
  },
  {
    id: "css.gradient-fallback",
    level: "error",
    rule: "An element with a background image or gradient also has a solid background colour.",
    fix: "Add background-color (or bgcolor): Outlook and images-off show the colour, and text on it stays readable.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { element, offset, props } of inlineStyles(email.parsed.elements)) {
            const image =
              props.get("background-image") ??
              (/gradient\(|url\(/.test(props.get("background") ?? "")
                ? props.get("background")
                : undefined)
            const colour =
              props.get("background-color") ??
              element.attribs.bgcolor ??
              colourTokens(props.get("background") ?? "")[0]
            if (image && !colour)
              problem(`<${element.name}> has a background image without a colour`, offset)
          }
        },
        report,
      ),
  },
  {
    id: "css.units",
    level: "warn",
    rule: "No rem, vw or vh in inline styles.",
    fix: "Use px: several clients ignore relative units inline.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { element, offset, props } of inlineStyles(email.parsed.elements)) {
            for (const [prop, value] of props) {
              if (/\d(rem|vw|vh)\b/.test(value))
                problem(`<${element.name}> \`${prop}: ${value}\``, offset)
            }
          }
        },
        report,
      ),
  },
  {
    id: "css.hide-mso",
    level: "warn",
    rule: "display:none outside MSO blocks comes with mso-hide:all.",
    fix: "Classic Outlook ignores display:none on some elements: add mso-hide:all.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { element, offset, mso, props } of inlineStyles(email.parsed.elements)) {
            if (!mso && props.get("display") === "none" && props.get("mso-hide") !== "all") {
              problem(`<${element.name}> has display:none without mso-hide:all`, offset)
            }
          }
        },
        report,
      ),
  },
  {
    id: "css.line-height-px",
    level: "error",
    rule: "Text cells set a px line height with mso-line-height-rule:exactly.",
    fix: "Use Text, Heading or the font() helper: Word's default line height differs from every other client's.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { element, offset, mso, props } of inlineStyles(email.parsed.elements)) {
            if (mso || !TEXT_CELLS.has(element.name) || !ownText(element)) continue
            if (
              !/^\d+(\.\d+)?px$/.test(props.get("line-height") ?? "") ||
              props.get("mso-line-height-rule") !== "exactly"
            ) {
              problem(
                `<${element.name}> with text has no px line height with mso-line-height-rule:exactly`,
                offset,
              )
            }
          }
          for (const { node, offset, mso } of email.parsed.elements) {
            if (
              !mso &&
              TEXT_CELLS.has(node.name) &&
              ownText(node) &&
              node.attribs.style === undefined
            ) {
              problem(
                `<${node.name}> with text has no px line height with mso-line-height-rule:exactly`,
                offset,
              )
            }
          }
        },
        report,
      ),
  },
]

const COLOUR_PROPS =
  /^(color|background-color|background|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|text-decoration-color|column-rule-color)$/
const MEDIA_FEATURES =
  /^((min-|max-)?(device-)?(width|resolution)|orientation|prefers-color-scheme|-webkit-(min-|max-)?device-pixel-ratio)$/

/** The colours in a value: hex, colour functions and CSS names. */
function colourTokens(value: string): string[] {
  const tokens: string[] = []
  for (const match of value.matchAll(
    /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)|\b[a-z]+\b/gi,
  )) {
    const token = match[0]
    if (
      token.startsWith("#") ||
      token.includes("(") ||
      NAMED.has(token.toLowerCase()) ||
      /^(transparent|currentcolor)$/i.test(token)
    ) {
      tokens.push(token)
    }
  }
  return tokens
}

const NAMED = new Set(Object.keys(colorsNamed))
