// The check engine (P1-140), config (P1-160), reporters (P1-161), finding shape (P1-162), the
// parser (P1-165), docs (P1-168), `email-kit check` (P1-169) and the first catalogue (P1-172).
// Every check has a positive case (the fixture's real output passes) and a negative one (the
// same email with exactly one rule broken reports exactly that check).

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { beforeAll, describe, expect, it } from "vitest"

import { CATALOGUE } from "../../src/checks/catalogue/index.ts"
import { checksMarkdown } from "../../src/checks/docs.ts"
import { contextOf, docsUrl, runChecks } from "../../src/checks/engine.ts"
import { parseEmail } from "../../src/checks/parse.ts"
import { formatGithub, formatHuman, formatJson } from "../../src/checks/report.ts"
import type { CheckContext, Finding } from "../../src/checks/types.ts"
import { type BuiltProject, buildProject } from "../../src/compiler/build.ts"
import { loadConfig, resolveConfig } from "../../src/compiler/config.ts"
import { run } from "../../src/run.ts"
import { TOKEN_CHECKS } from "../../src/theme/validate.ts"

const FIXTURE = fileURLToPath(new URL("../fixtures/project/", import.meta.url))
const REPO = fileURLToPath(new URL("../../../../", import.meta.url))

let project: BuiltProject
let context: CheckContext
beforeAll(async () => {
  project = await buildProject(await loadConfig({ cwd: FIXTURE }))
  context = contextOf(project)
})

/** The fixture's English email, changed by `edit`, as the only email to check. */
function mutated(edit: (html: string) => string): CheckContext {
  const email = context.emails.find((e) => e.locale === "en")
  if (!email) throw new Error("no en email")
  const html = edit(email.html)
  if (html === email.html) throw new Error("the edit changed nothing")
  return { ...context, emails: [{ ...email, html, parsed: parseEmail(html) }], themeFindings: [] }
}

const ids = (findings: readonly Finding[]) => [...new Set(findings.map((f) => f.id))].sort()
const once = (search: string, replace: string) => (html: string) => {
  if (!html.includes(search)) throw new Error(`not found: ${search}`)
  return html.replace(search, replace)
}
const inBody = (markup: string) =>
  once('<div style="display:none', `${markup}\n<div style="display:none`)
const inStyle = (css: string) => once("</style>\n</head>", `${css}\n</style>\n</head>`)

describe("the fixture's real output", () => {
  it("passes every check (only theme notes remain)", () => {
    const findings = runChecks(context)
    expect(findings.filter((f) => f.level !== "info")).toEqual([])
    expect(ids(findings.filter((f) => !f.id.startsWith("tokens.")))).toEqual([])
  })
})

describe("each check, with one rule broken", () => {
  const cases: [string, (html: string) => string][] = [
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
    ["css.no-modern-colour", inStyle(".a { color: oklch(0.5 0.1 200); }")],
    ["css.no-custom-props", inStyle(".a { --ink: #000000; }")],
    ["css.style-size", inStyle(`/* ${"x".repeat(17_000)} */`)],
    ["img.alt", inBody('<img src="https://x.test/a.png" width="1" height="1">')],
    ["img.dimensions", inBody('<img src="https://x.test/a.png" alt="" width="50%" height="1">')],
    ["img.https", inBody('<img src="http://x.test/a.png" alt="" width="1" height="1">')],
    ["img.format", inBody('<img src="https://x.test/logo.svg" alt="" width="1" height="1">')],
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
    ["a11y.data-table", inBody("<table><tr><th>Item</th></tr></table>")],
  ]

  it("covers the whole catalogue", () => {
    expect(cases.map(([id]) => id).sort()).toEqual(CATALOGUE.map((c) => c.id).sort())
  })

  it.each(cases)("%s", (id, edit) => {
    expect(ids(runChecks(mutated(edit)))).toEqual([id])
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
      ids(runChecks(mutated(inBody('<img src="{{heroUrl}}" alt="" width="1" height="1">')))),
    ).toEqual([])
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
