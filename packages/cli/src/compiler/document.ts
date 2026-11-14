import { familyList, type IrNode, parseRoleClass, roleClass } from "@email-kit/core/internal"

import type { FontStack } from "../theme/theme.ts"
import { renderAttributeValue, renderHtml } from "./html.ts"

/** What `renderDocument()` needs to wrap one compiled email in its HTML document. */
export interface DocumentOptions {
  /** The locale, written as `lang` on `<html>`, `<body>` and the wrapper. */
  readonly lang: string
  /** The text direction, written as `dir` on `<html>` and the wrapper. */
  readonly dir: "ltr" | "rtl"
  /** The subject, used as the `<title>` and the wrapper's `aria-label`. */
  readonly subject: IrNode
  /** The preview text inbox lists show after the subject, hidden in the email itself. */
  readonly preheader: IrNode | undefined
  /** The email's content. */
  readonly body: IrNode
  /** Whether classic Outlook is a target, which adds its DPI fix, font rules and ghost table. */
  readonly outlookClassic: boolean
  /**
   * The `font-family` classic Outlook gets for all text, from `msoFontFamily()`. Defaults to
   * Arial.
   */
  readonly outlookFont?: string | undefined
  /**
   * The `font-family` classic Outlook gets for elements with each font class, such as
   * `ek-font--mono`, from `msoFontFamily()`. Only classes the body uses get a rule.
   */
  readonly outlookClassFonts?: Readonly<Record<string, string>> | undefined
  /**
   * The `color-scheme` to declare. Leave it out to declare `light dark` only when the email has
   * dark rules.
   */
  readonly colorScheme?: "light dark" | "light only" | undefined
  /** Extra rules for the `<style>` in `<head>`, for what can't be inline, such as media queries. */
  readonly styles?: readonly string[] | undefined
  /**
   * The dark colour of each role, when the theme has a dark palette. Elements with a role class
   * get dark rules, and the `color-scheme` signals are added when there are any.
   */
  readonly dark?: Readonly<Record<string, string>> | undefined
  /**
   * The light canvas and ink, painted inline on the wrapper. Once `light dark` is declared the
   * client's default ground turns dark, so unstyled text and the content ground must inherit from
   * a root that the dark CSS restyles.
   */
  readonly ground?: { readonly canvas: string; readonly ink: string } | undefined
  /** The page container: its width and the padding inside it, in pixels. */
  readonly container?:
    | { readonly width: number; readonly paddingBlock: number; readonly paddingInline: number }
    | undefined
}

/**
 * Pads the preheader, so the inbox preview doesn't run on into the body text. `&#847;` alone
 * stopped working in Yahoo and Apple Mail, so this mixes in a figure space and a zero-width
 * no-break space.
 */
export const PREHEADER_FILLER = "&#8199;&#65279;&#847;"
/** How many fillers follow the preheader: enough to fill the longest inbox preview. */
const FILLER_COUNT = 100
/** About 480 bytes a line, well under email's 998-byte line limit. */
const FILLER_PER_LINE = 25

/** Stops classic Outlook scaling the email on high-DPI Windows displays. */
const DPI =
  "<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch>" +
  "</o:OfficeDocumentSettings></xml></noscript><![endif]-->"

/**
 * Keeps the links Apple Mail makes from dates, addresses and numbers looking like the text around
 * them. The format-detection meta alone doesn't stop it.
 */
const DATA_DETECTOR_RESET =
  "a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; " +
  "font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; " +
  "line-height: inherit !important; }"

/**
 * Wraps the rendered body in a complete HTML document:
 * - the HTML5 doctype, with `lang` and `dir` on `<html>` and again on a wrapper `<div>`, since
 *   Gmail, Outlook.com and Yahoo replace `<html>` and `<body>`;
 * - `<meta charset>` first, then the viewport, Apple reformatting and format-detection metas, and
 *   `color-scheme` only when the email declares one;
 * - a `<title>` equal to the subject, which is also the wrapper's `aria-label`;
 * - for classic Outlook, the DPI fix and the font rules, in conditional comments;
 * - one `<style>` in `<head>`, for rules that can't be inline;
 * - a bare `<body>`, then the hidden preheader first in the wrapper, then the container.
 *
 * With a `color-scheme`, `:root` always gets `light dark`, even when the meta says `light only`:
 * Apple Mail lets that CSS win over the meta, so the theme's own dark colours still apply there
 * while other clients leave the email light.
 */
export function renderDocument(doc: DocumentOptions): string {
  const body = renderHtml(doc.body).trimEnd()
  const wrapper =
    `<div role="article" aria-label="${renderAttributeValue(doc.subject)}" ` +
    `lang="${doc.lang}" dir="${doc.dir}"${groundAttributes(doc.ground)}>`
  const dark = doc.dark ? darkRules(`${wrapper}\n${body}`, doc.dark) : []
  const colorScheme = doc.colorScheme ?? (dark.length > 0 ? "light dark" : undefined)
  const styles = [
    DATA_DETECTOR_RESET,
    ...(colorScheme ? [":root { color-scheme: light dark; }"] : []),
    ...(doc.styles ?? []),
    ...dark,
  ]
  return [
    "<!DOCTYPE html>",
    `<html lang="${doc.lang}" dir="${doc.dir}"${namespaces(body, doc.outlookClassic)}>`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="x-apple-disable-message-reformatting">',
    '<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">',
    ...(colorScheme ? [`<meta name="color-scheme" content="${colorScheme}">`] : []),
    `<title>${renderHtml(doc.subject)}</title>`,
    ...(doc.outlookClassic
      ? [DPI, `<!--[if mso]><style>${msoFontRules(doc, body).join(" ")}</style><![endif]-->`]
      : []),
    `<style>\n${styles.join("\n")}\n</style>`,
    "</head>",
    `<body xml:lang="${doc.lang}" style="margin:0;padding:0">`,
    wrapper,
    ...(doc.preheader ? [preheader(doc.preheader)] : []),
    ...(doc.container ? container(doc.container, body, doc.outlookClassic) : [body]),
    "</div>",
    "</body>",
    "</html>",
    "",
  ].join("\n")
}

