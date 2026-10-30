// The document skeleton around the body (P1-061, BLD-02, BLD-06, BLD-07), following research 01
// §2, §3.2, §7 and §10.1:
// - the HTML5 doctype;
// - `lang`/`dir` on <html>, and again on the wrapper div that survives Gmail, OWA and Yahoo
//   replacing <html> and <body>;
// - meta charset first, then viewport, Apple reformatting, format-detection, and colour-scheme
//   only for templates with a dark palette (02 D2, D6);
// - <title> equal to the subject; the wrapper's aria-label too;
// - for classic Outlook: the 96 DPI XML inside an MSO conditional and <noscript>, and an
//   MSO-only font override;
// - one <style> in <head>, for enhancement rules only, written with spaces between braces and
//   lowercase ` !important`;
// - a bare <body> (margin and padding zero, nothing else);
// - the preheader first in the wrapper, hidden, padded with filler;
// - the hybrid container (BLD-04, research 01 §10): a centred `max-width` div, fluid below the
//   container width without media queries, inside an MSO ghost table of the same width, because
//   Word ignores `max-width`, `margin: auto` and div padding.

import { type IrNode, parseRoleClass, roleClass } from "@email-kit/core/internal"

import { renderAttributeValue, renderHtml } from "./html.ts"

export interface DocumentOptions {
  readonly lang: string
  readonly dir: "ltr" | "rtl"
  readonly subject: IrNode
  readonly preheader: IrNode | undefined
  readonly body: IrNode
  /** Classic Outlook (Word) is a target: the DPI fix and the MSO font override (CFG-05). */
  readonly outlookClassic: boolean
  /** Only for templates that ship a dark palette (research 02 D2, D6). */
  readonly colorScheme?: "light dark" | "light only" | undefined
  /** Enhancement rules for the head <style> (BLD-03); declarations are inline already. */
  readonly styles?: readonly string[] | undefined
  /**
   * The dark palette, for an authored dark strategy (THM-08). Elements tagged with a role class
   * get dark rules, and the colour-scheme signals are added when there are any (BLD-05).
   */
  readonly dark?: Readonly<Record<string, string>> | undefined
  /**
   * The light canvas and ink, painted inline on the wrapper. Once `light dark` is declared the
   * client's default ground turns dark, so unstyled text and the content ground must inherit from
   * a root that the dark CSS restyles (research 02 D1, D3).
   */
  readonly ground?: { readonly canvas: string; readonly ink: string } | undefined
  /** The page container (THM-06): its width and the padding inside it, in px. */
  readonly container?:
    | { readonly width: number; readonly paddingBlock: number; readonly paddingInline: number }
    | undefined
}

/**
 * The dark CSS for the role classes in `html`, from one rule list (BLD-05, research 02 D5):
 * `@media (prefers-color-scheme: dark)` for Apple Mail and others, and the Outlook.com twins,
 * `[data-ogsb]` for backgrounds and `[data-ogsc]` for text and borders, flat, `!important`, aimed
 * at the element that carries the inline colour.
 */
export function darkRules(html: string, dark: Readonly<Record<string, string>>): string[] {
  const classes = new Set<string>()
  for (const match of html.matchAll(/\bclass="([^"]*)"/g)) {
    for (const name of (match[1] as string).split(/\s+/))
      if (name.startsWith("ek-")) classes.add(name)
  }
  const rules: { selector: string; declaration: string; outlook: string }[] = []
  for (const name of [...classes].sort()) {
    const parsed = parseRoleClass(name)
    const colour = parsed ? dark[parsed.role] : undefined
    if (!parsed || !colour) continue
    const declaration = `${parsed.property}: ${colour} !important;`
    const outlook = parsed.property.startsWith("background") ? "[data-ogsb]" : "[data-ogsc]"
    rules.push({ selector: `.${name}`, declaration, outlook })
  }
  if (rules.length === 0) return []
  return [
    "@media (prefers-color-scheme: dark) {",
    ...rules.map((rule) => `  ${rule.selector} { ${rule.declaration} }`),
    "}",
    ...rules.map((rule) => `${rule.outlook} ${rule.selector} { ${rule.declaration} }`),
  ]
}

/** The fallback family Word uses instead of Times New Roman (research 01 §7). */
export const MSO_FONT_STACK = "Arial, Helvetica, sans-serif"

/**
 * Pads the preheader so body copy doesn't leak into the inbox preview: goodemailcode's current
 * filler (research 01 §10.1). `&#847;` alone stopped working in Yahoo and Apple Mail.
 */
export const PREHEADER_FILLER = "&#8199;&#65279;&#847;"
const FILLER_COUNT = 100
const FILLER_PER_LINE = 25 // about 480 bytes a line, well under 998 octets (BLD-09)

const DPI =
  "<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch>" +
  "</o:OfficeDocumentSettings></xml></noscript><![endif]-->"

// Apple Mail turns dates, addresses and numbers into blue links; the meta is only a hint.
const DATA_DETECTOR_RESET =
  "a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; " +
  "font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; " +
  "line-height: inherit !important; }"

export function renderDocument(doc: DocumentOptions): string {
  const body = renderHtml(doc.body).trimEnd()
  const ground = doc.ground
    ? ` style="background-color:${doc.ground.canvas};color:${doc.ground.ink}" class="${roleClass("background-color", "canvas")} ${roleClass("color", "ink")}"`
    : ""
  const wrapper = `<div role="article" aria-label="${renderAttributeValue(doc.subject)}" lang="${doc.lang}" dir="${doc.dir}"${ground}>`
  const dark = doc.dark ? darkRules(`${wrapper}\n${body}`, doc.dark) : []
  // Declare dark support only when the email ships dark rules (research 02 D2).
  const colorScheme = doc.colorScheme ?? (dark.length > 0 ? "light dark" : undefined)
  const namespaces = [
    ...(doc.outlookClassic || body.includes("<o:")
      ? [' xmlns:o="urn:schemas-microsoft-com:office:office"']
      : []),
    ...(body.includes("<v:") ? [' xmlns:v="urn:schemas-microsoft-com:vml"'] : []),
  ].join("")
  const styles = [
    DATA_DETECTOR_RESET,
    ...(colorScheme ? [":root { color-scheme: light dark; }"] : []),
    ...(doc.styles ?? []),
    ...dark,
  ]
  return [
    "<!DOCTYPE html>",
    `<html lang="${doc.lang}" dir="${doc.dir}"${namespaces}>`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="x-apple-disable-message-reformatting">',
    '<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">',
    ...(colorScheme ? [`<meta name="color-scheme" content="${colorScheme}">`] : []),
    `<title>${renderHtml(doc.subject)}</title>`,
    ...(doc.outlookClassic
      ? [
          DPI,
          `<!--[if mso]><style>body, table, td, th, p, a, li, h1, h2, h3, h4, h5, h6 { font-family: ${MSO_FONT_STACK} !important; }</style><![endif]-->`,
        ]
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
