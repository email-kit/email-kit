// A.3 Document (`html.*`): the skeleton every email needs (research 01 §2).

import { isRtl } from "../../compiler/compile.ts"
import { ancestors, attr } from "../parse.ts"
import type { Check } from "../types.ts"
import { eachEmail, text } from "./util.ts"

const EMBEDS = new Set(["form", "input", "script", "iframe", "object", "embed", "video", "svg"])

export const HTML: readonly Check[] = [
  {
    id: "html.doctype",
    level: "error",
    rule: "The email starts with `<!doctype html>`.",
    fix: "Start the document with `<!DOCTYPE html>`; without it, clients render in quirks mode.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          if (!/^<!doctype html>/i.test(email.html))
            problem("The email doesn't start with <!DOCTYPE html>", 0)
        },
        report,
      ),
  },
  {
    id: "html.lang-dir",
    level: "error",
    rule: "`lang` and `dir` on `<html>` and the wrapper, `xml:lang` on the body, matching the locale.",
    fix: "Render through email-kit's document skeleton, which sets them from the locale.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const dir = isRtl(email.locale) ? "rtl" : "ltr"
          const find = (name: string) =>
            email.parsed.elements.find((e) => !e.mso && e.node.name === name)
          const wrapper = email.parsed.elements.find(
            (e) => !e.mso && attr(e.node, "role") === "article",
          )
          for (const [label, found] of [
            ["<html>", find("html")],
            ["the wrapper", wrapper],
          ] as const) {
            if (!found) {
              problem(`${label} is missing`)
              continue
            }
            if (attr(found.node, "lang") !== email.locale) {
              problem(
                `${label} has lang="${attr(found.node, "lang") ?? ""}", not "${email.locale}"`,
                found.offset,
              )
            }
            if (attr(found.node, "dir") !== dir) {
              problem(
                `${label} has dir="${attr(found.node, "dir") ?? ""}", not "${dir}"`,
                found.offset,
              )
            }
          }
          const body = find("body")
          if (body && attr(body.node, "xml:lang") !== email.locale) {
            problem(`<body> has no xml:lang="${email.locale}"`, body.offset)
          }
        },
        report,
      ),
  },
  {
    id: "html.title",
    level: "warn",
    rule: "`<title>` is present and equals the subject.",
    fix: "Screen readers and some clients show the title; keep it the subject.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const title = email.parsed.elements.find((e) => e.node.name === "title")
          if (!title) problem("There is no <title>")
          else if (text(title.node) !== email.subject) {
            problem(
              `<title> is "${text(title.node)}", the subject "${email.subject}"`,
              title.offset,
            )
          }
        },
        report,
      ),
  },
  {
    id: "html.xmlns",
    level: "error",
    rule: "Office (`o:`) and VML (`v:`) elements need their namespace on `<html>`.",
    fix: 'Declare xmlns:o="urn:schemas-microsoft-com:office:office" or xmlns:v="urn:schemas-microsoft-com:vml".',
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const root = email.parsed.elements.find((e) => e.node.name === "html")
          for (const prefix of ["o", "v"]) {
            const used = email.parsed.elements.find((e) => e.node.name.startsWith(`${prefix}:`))
            if (used && !(root && attr(root.node, `xmlns:${prefix}`))) {
              problem(
                `<${used.node.name}> is used but <html> doesn't declare xmlns:${prefix}`,
                used.offset,
              )
            }
          }
        },
        report,
      ),
  },
  {
    id: "html.no-forms-embeds",
    level: "error",
    // Renders too: hostile data must stay escaped text, never markup.
    on: "both",
    rule: "No form, input, script, iframe, object, embed, video or svg elements.",
    fix: "Clients strip them or mark the email as suspicious; link to a web page instead.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { node, offset } of email.parsed.elements) {
            if (EMBEDS.has(node.name)) problem(`<${node.name}> doesn't work in email`, offset)
          }
        },
        report,
      ),
  },
  {
    id: "html.no-body-style",
    level: "error",
    rule: "No `<style>` inside `<body>`.",
    fix: "Put styles inline or in the head; clients drop body styles.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          for (const { node, offset } of email.parsed.elements) {
            if (node.name === "style" && ancestors(node).some((a) => a.name === "body")) {
              problem("A <style> sits inside <body>", offset)
            }
          }
        },
        report,
      ),
  },
  {
    id: "html.data-detectors",
    level: "warn",
    rule: "The Apple data-detector reset is present.",
    fix: "Keep the `a[x-apple-data-detectors]` rule email-kit writes in the head.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const found = email.parsed.styles.some(
            (s) =>
              !s.mso &&
              s.node.some(
                (n) => n.type === "rule" && n.selector.includes("x-apple-data-detectors"),
              ),
          )
          if (!found)
            problem("No a[x-apple-data-detectors] reset: Apple Mail will restyle dates and numbers")
        },
        report,
      ),
  },
  {
    id: "html.mso-font",
    level: "error",
    outlookClassic: true,
    rule: "The MSO font override is present.",
    fix: "Keep the `[if mso]` style that sets a font-family; without it Word falls back to Times New Roman.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const found = email.parsed.styles.some((s) => {
            let font = false
            s.node.walkDecls("font-family", () => {
              font = true
            })
            return s.mso && font
          })
          if (!found) problem("No [if mso] font-family override")
        },
        report,
      ),
  },
  {
    id: "html.dpi-noscript",
    level: "error",
    outlookClassic: true,
    rule: "PixelsPerInch XML inside an MSO conditional and `<noscript>`.",
    fix: "Keep the OfficeDocumentSettings block email-kit writes; it stops Word scaling on high-DPI screens.",
    run: (context, report) =>
      eachEmail(
        context,
        (email, problem) => {
          const dpi = email.parsed.elements.find((e) => e.node.name === "o:pixelsperinch")
          if (!dpi) problem("No o:PixelsPerInch setting: Word scales images and widths at 120 DPI")
          else if (!dpi.mso || !ancestors(dpi.node).some((a) => a.name === "noscript")) {
            problem("o:PixelsPerInch must sit in <noscript> inside an [if mso] comment", dpi.offset)
          }
        },
        report,
      ),
  },
]
