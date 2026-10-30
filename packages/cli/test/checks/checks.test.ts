// The check engine (P1-140), config (P1-160), reporters (P1-161), finding shape (P1-162), the
// parser (P1-165), docs (P1-168), `email-kit check` (P1-169) and the first catalogue (P1-172).
// Every check has a positive case (the fixture's real output passes) and a negative one (the
// same email with exactly one rule broken reports exactly that check).

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { CATALOGUE } from "../../src/checks/catalogue/index.ts"
import { checksMarkdown } from "../../src/checks/docs.ts"
import { contextOf, docsUrl, runChecks } from "../../src/checks/engine.ts"
import { parseEmail } from "../../src/checks/parse.ts"
import { formatGithub, formatHuman, formatJson } from "../../src/checks/report.ts"
import { sourceFile } from "../../src/checks/source.ts"
import type { CheckContext, CheckedEmail, Finding } from "../../src/checks/types.ts"
import { type BuiltProject, buildProject } from "../../src/compiler/build.ts"
import { loadConfig, resolveConfig } from "../../src/compiler/config.ts"
import { run } from "../../src/run.ts"
import { TOKEN_CHECKS } from "../../src/theme/validate.ts"

const FIXTURE = fileURLToPath(new URL("../fixtures/project/", import.meta.url))
const REPO = fileURLToPath(new URL("../../../../", import.meta.url))
const TMP = fileURLToPath(new URL("../.tmp/checks-test/", import.meta.url))
afterAll(() => rmSync(TMP, { recursive: true, force: true }))

let project: BuiltProject
let context: CheckContext
beforeAll(async () => {
  project = await buildProject(await loadConfig({ cwd: FIXTURE }))
  context = await contextOf(project)
})

/** The fixture's English email, changed by `edit`, as the only email to check. */
function mutated(edit: (html: string) => string): CheckContext {
  return changed((email) => ({ html: edit(email.html) }))
}

type Parts = Pick<CheckedEmail, "html" | "text" | "subject" | "preheader">

/** The fixture's English email with some of its parts changed, as the only email to check. */
function changed(edit: (email: Parts) => Partial<Parts>): CheckContext {
  const email = context.emails.find((e) => e.locale === "en")
  if (!email) throw new Error("no en email")
  const next = { ...email, ...edit(email) }
  if ((["html", "text", "subject", "preheader"] as const).every((k) => next[k] === email[k])) {
    throw new Error("the edit changed nothing")
  }
  return { ...context, emails: [{ ...next, parsed: parseEmail(next.html) }], themeFindings: [] }
}

/** Replaces the subject everywhere it shows: the subject line, <title> and the wrapper label. */
const subject = (to: (s: string) => string) => (email: Parts) => ({
  subject: to(email.subject),
  html: email.html.replaceAll(email.subject, to(email.subject)),
})

/** Replaces the preheader everywhere it shows: the line, the hidden block and the text part. */
const preheader = (to: string) => (email: Parts) => ({
  preheader: to,
  html: email.html.replace(email.preheader, to),
  text: email.text.replace(email.preheader, to),
})

/** The catalogue without output.*, for contexts a test makes up (it has its own tests). */
const WITHOUT_OUTPUT = CATALOGUE.filter((c) => !c.id.startsWith("output."))

const ids = (findings: readonly Finding[]) => [...new Set(findings.map((f) => f.id))].sort()
const once = (search: string, replace: string) => (html: string) => {
  if (!html.includes(search)) throw new Error(`not found: ${search}`)
  return html.replace(search, replace)
}
/** Adds markup to the body, after the hidden preheader (which must stay first). */
const inBody = (markup: string) => (html: string) => {
  const preheader = /aria-hidden="true">[\s\S]*?<\/div>\n/.exec(html)
  if (!preheader) throw new Error("no preheader")
  const at = preheader.index + preheader[0].length
  return `${html.slice(0, at)}${markup}\n${html.slice(at)}`
}
const inStyle = (css: string) => once("</style>\n</head>", `${css}\n</style>\n</head>`)
/** A text cell's styles that pass css.line-height-px. */
const CELL = "margin:0;line-height:20px;mso-line-height-rule:exactly"

