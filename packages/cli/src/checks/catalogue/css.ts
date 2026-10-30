// A.4 CSS (`css.*`): CSS strict clients accept (research 01 §3, §5).

import type { Check } from "../types.ts"
import { declarations, eachEmail, inlineStyles } from "./util.ts"

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
]
