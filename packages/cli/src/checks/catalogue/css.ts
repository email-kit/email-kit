import { isData } from "../parse.ts"
import type { Check } from "../types.ts"
import {
  allDeclarations,
  declarations,
  describe,
  eachEmail,
  inlineStyles,
  NAMED_COLOURS,
  offsetIn,
  ownText,
  propertyName,
  TEXT_CELLS,
} from "./util.ts"

/** Colour syntax Gmail rejects, dropping the whole `<style>` block. */
const MODERN = /\b(oklch|oklab|lch|lab|color-mix|color|light-dark|hsl|hsla)\(/i

/** `rgb()` with space-separated channels, CSS Color 4's syntax, which Gmail rejects too. */
const SPACE_RGB = /\brgba?\(\s*[\d.]+%?\s+[\d.]/i

/** Gmail ignores styles past this many bytes. */
const STYLE_LIMIT = 16_384

/** The size from which `css.style-size` warns. */
const STYLE_WARN = 12 * 1024

/** The properties that take a colour. */
const COLOUR_PROPS =
  /^(color|background-color|background|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|text-decoration-color|column-rule-color)$/

/** The colour attributes of old HTML. */
const COLOUR_ATTRIBUTES = ["bgcolor", "color", "bordercolor"]

/** Six-digit hex, the one colour form every client reads. */
const HEX6 = /^#[0-9a-f]{6}$/i

/** The media features email clients support. */
const MEDIA_FEATURES =
  /^((min-|max-)?(device-)?(width|resolution)|orientation|prefers-color-scheme|-webkit-(min-|max-)?device-pixel-ratio)$/

/** The `css.*` checks: only CSS that strict clients accept. */
export const CSS: readonly Check[] = [
  {
    id: "css.no-double-brace",
    level: "error",
    rule: "No `}}` in CSS.",
    fix: "Separate closing braces with a space or a newline: Outlook on the web and the Outlook apps drop all CSS after `}}`.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const style of email.parsed.styles) {
          const css = style.node.source?.input.css ?? ""
          for (let i = css.indexOf("}}"); i !== -1; i = css.indexOf("}}", i + 2)) {
            problem("`}}` in a <style> block", style.offset + i)
          }
        }
      }),
  },
  {
    id: "css.important-lowercase",
    level: "error",
    rule: "`!important` is lowercase with a space before it, and never inline.",
    fix: "Write ` !important`; Gmail drops the whole <style> block for `!IMPORTANT`. Inline styles win without it.",
    /** postcss keeps `raws.important` only when it isn't exactly ` !important`. */
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { decl, offset } of declarations(email.parsed.styles)) {
          if (decl.important && decl.raws.important !== undefined) {
            problem(`\`${decl.prop}\` is marked "${decl.raws.important.trim()}"`, offset)
          }
        }
        for (const { element, offset, style } of inlineStyles(email.parsed.elements)) {
          if (/!\s*important/i.test(style)) {
            problem(`<${element.name}> has !important in its style attribute`, offset)
          }
        }
      }),
  },
  {
    id: "css.no-nesting",
    level: "error",
    rule: "No nested rules, and no at-rule inside an at-rule.",
    fix: "Flatten the CSS: Gmail drops the block, Yahoo applies nested properties to the parent.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const style of email.parsed.styles) {
          style.node.walk((node) => {
            const parent = node.parent
            const nested =
              (node.type === "rule" && parent?.type === "rule") ||
              (node.type === "atrule" && parent?.type === "atrule")
            if (nested) {
              const kind = node.type === "rule" ? "rule" : "at-rule"
              problem(`A nested ${kind} in a <style> block`, offsetIn(style, node))
            }
          })
        }
      }),
  },
  {
    id: "css.no-modern-colour",
    level: "error",
    rule: "No oklch(), oklab(), lch(), lab(), color-mix(), color(), light-dark() or hsl(), and no space-separated rgb().",
    fix: "Use #rrggbb: Gmail drops the whole <style> block for modern colour syntax. Theme colours are converted for you.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const declaration of allDeclarations(email)) {
          const { value, offset } = declaration
          if (MODERN.test(value) || SPACE_RGB.test(value)) problem(describe(declaration), offset)
        }
      }),
  },
  {
    id: "css.no-custom-props",
    level: "error",
    rule: "No custom properties (`--x:`) or `var()`.",
    fix: "Most clients don't support them; email-kit writes resolved values from the theme.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const declaration of allDeclarations(email)) {
          const { prop, value, offset } = declaration
          if (prop.startsWith("--") || /\bvar\(/.test(value)) problem(describe(declaration), offset)
        }
      }),
  },
  {
    id: "css.style-size",
    level: "error",
    rule: "All `<style>` blocks together stay under 16,384 bytes (a warning from 12 KB).",
    fix: "Gmail ignores styles past about 16 KB. Move rules inline or drop unused ones.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const bytes = email.parsed.styles
          .filter((style) => !style.mso)
          .reduce((sum, style) => sum + Buffer.byteLength(style.node.source?.input.css ?? ""), 0)
        if (bytes >= STYLE_LIMIT) problem(`The <style> blocks total ${bytes} bytes`)
        else if (bytes >= STYLE_WARN) {
          report({
            message: `The <style> blocks total ${bytes} bytes, close to Gmail's limit`,
            email,
            level: "warn",
          })
        }
      }),
  },
  {
    id: "css.colour-hex",
    level: "error",
    rule: "Every colour, in CSS and in attributes, is #rrggbb or transparent.",
    fix: "Write six-digit hex: three-digit hex, names and functions break in some clients. Theme roles are hex already.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const declaration of allDeclarations(email)) {
          if (!COLOUR_PROPS.test(declaration.prop)) continue
          for (const colour of colourTokens(declaration.value)) {
            if (
              !HEX6.test(colour) &&
              !/^(transparent|inherit|currentcolor|initial)$/i.test(colour)
            ) {
              problem(`${propertyName(declaration)}: ${colour}`, declaration.offset)
            }
          }
        }
        for (const { node, offset } of email.parsed.elements) {
          for (const name of COLOUR_ATTRIBUTES) {
            const value = node.attribs[name]
            if (value !== undefined && !HEX6.test(value) && !isData(value)) {
              problem(`<${node.name} ${name}="${value}">`, offset)
            }
          }
        }
      }),
  },
  {
    id: "css.no-alpha",
    level: "warn",
    rule: "No rgba(), hsla(), 8-digit hex or opacity.",
    fix: "Clients that ignore alpha show the colour solid or not at all: flatten it against its background (the theme does).",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const declaration of allDeclarations(email)) {
          const { prop, value, offset } = declaration
          if (prop === "opacity" || /\b(rgba|hsla)\(|#[0-9a-f]{8}\b/i.test(value)) {
            problem(describe(declaration), offset)
          }
        }
      }),
  },
  {
    id: "css.banned-layout",
    level: "error",
    rule: "No flex, grid, float, position, calc(), clamp(), min(), max(), :has() or @supports.",
    fix: "Classic Outlook and many webmail clients drop these: lay out with tables, as email-kit's components do.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const declaration of allDeclarations(email)) {
          const { prop, value, offset } = declaration
          const banned =
            (prop === "display" && /\b(inline-)?(flex|grid)\b/.test(value)) ||
            (prop === "float" && value !== "none") ||
            (prop === "position" && value !== "static") ||
            /\b(calc|clamp|min|max)\(/.test(value)
          if (banned) problem(describe(declaration), offset)
        }
        for (const style of email.parsed.styles) {
          style.node.walkAtRules("supports", (rule) => problem("@supports", offsetIn(style, rule)))
          style.node.walkRules((rule) => {
            if (rule.selector.includes(":has(")) {
              problem(`\`${rule.selector}\``, offsetIn(style, rule))
            }
          })
        }
      }),
  },
  {
    id: "css.media-allowlist",
    level: "warn",
    rule: "Media queries use only width, orientation, resolution and prefers-color-scheme.",
    fix: "Other features are unsupported or rewritten by email clients; keep the query to these.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const style of email.parsed.styles) {
          style.node.walkAtRules("media", (rule) => {
            for (const match of rule.params.matchAll(/\(\s*([a-z-]+)\s*[:)]/gi)) {
              const feature = (match[1] as string).toLowerCase()
              if (!MEDIA_FEATURES.test(feature)) {
                problem(`@media (${feature})`, offsetIn(style, rule))
              }
            }
          })
        }
      }),
  },
  {
    id: "css.inline-parse",
    level: "error",
    rule: "Every inline style parses cleanly.",
    fix: "Gmail, Outlook on the web and Office 365 drop a whole style attribute with a stray character: fix the declaration.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
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
      }),
  },
  {
    id: "css.gradient-fallback",
    level: "error",
    rule: "An element with a background image or gradient also has a solid background colour.",
    fix: "Add background-color (or bgcolor): Outlook and images-off show the colour, and text on it stays readable.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { element, offset, props } of inlineStyles(email.parsed.elements)) {
          const background = props.get("background") ?? ""
          const image =
            props.get("background-image") ??
            (/gradient\(|url\(/.test(background) ? background : undefined)
          const colour =
            props.get("background-color") ?? element.attribs.bgcolor ?? colourTokens(background)[0]
          if (image && !colour) {
            problem(`<${element.name}> has a background image without a colour`, offset)
          }
        }
      }),
  },
  {
    id: "css.units",
    level: "warn",
    rule: "No rem, vw or vh in inline styles.",
    fix: "Use px: several clients ignore relative units inline.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { element, offset, props } of inlineStyles(email.parsed.elements)) {
          for (const [prop, value] of props) {
            if (/\d(rem|vw|vh)\b/.test(value))
              problem(`<${element.name}> \`${prop}: ${value}\``, offset)
          }
        }
      }),
  },
  {
    id: "css.hide-mso",
    level: "warn",
    rule: "display:none outside MSO blocks comes with mso-hide:all.",
    fix: "Classic Outlook ignores display:none on some elements: add mso-hide:all.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { element, offset, mso, props } of inlineStyles(email.parsed.elements)) {
          if (!mso && props.get("display") === "none" && props.get("mso-hide") !== "all") {
            problem(`<${element.name}> has display:none without mso-hide:all`, offset)
          }
        }
      }),
  },
  {
    id: "css.line-height-px",
    level: "error",
    rule: "Text cells set a px line height with mso-line-height-rule:exactly.",
    fix: "Use Text, Heading or the font() helper: Word's default line height differs from every other client's.",
    /** Text cells with a style attribute are checked first, then those with none. */
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const message = (name: string) =>
          `<${name}> with text has no px line height with mso-line-height-rule:exactly`
        for (const { element, offset, mso, props } of inlineStyles(email.parsed.elements)) {
          if (mso || !TEXT_CELLS.has(element.name) || !ownText(element)) continue
          if (
            !/^\d+(\.\d+)?px$/.test(props.get("line-height") ?? "") ||
            props.get("mso-line-height-rule") !== "exactly"
          ) {
            problem(message(element.name), offset)
          }
        }
        for (const { node, offset, mso } of email.parsed.elements) {
          if (mso || node.attribs.style !== undefined) continue
          if (TEXT_CELLS.has(node.name) && ownText(node)) problem(message(node.name), offset)
        }
      }),
  },
]

/** The colours in a value: hex, colour functions and CSS colour names. */
function colourTokens(value: string): string[] {
  const tokens: string[] = []
  for (const match of value.matchAll(
    /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)|\b[a-z]+\b/gi,
  )) {
    const token = match[0]
    if (
      token.startsWith("#") ||
      token.includes("(") ||
      NAMED_COLOURS.has(token.toLowerCase()) ||
      /^(transparent|currentcolor)$/i.test(token)
    ) {
      tokens.push(token)
    }
  }
  return tokens
}