describe("the fixture's real output", () => {
  it("passes every check (only theme notes remain)", () => {
    const findings = runChecks(context)
    expect(findings.filter((f) => f.level !== "info")).toEqual([])
    expect(ids(findings.filter((f) => !f.id.startsWith("tokens.")))).toEqual([])
  })
})

describe("each check, with one rule broken", () => {
  // [check, edit, other checks the same edit trips by design]
  const cases: [string, (html: string) => string, string[]?][] = [
    ["html.doctype", once("<!DOCTYPE html>\n", "")],
    ["html.lang-dir", once('lang="en" dir="ltr" style=', 'lang="en" dir="rtl" style=')],
    ["html.title", once("<title>Order", "<title>Your order")],
    ["html.xmlns", once(' xmlns:o="urn:schemas-microsoft-com:office:office"', "")],
    ["html.no-forms-embeds", inBody('<form action="https://x.test"></form>')],
    ["html.no-body-style", inBody("<style>p { margin: 0; }</style>")],
    ["html.data-detectors", (h) => h.replace(/a\[x-apple-data-detectors\][^\n]*\n/, "")],
    ["html.mso-font", (h) => h.replace(/<!--\[if mso\]><style>[^\n]*\n/, "")],
    ["html.dpi-noscript", (h) => h.replace("<noscript>", "").replace("</noscript>", "")],
    ["css.no-double-brace", once("!important; }\n}", "!important; }}")],
    [
      "css.important-lowercase",
      once("color-scheme: light dark; }", "color-scheme: light dark !IMPORTANT; }"),
    ],
    ["css.no-nesting", inStyle(".a { .b { color: #000000; } }")],
    ["css.no-modern-colour", inStyle(".a { color: oklch(0.5 0.1 200); }"), ["css.colour-hex"]],
    ["css.no-custom-props", inStyle(".a { --ink: #000000; }")],
    ["css.style-size", inStyle(`/* ${"x".repeat(17_000)} */`)],
    ["img.alt", inBody('<img src="https://x.test/a.png" width="1" height="1">')],
    ["img.dimensions", inBody('<img src="https://x.test/a.png" alt="" width="50%" height="1">')],
    ["img.https", inBody('<img src="http://x.test/a.png" alt="" width="1" height="1">')],
    [
      "img.format",
      inBody('<img src="https://x.test/logo.svg" alt="" width="1" height="1">'),
      ["html.no-svg"],
    ],
    [
      "img.fluid-width",
      inBody('<img src="https://x.test/a.png" alt="" width="1" height="1" style="max-width:100%">'),
    ],
    [
      "dark.scheme-declared",
      (h) =>
        h
          .replace(/<meta name="color-scheme"[^\n]*\n/, "")
          .replace(":root { color-scheme: light dark; }\n", ""),
    ],
    ["dark.ogsc-twin", (h) => h.replace(/\[data-ogsc\] \.ek-c--ink \{[^\n]*\n/, "")],
    [
      "dark.light-only-css-twin",
      (h) =>
        h
          .replace('content="light dark"', 'content="light only"')
          .replace(":root { color-scheme: light dark; }", ":root { color-scheme: light; }"),
    ],
    ["dark.no-blend-hack", inStyle("u + .body .a { color: #000000; }")],
    [
      "a11y.layout-table-role",
      once('<table role="presentation" width="100%"><tbody>', '<table width="100%"><tbody>'),
    ],
    ["a11y.data-table", inBody("<table><tr><th>Item</th></tr></table>"), ["css.line-height-px"]],
    ["html.wrapper-aria", (h) => h.replace(/ aria-label="[^"]*"/, "")],
    ["html.meta", (h) => h.replace(/<meta name="format-detection"[^>]*>\n/, "")],
    [
      "html.body-bare",
      once('<body xml:lang="en" style', '<body xml:lang="en" bgcolor="#ffffff" style'),
    ],
    ["html.no-external", inStyle("@import url(https://x.test/a.css);")],
    ["html.no-svg", inBody("<svg></svg>"), ["html.no-forms-embeds"]],
    ["html.no-comments", inBody(`<!-- ${"internal note ".repeat(10)} -->`)],
    ["html.no-unresolved", inBody(`<p style="${CELL}">{{customerNam}}</p>`)],
    ["html.hidden-text", inBody(`<p style="display:none;mso-hide:all;${CELL}">Secret</p>`)],
    ["css.colour-hex", inStyle(".a { color: #fff; }")],
    ["css.no-alpha", inStyle(".a { opacity: 0.5; }")],
    ["css.banned-layout", inStyle(".a { display: flex; }")],
    ["css.media-allowlist", inStyle("@media (hover: hover) { .a { margin: 0; } }")],
    ["css.inline-parse", inBody('<div style="margin:0;color`red"></div>')],
    [
      "css.gradient-fallback",
      inBody('<div style="background-image:url(https://x.test/a.png)"></div>'),
    ],
    ["css.units", inBody('<div style="padding:1rem"></div>')],
    ["css.hide-mso", inBody('<div style="display:none"></div>'), ["html.hidden-text"]],
    ["css.line-height-px", inBody("<p>Plain</p>")],
    ["layout.ghost-table", once('align="center" width="600"', 'align="center" width="640"')],
    ["a11y.one-h1", inBody(`<h1 style="${CELL}">Another heading</h1>`)],
    ["a11y.link-text", inBody('<a href="https://x.test/"></a>'), ["text.links-match"]],
    ["a11y.font-size", inBody(`<p style="${CELL};font-size:10px">Tiny</p>`)],
    ["a11y.viewport", once('initial-scale=1"', 'initial-scale=1, user-scalable=no"')],
    [
      "link.dangerous-schemes",
      inBody('<a href="javascript:alert(1)">Track the parcel</a>'),
      ["text.links-match", "text.urls-full"],
    ],
    ["link.url-fields", inBody('<a href="{{customerName}}">Track the parcel</a>')],
  ]
  // The same, for checks of the text part, the subject and the preheader.
  const parts: [string, (email: Parts) => Partial<Parts>, string[]?][] = [
    // A stub text part breaks the rest of the text part's rules too.
    [
      "text.present",
      () => ({ text: "Short." }),
      ["text.links-match", "text.parity", "text.preheader-first"],
    ],
    ["text.no-markup", (e) => ({ text: `${e.text}<b>bold</b>\n` })],
    ["text.no-entities", (e) => ({ text: `${e.text}Caf&eacute;\n` })],
    ["text.wrap-78", (e) => ({ text: `${e.text}${"word ".repeat(20)}\n` })],
    [
      "text.urls-full",
      (e) => ({
        html: inBody(`<a href="/relative">Track the parcel</a>`)(e.html),
        text: `${e.text}Track the parcel: /relative\n`,
      }),
      ["link.url-fields"],
    ],
    ["text.links-match", (e) => ({ text: `${e.text}https://unlinked.test/page\n` })],
    [
      "text.parity",
      (e) => ({
        text: `${e.preheader}\n\n${"lorem ipsum dolor\n".repeat(10)}\n{{orderUrl}}\n{{_ek.context.siteUrl}}\n`,
      }),
    ],
    ["text.preheader-first", (e) => ({ text: e.text.slice(e.preheader.length).trimStart() })],
    ["text.no-preheader-padding", (e) => ({ text: `${e.text}\u200c\n` })],
    ["text.no-decorative-runs", (e) => ({ text: `${e.text}\n*****\n` })],
    [
      "preheader.first",
      (e) => ({ html: e.html.replace(/<div style="display:none[^>]*>[\s\S]*?<\/div>\n/, "") }),
      ["preheader.padding"],
    ],
    ["preheader.not-subject", (e) => subject(() => e.preheader)(e)],
    ["preheader.padding", (e) => ({ html: e.html.replaceAll("&#8199;&#65279;&#847;", "") })],
    ["preheader.no-boilerplate", preheader("View this email in your browser")],
    ["subject.no-fake-reply", subject((s) => `Re: ${s}`)],
    ["subject.generic", subject(() => "Update")],
  ]

  it.each(parts)("%s", (id, edit, also = []) => {
    expect(ids(runChecks(changed(edit)))).toEqual([id, ...also].sort())
  })

  it("subject.no-secret: a secret field in the subject", () => {
    const template = context.templates.find((t) => t.id === "order-confirmation")
    const model = template && {
      ...template.model,
      properties: (template.model.properties ?? []).map((p) =>
        p.name === "orderNumber" ? { ...p, field: { ...p.field, secret: true as const } } : p,
      ),
    }
    if (!template || !model) throw new Error("no template")
    const edited = { ...mutated((h) => `${h} `), templates: [{ ...template, model }] }
    expect(ids(runChecks(edited))).toEqual(["subject.no-secret"])
  })

  it.each([
    ["no <h1>", (html: string) => html.replace(/<(\/?)h1\b/g, "<$1h2")],
    ["generic link text", inBody('<a href="{{orderUrl}}">Click here</a>')],
    ["13px text", inBody(`<p style="${CELL};font-size:13px">Small</p>`)],
  ])("warns, not errs, on %s", (_, edit) => {
    const findings = runChecks(mutated(edit))
    expect(findings.map((f) => [f.id, f.level])).toEqual([
      [expect.stringMatching(/^a11y\./), "warn"],
    ])
  })

  it("link.url-fields: a literal URL that isn't https, and a url field passes", () => {
    const literal = mutated(inBody('<a href="http://x.test/">Track the parcel</a>'))
    expect(ids(runChecks(literal))).toEqual(["link.url-fields", "text.links-match"])
    expect(runChecks(mutated(inBody('<a href="{{orderUrl}}">Track the parcel</a>')))).toEqual([])
  })

  it("text.preheader-first: a long preheader that wraps in the text part still counts", () => {
    const long = `${"Your order has shipped and is on its way ".repeat(2).trim()}.`
    const edited = changed((e) => ({
      preheader: long,
      html: e.html.replace(e.preheader, long),
      text: e.text.replace(e.preheader, long.replace("its way Your", "its way\nYour")),
    }))
    expect(ids(runChecks(edited))).not.toContain("text.preheader-first")
  })

  it("link.dangerous-schemes: sees through whitespace and case", () => {
    const edit = inBody('<a href=" Java&#9;Script:alert(1)">Track the parcel</a>')
    expect(ids(runChecks(mutated(edit)))).toContain("link.dangerous-schemes")
  })

  it("covers every check of the compiled output", () => {
    // Source, render-only, pseudo-locale, output-folder and compiler checks have their own tests.
    const covered = [...cases, ...parts].map(([id]) => id).concat("subject.no-secret")
    const output = CATALOGUE.filter(
      (c) => !/^(source|i18n|output)\./.test(c.id) && c.on !== "render" && !c.compiler,
    )
    expect(covered.sort()).toEqual(output.map((c) => c.id).sort())
  })

  it.each(cases)("%s", (id, edit, also = []) => {
    expect(ids(runChecks(mutated(edit)))).toEqual([id, ...also].sort())
  })

  it("points at the line and column, in the compiled file", () => {
    const edited = mutated(inBody('<img src="http://x.test/a.png" alt="" width="1" height="1">'))
    const [finding] = runChecks(edited)
    const lines = edited.emails[0]?.html.split("\n") ?? []
    const line = lines.findIndex((l) => l.startsWith('<img src="http://')) + 1
    expect(finding?.subject).toEqual({
      template: "order-confirmation",
      locale: "en",
      file: "src/email-kit/compiled/order-confirmation/en.html",
      line,
      column: 1,
    })
    expect(finding?.docs).toBe(
      "https://github.com/email-kit/email-kit/blob/main/docs/checks.md#imghttps",
    )
  })

  it("parses the HTML Word reads inside [if mso] comments", () => {
    const parsed = context.emails.find((e) => e.locale === "en")?.parsed
    const dpi = parsed?.elements.find((e) => e.node.name === "o:pixelsperinch")
    expect(dpi?.mso).toBe(true)
    expect(parsed?.styles.filter((s) => s.mso)).toHaveLength(1)
  })

  it("skips the MSO checks when classic Outlook isn't a target", () => {
    const edited = mutated((h) => h.replace(/<!--\[if mso\]><style>[^\n]*\n/, ""))
    expect(ids(runChecks({ ...edited, outlookClassic: false }))).toEqual([])
  })

  it("leaves data-driven image URLs to the fixture sweep", () => {
    expect(
      ids(runChecks(mutated(inBody('<img src="{{orderUrl}}" alt="" width="1" height="1">')))),
    ).toEqual([])
  })
})

describe("source checks (UI-01)", () => {
  let n = 0
  /** A context whose only source is this TSX, and no emails. */
  const sources = (tsx: string) => {
    mkdirSync(TMP, { recursive: true })
    const path = join(TMP, `t${n++}.tsx`)
    writeFileSync(path, tsx)
    return {
      ...context,
      emails: [],
      themeFindings: [],
      sources: [sourceFile(path, TMP, ["welcome"])],
    }
  }
  const found = (tsx: string) => runChecks(sources(tsx)).map((f) => `${f.id}: ${f.message}`)

  it("scans the fixture's template and its user component", () => {
    expect(context.sources.map((s) => s.file).sort()).toEqual([
      "src/email-kit/components/Card.tsx",
      "src/email-kit/templates/order-confirmation.tsx",
    ])
    expect(context.sources.find((s) => s.file.endsWith("Card.tsx"))?.templates).toEqual([
      "order-confirmation",
    ])
  })

  it.each([
    [
      '<p style={{ color: "#333333" }} />',
      "source.no-literal-colour: `color` uses the literal colour #333333",
    ],
    [
      '<p style={{ border: "1px solid red" }} />',
      "source.no-literal-colour: `border` uses the literal colour red",
    ],
    [
      "<p style={{ color: `#fff` }} />",
      "source.no-literal-colour: `color` uses the literal colour #fff",
    ],
    [
      '<td bgcolor="#ffffff" />',
      'source.no-literal-colour: `bgcolor="#ffffff"` is a literal colour',
    ],
    [
      'const S = { backgroundColor: "rgb(0, 0, 0)" }\nconst x = <td style={S} />',
      "source.no-literal-colour: `backgroundColor` uses the literal colour rgb()",
    ],
    [
      '<p style={{ margin: 0, ...(dark ? { color: "navy" } : {}) }} />',
      "source.no-literal-colour: `color` uses the literal colour navy",
    ],
    [
      '<p style={{ "background-color": "oklch(0.5 0.1 200)" }} />',
      "source.no-literal-colour: `background-color` uses the literal colour oklch()",
    ],
    [
      '<p style={{ fontFamily: "Georgia, serif" }} />',
      "source.no-font-family: `fontFamily` is set directly",
    ],
    ['<font face="Arial">x</font>', "source.no-font-family: `face` sets a font directly"],
    ["<p style={{ fontSize: 12 }} />", "source.no-font-size: `fontSize` is a literal size"],
    ['<p style={{ fontSize: "12px" }} />', "source.no-font-size: `fontSize` is a literal size"],
  ])("flags %s", (tsx, finding) => {
    expect(found(tsx)).toEqual([finding])
  })

  it("leaves roles, data, anchors and computed values alone", () => {
    const tsx = [
      'const fixtures = { shirt: { color: "Red", items: [{ background: "#000000" }] } }',
      'const a = <a href="#top" title="Red shirt" style={{ color: role("link"), textDecoration: "underline" }} />',
      'const b = <td style={{ backgroundColor: "transparent", border: "0", fontSize: size, ...font("body") }} />',
      'const c = <p style={{ color: "currentColor" }}>Navy blue</p>',
    ].join("\n")
    expect(found(tsx)).toEqual([])
  })

  it("points at the property's line and column", () => {
    const line = 'const y = <p style={{ margin: 0, color: "#333333" }} />'
    const context = sources(`const x = 1\n${line}`)
    const [finding] = runChecks(context)
    expect(finding?.subject).toEqual({
      template: "welcome",
      file: context.sources[0]?.file,
      line: 2,
      column: line.indexOf("color") + 1,
    })
  })

  it("allows 0 or 1px font sizes, the spacer-cell technique", () => {
    expect(found('<td style={{ fontSize: "1px", lineHeight: "24px" }} />')).toEqual([])
  })

  it("passes on email-kit's own components (P1-120)", () => {
    const dir = `${REPO}packages/components/src/`
    const files = readdirSync(dir).filter((name) => name.endsWith(".tsx"))
    expect(files.length).toBeGreaterThan(10)
    const all = files.map((name) => sourceFile(`${dir}${name}`, REPO, ["components"]))
    expect(runChecks({ ...context, emails: [], themeFindings: [], sources: all })).toEqual([])
  })

  it("requires a fixture per template", () => {
    const findings = runChecks(
      {
        ...context,
        emails: [],
        sources: [],
        themeFindings: [],
        templates: [
          {
            id: "welcome",
            file: "src/email-kit/templates/welcome.tsx",
            fixtures: [],
            model: { type: "object", nullable: false, properties: [] },
          },
        ],
      },
      {},
      WITHOUT_OUTPUT,
    )
    expect(findings.map((f) => [f.id, f.subject])).toEqual([
      [
        "source.fixture-exists",
        { template: "welcome", file: "src/email-kit/templates/welcome.tsx" },
      ],
    ])
  })
})

describe("the checks config (CFG-06)", () => {
  const file = `${FIXTURE}email-kit.config.ts`
  const resolve = (checks: unknown) =>
    resolveConfig({ checks }, { file, cacheDir: `${FIXTURE}.cache` })

  it("changes a level or turns a check off, with a reason", () => {
    const edited = mutated(
      inBody('<img src="https://x.test/a.png" alt="" width="1" height="1" style="max-width:100%">'),
    )
    const settings = resolve({
      "img.fluid-width": { level: "error", reason: "Our clients need it" },
    }).checks
    expect(runChecks(edited, settings).map((f) => f.level)).toEqual(["error"])
    const off = resolve({
      "img.fluid-width": { level: "off", reason: "Fixed-width heroes by design" },
    }).checks
    expect(runChecks(edited, off)).toEqual([])
  })

  it("rejects a setting without a reason, an unknown level, and an unknown id", () => {
    expect(() =>
      resolve({
        "img.alt": { level: "off" },
        "img.https": { level: "never", reason: "x" },
        "img.alts": { level: "off", reason: "x" },
      }),
    ).toThrow(
      [
        '  • checks.img.alt.reason: say why this check is set to "off"; reviewers read it',
        '  • checks.img.https.level: must be one of "off", "info", "warn", "error"',
        "  • checks.img.alts: unknown check (did you mean img.alt?)",
      ].join("\n"),
    )
  })

  it("knows the tokens.* ids too", () => {
    expect(
      resolve({ "tokens.gmail-fill": { level: "off", reason: "Brand fill" } }).checks,
    ).toHaveProperty("tokens.gmail-fill")
  })
})

describe("reporters", () => {
  const findings: Finding[] = [
    {
      id: "img.alt",
      level: "error",
      subject: {
        template: "welcome",
        locale: "en",
        file: "out/welcome/en.html",
        line: 12,
        column: 5,
      },
      message: "An <img> has no alt; readers announce its file name",
      fix: 'Describe what the image says, or use alt="" for decoration.',
      docs: docsUrl("img.alt"),
    },
    {
      id: "img.fluid-width",
      level: "warn",
      subject: {
        template: "welcome",
        locale: "en",
        file: "out/welcome/en.html",
        line: 20,
        column: 1,
      },
      message: "An <img> has max-width:100% without width:100%",
      fix: "Give width:100% too.",
      docs: docsUrl("img.fluid-width"),
    },
    {
      id: "tokens.gmail-fill",
      level: "info",
      subject: { file: "app/globals.css" },
      message: "The primary fill #e5e5e5 is light, 50%: a, b",
      fix: "Adjust the colour.",
      docs: docsUrl("tokens.gmail-fill"),
    },
  ]

  it("human: grouped by template, with location, fix and docs", async () => {
    await expect(formatHuman(findings)).toMatchFileSnapshot("../__golden__/checks/human.txt")
    expect(formatHuman([])).toBe("No problems found.")
  })

  it("json: a versioned schema", async () => {
    const json = JSON.parse(formatJson(findings))
    expect(json.version).toBe(1)
    expect(json.summary).toEqual({ error: 1, warn: 1, info: 1 })
    await expect(formatJson(findings)).toMatchFileSnapshot("../__golden__/checks/report.json")
  })

  it("github: workflow annotations with escaped properties and data", async () => {
    await expect(formatGithub(findings)).toMatchFileSnapshot("../__golden__/checks/github.txt")
    expect(formatGithub(findings)).toContain(
      "::notice file=app/globals.css,title=tokens.gmail-fill::The primary fill #e5e5e5 is light, 50%25: a, b%0AFix:",
    )
  })
})

describe("email-kit check", () => {
  const capture = () => {
    const out: string[] = []
    const err: string[] = []
    return {
      io: { cwd: FIXTURE, out: (t: string) => out.push(t), err: (t: string) => err.push(t) },
      out,
      err,
    }
  }

  it("exits 0 with notes only, and prints JSON on --json", async () => {
    const { io, out } = capture()
    expect(await run(["check", "--json"], io)).toBe(0)
    const report = JSON.parse(out.join("\n"))
    expect(report.summary.error).toBe(0)
    expect(report.findings.every((f: Finding) => f.id.startsWith("tokens."))).toBe(true)
  })

  it("rejects an unknown reporter", async () => {
    const { io, err } = capture()
    expect(await run(["check", "--reporter", "xml"], io)).toBe(1)
    expect(err.join("")).toContain('Unknown reporter "xml" (known: human, json, github)')
  })

  it("writes nothing", async () => {
    const before = readFileSync(`${FIXTURE}src/email-kit/compiled/manifest.json`, "utf8")
    await run(["check"], capture().io)
    expect(readFileSync(`${FIXTURE}src/email-kit/compiled/manifest.json`, "utf8")).toBe(before)
  })
})

describe("docs/checks.md (P1-168)", () => {
  it("is generated from the catalogue, one entry per id", async () => {
    await expect(checksMarkdown()).toMatchFileSnapshot(`${REPO}docs/checks.md`)
    const headings = [...checksMarkdown().matchAll(/^### (\S+)$/gm)].map((m) => m[1])
    expect(headings.sort()).toEqual([...CATALOGUE, ...TOKEN_CHECKS].map((c) => c.id).sort())
  })

  it("lists every tokens.* id the theme checks can report", () => {
    const source = readFileSync(`${REPO}packages/cli/src/theme/validate.ts`, "utf8")
    const used = new Set([...source.matchAll(/"(tokens\.[a-z-]+)"/g)].map((m) => m[1]))
    expect([...used].sort()).toEqual(TOKEN_CHECKS.map((c) => c.id).sort())
  })
})
