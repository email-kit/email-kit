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
// - the preheader first in the wrapper, hidden, padded with filler.

import type { IrNode } from "@email-kit/core/internal"

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
  const namespaces = [
    ...(doc.outlookClassic || body.includes("<o:")
      ? [' xmlns:o="urn:schemas-microsoft-com:office:office"']
      : []),
    ...(body.includes("<v:") ? [' xmlns:v="urn:schemas-microsoft-com:vml"'] : []),
  ].join("")
  const styles = [
    DATA_DETECTOR_RESET,
    ...(doc.colorScheme ? [":root { color-scheme: light dark; }"] : []),
    ...(doc.styles ?? []),
  ]
  const label = renderAttributeValue(doc.subject)
  return [
    "<!DOCTYPE html>",
    `<html lang="${doc.lang}" dir="${doc.dir}"${namespaces}>`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="x-apple-disable-message-reformatting">',
    '<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">',
    ...(doc.colorScheme ? [`<meta name="color-scheme" content="${doc.colorScheme}">`] : []),
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
    `<div role="article" aria-label="${label}" lang="${doc.lang}" dir="${doc.dir}">`,
    ...(doc.preheader ? [preheader(doc.preheader)] : []),
    body,
    "</div>",
    "</body>",
    "</html>",
    "",
  ].join("\n")
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
