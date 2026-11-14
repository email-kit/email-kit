import { isTag } from "domhandler"

import { isRtl } from "../../compiler/compile.ts"
import { ancestors, attr } from "../parse.ts"
import type { Check } from "../types.ts"
import {
  declarations,
  eachEmail,
  firstElement,
  inlineStyles,
  offsetIn,
  placeholders,
  templateOf,
  text,
  wrapperOf,
} from "./util.ts"

/** Elements email clients strip, or that make an email look like an attack. */
const EMBEDS = new Set(["form", "input", "script", "iframe", "object", "embed", "video", "svg"])

/** The `html.*` checks: the document skeleton every email needs. */
export const HTML: readonly Check[] = [
  {
    id: "html.doctype",
    level: "error",
    rule: "The email starts with `<!doctype html>`.",
    fix: "Start the document with `<!DOCTYPE html>`; without it, clients render in quirks mode.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        if (!/^<!doctype html>/i.test(email.html))
          problem("The email doesn't start with <!DOCTYPE html>", 0)
      }),
  },
  {
    id: "html.lang-dir",
    level: "error",
    rule: "`lang` and `dir` on `<html>` and the wrapper, `xml:lang` on the body, matching the locale.",
    fix: "Render through email-kit's document skeleton, which sets them from the locale.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const dir = isRtl(email.locale) ? "rtl" : "ltr"
        for (const [label, found] of [
          ["<html>", firstElement(email, "html")],
          ["the wrapper", wrapperOf(email)],
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
        const body = firstElement(email, "body")
        if (body && attr(body.node, "xml:lang") !== email.locale) {
          problem(`<body> has no xml:lang="${email.locale}"`, body.offset)
        }
      }),
  },
  {
    id: "html.title",
    level: "warn",
    rule: "`<title>` is present and equals the subject.",
    fix: "Screen readers and some clients show the title; keep it the subject.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const title = email.parsed.elements.find((e) => e.node.name === "title")
        if (!title) problem("There is no <title>")
        else if (text(title.node) !== email.subject) {
          problem(`<title> is "${text(title.node)}", the subject "${email.subject}"`, title.offset)
        }
      }),
  },
  {
    id: "html.xmlns",
    level: "error",
    rule: "Office (`o:`) and VML (`v:`) elements need their namespace on `<html>`.",
    fix: 'Declare xmlns:o="urn:schemas-microsoft-com:office:office" or xmlns:v="urn:schemas-microsoft-com:vml".',
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
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
      }),
  },
  {
    id: "html.no-forms-embeds",
    level: "error",
    /** Renders too: hostile data must stay escaped text, never markup. */
    on: "both",
    rule: "No form, input, script, iframe, object, embed, video or svg elements.",
    fix: "Clients strip them or mark the email as suspicious; link to a web page instead.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of email.parsed.elements) {
          if (EMBEDS.has(node.name)) problem(`<${node.name}> doesn't work in email`, offset)
        }
      }),
  },
  {
    id: "html.no-body-style",
    level: "error",
    rule: "No `<style>` inside `<body>`.",
    fix: "Put styles inline or in the head; clients drop body styles.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of email.parsed.elements) {
          if (node.name === "style" && ancestors(node).some((a) => a.name === "body")) {
            problem("A <style> sits inside <body>", offset)
          }
        }
      }),
  },
  {
    id: "html.data-detectors",
    level: "warn",
    rule: "The Apple data-detector reset is present.",
    fix: "Keep the `a[x-apple-data-detectors]` rule email-kit writes in the head.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const found = email.parsed.styles.some(
          (s) =>
            !s.mso &&
            s.node.some((n) => n.type === "rule" && n.selector.includes("x-apple-data-detectors")),
        )
        if (!found)
          problem("No a[x-apple-data-detectors] reset: Apple Mail will restyle dates and numbers")
      }),
  },
  {
    id: "html.mso-font",
    level: "error",
    outlookClassic: true,
    rule: "The MSO font override is present.",
    fix: "Keep the `[if mso]` style that sets a font-family; without it Word falls back to Times New Roman.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const found = email.parsed.styles.some((s) => {
          let font = false
          s.node.walkDecls("font-family", () => {
            font = true
          })
          return s.mso && font
        })
        if (!found) problem("No [if mso] font-family override")
      }),
  },
  {
    id: "html.dpi-noscript",
    level: "error",
    outlookClassic: true,
    rule: "PixelsPerInch XML inside an MSO conditional and `<noscript>`.",
    fix: "Keep the OfficeDocumentSettings block email-kit writes; it stops Word scaling on high-DPI screens.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const dpi = email.parsed.elements.find((e) => e.node.name === "o:pixelsperinch")
        if (!dpi) problem("No o:PixelsPerInch setting: Word scales images and widths at 120 DPI")
        else if (!dpi.mso || !ancestors(dpi.node).some((a) => a.name === "noscript")) {
          problem("o:PixelsPerInch must sit in <noscript> inside an [if mso] comment", dpi.offset)
        }
      }),
  },
  {
    id: "html.wrapper-aria",
    level: "warn",
    rule: 'The wrapper has role="article" and an aria-label; aria-roledescription only when localised.',
    fix: "Keep email-kit's document wrapper: screen readers announce the email by its label.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const wrapper = wrapperOf(email)
        if (!wrapper) return problem('No role="article" wrapper')
        if (!attr(wrapper.node, "aria-label")?.trim())
          problem("The wrapper has no aria-label", wrapper.offset)
        const roleDescription = attr(wrapper.node, "aria-roledescription")
        if (roleDescription === "email" && !email.locale.startsWith("en")) {
          problem(`aria-roledescription is English ("email") in ${email.locale}`, wrapper.offset)
        }
      }),
  },
  {
    id: "html.meta",
    level: "error",
    rule: "The head starts with the charset meta and has viewport, x-apple-disable-message-reformatting and format-detection.",
    fix: "Keep email-kit's document head: these stop clients rescaling the email and turning numbers into links.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const head = firstElement(email, "head")
        if (!head) return problem("There is no <head>")
        const metas = head.node.children.filter(isTag)
        if (!(metas[0]?.name === "meta" && attr(metas[0], "charset")))
          problem("The first element in <head> isn't <meta charset>", head.offset)
        for (const name of [
          "viewport",
          "x-apple-disable-message-reformatting",
          "format-detection",
        ]) {
          if (!metas.some((m) => m.name === "meta" && attr(m, "name") === name))
            problem(`No <meta name="${name}">`, head.offset)
        }
      }),
  },
  {
    id: "html.body-bare",
    level: "warn",
    rule: "<body> has no presentational attributes or styles beyond margin and padding 0.",
    fix: "Gmail, Outlook on the web and Yahoo replace <body>: put backgrounds and spacing on the wrapper.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const body = firstElement(email, "body")
        if (!body) return
        for (const name of Object.keys(body.node.attribs)) {
          if (!["xml:lang", "lang", "dir", "style"].includes(name))
            problem(`<body> has ${name}`, body.offset)
        }
        const style = (attr(body.node, "style") ?? "")
          .split(";")
          .map((d) => d.replace(/\s/g, ""))
          .filter(Boolean)
        const extra = style.filter((d) => !/^(margin|padding):0(px)?$/.test(d))
        if (extra.length > 0) problem(`<body> styles ${extra.join("; ")}`, body.offset)
      }),
  },
  {
    id: "html.no-external",
    level: "error",
    rule: "No external stylesheets or @import.",
    fix: "Most clients block them, and they add a tracking request: email-kit writes styles inline and in the head.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of email.parsed.elements) {
          if (node.name === "link" && /stylesheet/i.test(attr(node, "rel") ?? ""))
            problem('A <link rel="stylesheet">', offset)
        }
        for (const style of email.parsed.styles) {
          style.node.walkAtRules("import", (rule) => {
            problem(`@import ${rule.params}`, offsetIn(style, rule))
          })
        }
      }),
  },
  {
    id: "html.no-svg",
    level: "error",
    rule: "No inline <svg> and no SVG references.",
    fix: "Use a PNG: SVG shows blank in Outlook on the web and new Outlook, and Gmail rasterises it.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of email.parsed.elements) {
          if (node.name === "svg") problem("An inline <svg>", offset)
          for (const name of ["src", "href", "background"]) {
            const value = attr(node, name) ?? ""
            if (/\.svg(\?|#|$)|^data:image\/svg/i.test(value) && node.name !== "a")
              problem(`${name}="${value}" is an SVG`, offset)
          }
        }
        for (const { decl, offset } of declarations(email.parsed.styles)) {
          if (/url\([^)]*\.svg|image\/svg/i.test(decl.value))
            problem(`\`${decl.prop}\` loads an SVG`, offset)
        }
      }),
  },
  {
    id: "html.no-comments",
    level: "error",
    rule: "No HTML comments longer than 120 characters, except MSO conditionals.",
    fix: "Remove the comment: it ships to every reader, counts toward Gmail's clip, and may leak internal notes.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        for (const { node, offset } of email.parsed.comments) {
          const conditional = /^\[if [^\]]+\]|^<!\[endif\]|^\[endif\]/.test(node.trim())
          if (!conditional && node.length > 120)
            problem(`A ${node.length}-character comment`, offset)
        }
      }),
  },
  {
    id: "html.no-unresolved",
    level: "error",
    rule: "No leftover markers, and every placeholder names a field of the schema.",
    fix: "A placeholder that names no field renders empty: check the template against its schema.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        const marker = email.html.indexOf("[object Object]")
        if (marker >= 0) problem("[object Object] in the output", marker)
        const model = templateOf(context, email)?.model
        if (!model) return
        const missing = new Set(
          placeholders(email.html, model)
            .filter((p) => p.field === "none")
            .map((p) => p.name),
        )
        for (const name of missing) problem(`{{${name}}} names no field of the schema`)
      }),
  },
  {
    id: "html.hidden-text",
    level: "warn",
    rule: "Hidden styling is used only on the preheader.",
    fix: "Hidden text in the body looks like spam to filters and confuses screen readers: remove it or show it.",
    run: (context, report) =>
      eachEmail(context, report, (email, problem) => {
        let preheader = false
        for (const { element, offset, mso, props } of inlineStyles(email.parsed.elements)) {
          if (mso) continue
          const hidden =
            props.get("display") === "none" ||
            props.get("visibility") === "hidden" ||
            /^0(px)?$/.test(props.get("font-size") ?? "") ||
            props.get("opacity") === "0"
          if (!hidden) continue
          if (!preheader && attr(element, "aria-hidden") === "true") {
            preheader = true
            continue
          }
          problem(`A hidden <${element.name}>`, offset)
        }
      }),
  },
]
