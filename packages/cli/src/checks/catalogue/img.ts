import type { Element } from "domhandler"

import { ancestors, attr, isData, type Located } from "../parse.ts"
import type { Check, CheckedEmail } from "../types.ts"
import { eachEmail, inlineStyles } from "./util.ts"

/** The image formats every client shows. */
const FORMATS = /\.(png|jpe?g|gif)$/i

/** The email's `<img>` elements. */
function images(email: CheckedEmail): Located<Element>[] {
  return email.parsed.elements.filter((e) => e.node.name === "img")
}

/**
 * The `img.*` checks. A value with mustache tags is data, so it's checked in the renders, once it
 * has real values.
 */
export const IMG: readonly Check[] = [
  {
    id: "img.alt",
    level: "error",
    on: "both",
    rule: "Every image has `alt`, non-empty when it is linked.",
    fix: 'Describe what the image says, name the destination of a linked one, or use alt="" for decoration.',
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of images(email)) {
          const alt = attr(node, "alt")
          if (alt === undefined)
            problem("An <img> has no alt; readers announce its file name", offset)
          else if (!alt.trim() && ancestors(node).some((a) => a.name === "a")) {
            problem("A linked <img> has empty alt: the link has no name", offset)
          }
        }
      }),
  },
  {
    id: "img.dimensions",
    level: "error",
    rule: "Every image has integer `width` and `height` attributes.",
    fix: "Word ignores CSS widths on images, and blocked images keep their space only with both attributes.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of images(email)) {
          for (const side of ["width", "height"]) {
            const value = attr(node, side)
            if (value === undefined || !/^\d+$/.test(value)) {
              problem(
                `An <img> has ${value === undefined ? `no ${side}` : `${side}="${value}"`}`,
                offset,
              )
            }
          }
        }
      }),
  },
  {
    id: "img.https",
    level: "error",
    on: "both",
    rule: "Image URLs are absolute `https:` URLs.",
    fix: "Gmail and Apple fetch images through proxies; relative and http: URLs break or warn.",
    /**
     * A `data:` src is for `img.format`, and a src that starts with a placeholder is checked once
     * rendered.
     */
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of images(email)) {
          const src = attr(node, "src") ?? ""
          if (src.startsWith("data:") || src.startsWith("{{")) continue
          if (!src.startsWith("https://"))
            problem(`src="${src}" isn't an absolute https: URL`, offset)
        }
      }),
  },
  {
    id: "img.format",
    level: "error",
    on: "both",
    rule: "Images are PNG, JPEG or GIF; never SVG or `data:` URIs.",
    fix: "Export a PNG or JPEG: SVG shows blank in Outlook on the web, classic Outlook can't show WebP or AVIF, Gmail drops data: images.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of images(email)) {
          const src = attr(node, "src") ?? ""
          if (src.startsWith("data:")) problem("A data: image: Gmail shows nothing", offset)
          else if (!isData(src)) {
            const path = src.split(/[?#]/)[0] ?? ""
            if (!FORMATS.test(path)) problem(`src="${src}" isn't a .png, .jpg or .gif`, offset)
          }
        }
      }),
  },
  {
    id: "img.fluid-width",
    level: "warn",
    rule: "An image with `max-width:100%` also has `width:100%`.",
    fix: "Gmail's Android web client rewrites a lone max-width; give width:100% and max-width in px.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { element, offset, props } of inlineStyles(email.parsed.elements)) {
          if (
            element.name === "img" &&
            props.get("max-width") === "100%" &&
            props.get("width") !== "100%"
          ) {
            problem("An <img> has max-width:100% without width:100%", offset)
          }
        }
      }),
  },
]