/**
 * The `font-family` for classic Outlook: the stack's `msoFallback`, then its generic family. Word
 * doesn't fall back through a list, so when the first family isn't installed it uses Times New
 * Roman instead.
 */
export function msoFontFamily(stack: FontStack): string {
  const last = stack.families.at(-1)
  const generic = last !== undefined && last !== stack.msoFallback ? [last] : []
  return familyList([stack.msoFallback, ...generic])
}

/**
 * The wrapper's light canvas and ink: inline, with the role classes the dark rules restyle. Empty
 * without a ground.
 */
function groundAttributes(ground: DocumentOptions["ground"]): string {
  if (!ground) return ""
  const classes = `${roleClass("background-color", "canvas")} ${roleClass("color", "ink")}`
  return ` style="background-color:${ground.canvas};color:${ground.ink}" class="${classes}"`
}

/**
 * The XML namespaces `<html>` declares: Office's for classic Outlook or any `<o:…>` element, and
 * VML's for any `<v:…>` shape, such as a bulletproof button.
 */
function namespaces(body: string, outlookClassic: boolean): string {
  const office = outlookClassic || body.includes("<o:")
  return (
    (office ? ' xmlns:o="urn:schemas-microsoft-com:office:office"' : "") +
    (body.includes("<v:") ? ' xmlns:v="urn:schemas-microsoft-com:vml"' : "")
  )
}

/**
 * The dark CSS for the role classes in `html`: `@media (prefers-color-scheme: dark)` rules for
 * Apple Mail and others, then the same rules for Outlook.com, which marks dark mode with
 * `[data-ogsb]` for backgrounds and `[data-ogsc]` for text and borders. Each rule is `!important`
 * and aimed at the element that has the inline colour.
 */
function darkRules(html: string, dark: Readonly<Record<string, string>>): string[] {
  const classes = new Set<string>()
  for (const [, list = ""] of html.matchAll(/\bclass="([^"]*)"/g)) {
    for (const name of list.split(/\s+/)) if (name.startsWith("ek-")) classes.add(name)
  }
  const rules: { selector: string; declaration: string; outlook: string }[] = []
  for (const name of [...classes].sort()) {
    const parsed = parseRoleClass(name)
    const colour = parsed && dark[parsed.role]
    if (!parsed || !colour) continue
    rules.push({
      selector: `.${name}`,
      declaration: `${parsed.property}: ${colour} !important;`,
      outlook: parsed.property.startsWith("background") ? "[data-ogsb]" : "[data-ogsc]",
    })
  }
  if (rules.length === 0) return []
  return [
    "@media (prefers-color-scheme: dark) {",
    ...rules.map((rule) => `  ${rule.selector} { ${rule.declaration} }`),
    "}",
    ...rules.map((rule) => `${rule.outlook} ${rule.selector} { ${rule.declaration} }`),
  ]
}

/**
 * Classic Outlook's font rules: the body font for all text, then a rule for each font class the
 * body uses. A class beats a tag name, so those elements keep their own stack's font.
 */
function msoFontRules(doc: DocumentOptions, body: string): string[] {
  const tags = "body, table, td, th, p, a, li, h1, h2, h3, h4, h5, h6"
  const all = `${tags} { font-family: ${doc.outlookFont ?? "Arial, sans-serif"} !important; }`
  const classes = Object.entries(doc.outlookClassFonts ?? {})
    .filter(([name]) => body.includes(name))
    .map(([name, family]) => `.${name} { font-family: ${family} !important; }`)
  return [all, ...classes]
}

/**
 * The page container: a centred `max-width` div, which shrinks on narrow screens without media
 * queries. Classic Outlook ignores `max-width`, `margin: auto` and div padding, so it gets a table
 * of the same width instead, in conditional comments.
 */
function container(
  { width, paddingBlock, paddingInline }: NonNullable<DocumentOptions["container"]>,
  body: string,
  outlookClassic: boolean,
): string[] {
  const padding = `${paddingBlock}px ${paddingInline}px`
  const div = `<div style="max-width:${width}px;margin:0 auto;padding:${padding};box-sizing:border-box">`
  if (!outlookClassic) return [div, body, "</div>"]
  return [
    `<!--[if mso]><table role="presentation" align="center" width="${width}" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:${padding}"><![endif]-->`,
    div,
    body,
    "</div>",
    "<!--[if mso]></td></tr></table><![endif]-->",
  ]
}

/** The preheader: hidden text that inbox lists show after the subject, followed by the filler. */
function preheader(node: IrNode): string {
  const lines: string[] = []
  for (let i = 0; i < FILLER_COUNT; i += FILLER_PER_LINE) {
    lines.push(PREHEADER_FILLER.repeat(Math.min(FILLER_PER_LINE, FILLER_COUNT - i)))
  }
  return (
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all" aria-hidden="true">' +
    `${renderHtml(node)}\n${lines.join("\n")}</div>`
  )
}
