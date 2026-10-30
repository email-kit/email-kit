// P0-09 spike: inline CSS into compiled email-kit HTML (mustache-core placeholders, MSO
// conditionals, VML) with each candidate, check the invariants the pipeline needs, and time it.
// Run with `pnpm bench` (Node 24). `node bench.ts "<candidate>"` also prints that output.

import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { performance } from "node:perf_hooks"
import { fileURLToPath } from "node:url"

import { inline } from "@css-inline/css-inline"
import { parse } from "@email-kit/dialect"
import juice from "juice"

const here = dirname(fileURLToPath(import.meta.url))
const fixture = readFileSync(join(here, "fixture.html"), "utf8")
const store = join(here, "../../node_modules/.pnpm")
const RUNS = 50

const styleText = (html: string) =>
  [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n")

// Swap every tag that sits in text (not in an attribute, a comment or <title>) for a comment,
// the one node an HTML parser leaves in place inside a <table>; the same for the brace entities
// the serialiser writes, which css-inline would otherwise decode. Restore after inlining.
function protect(html: string): { html: string; restore: (out: string) => string } {
  const saved: string[] = []
  let out = ""
  let state: "text" | "tag" | "comment" | "title" = "text"
  let quote = ""
  for (let i = 0; i < html.length; i++) {
    const char = html[i] as string
    if (state === "comment") {
      if (html.startsWith("-->", i)) state = "text"
    } else if (state === "title") {
      if (html.startsWith("</title", i)) state = "tag"
    } else if (state === "tag") {
      if (quote && char === quote) quote = ""
      else if (!quote && (char === '"' || char === "'")) quote = char
      else if (!quote && char === ">") state = /<title\b[^<]*$/.test(out) ? "title" : "text"
    } else if (html.startsWith("<!--", i)) {
      state = "comment"
    } else if (char === "<") {
      state = "tag"
    } else if (
      html.startsWith("{{", i) ||
      html.startsWith("&#123;", i) ||
      html.startsWith("&#125;", i)
    ) {
      const end = html.startsWith("{{", i) ? html.indexOf("}}", i) + 2 : i + 6
      out += `<!--ek:${saved.push(html.slice(i, end)) - 1}-->`
      i = end - 1
      continue
    }
    out += char
  }
  return {
    html: out,
    restore: (inlined) => inlined.replace(/<!--ek:(\d+)-->/g, (_, n) => saved[Number(n)] as string),
  }
}

// Rules that can't be inlined (media queries, client hooks) go into their own block, which juice
// leaves alone when it is marked data-embed. The compiler would write the two blocks directly.
function embedEnhancements(html: string): string {
  const css = styleText(html)
  const enhancements =
    css.match(
      /a\[x-apple-data-detectors\][^}]*\}|\[data-ogsc\][^}]*\}|@media[^{]*\{(?:[^{}]*\{[^}]*\})*\s*\}/g,
    ) ?? []
  const inlinable = enhancements.reduce((rest, rule) => rest.replace(rule, ""), css)
  return html.replace(
    /<style>[\s\S]*?<\/style>/,
    `<style>${inlinable}</style>\n<style data-embed>\n${enhancements.join("\n")}\n</style>`,
  )
}

function withoutCodeBlocks<T>(run: () => T): T {
  const blocks = { ...juice.codeBlocks }
  for (const key of Object.keys(juice.codeBlocks)) delete juice.codeBlocks[key]
  try {
    return run()
  } finally {
    Object.assign(juice.codeBlocks, blocks)
  }
}

const candidates: Record<string, (html: string) => string> = {
  juice: (html) => juice(html, { preserveImportant: true }),
  "juice, code blocks off": (html) =>
    withoutCodeBlocks(() => juice(html, { preserveImportant: true })),
  "juice + data-embed": (html) =>
    juice(embedEnhancements(html), { preserveImportant: true }).replace(/ data-embed(="")?/, ""),
  "css-inline": (html) => inline(html, { keepStyleTags: true, removeInlinedSelectors: true }),
  "css-inline + protect": (html) => {
    const { html: safe, restore } = protect(html)
    return restore(inline(safe, { keepStyleTags: true, removeInlinedSelectors: true }))
  },
}

const COMMENTS = /<!--[\s\S]*?-->/g
const TAGS = /\{\{[^{}]*\}\}/g
const outsideComments = (html: string) => html.replace(COMMENTS, "")
const count = (html: string, needle: string) => html.split(needle).length - 1

const checks: Record<string, (out: string) => boolean> = {
  "doctype kept": (out) => out.startsWith("<!DOCTYPE html>"),
  "MSO comments byte-identical": (out) =>
    (fixture.match(COMMENTS) ?? []).every((comment) => out.includes(comment)),
  "placeholders unchanged": (out) =>
    JSON.stringify(out.match(TAGS)) === JSON.stringify(fixture.match(TAGS)),
  "valid mustache-core": (out) => {
    try {
      parse(out)
      return true
    } catch {
      return false
    }
  },
  "sections stay between rows": (out) =>
    out.includes("{{#items}}<tr>") && out.includes("{{/items}}{{^items}}<tr>"),
  "brace entities kept (no {{{)": (out) =>
    out.includes("&#123;{{code}}&#125;") && !out.includes("{{{"),
  "preheader filler kept": (out) =>
    /Thanks for your order(?:(?:&zwnj;|\u200C)(?:&nbsp;|\u00A0)){3}</.test(out),
  "non-ASCII kept": (out) => out.includes("×") && out.includes("شكرا لك"),
  "no self-closing voids": (out) => !outsideComments(out).includes("/>"),
  "layout attributes kept": (out) =>
    ["cellpadding=", "cellspacing=", 'role="presentation"', "align=", 'width="'].every(
      (attribute) => count(out, attribute) >= count(fixture, attribute),
    ),
  "styles inlined": (out) =>
    /<td class="text"[^>]*style="[^"]*font-size: ?16px/.test(out) &&
    /<h1[^>]*style="[^"]*font-size: ?28px/.test(out) &&
    /<a class="btn"[^>]*style="[^"]*background-color: ?#18181b/.test(outsideComments(out)),
  "inline style wins": (out) => /<td class="text" style="[^"]*padding: ?24px/.test(out),
  "enhancement rules kept": (out) => {
    const css = styleText(out).replace(/\s+/g, " ")
    return [
      "max-width: 600px",
      "prefers-color-scheme",
      "[data-ogsc]",
      "x-apple-data-detectors",
    ].every((rule) => css.includes(rule))
  },
  "lowercase !important, no }}": (out) => {
    const css = styleText(out)
    return !/!\s*important/i.test(css.replace(/ !important/g, "")) && !/\}\}/.test(css)
  },
}

function sizeOf(path: string): number {
  const stat = statSync(path)
  if (!stat.isDirectory()) return stat.size
  return readdirSync(path).reduce((total, name) => total + sizeOf(join(path, name)), 0)
}
function installSize(prefixes: readonly string[]): string {
  const dirs = readdirSync(store).filter((dir) => prefixes.some((prefix) => dir.startsWith(prefix)))
  return `${(dirs.reduce((total, dir) => total + sizeOf(join(store, dir)), 0) / 1e6).toFixed(1)} MB`
}
// juice and its runtime dependency tree, as installed by pnpm.
const JUICE_TREE = [
  ...["juice@", "cheerio", "mensch@", "slick@", "web-resource-inliner@", "htmlparser2@", "parse5"],
  ...["domhandler@", "domutils@", "dom-serializer@", "entities@", "css-select@", "css-what@"],
  ...["nth-check@", "boolbase@", "commander@", "encoding-sniffer@", "whatwg-", "undici@"],
  ...["iconv-lite@", "safer-buffer@"],
]

// A long email: the fixture with 60 extra static rows.
const row =
  '<tr><td class="text cell stack" width="70%">Item × 1</td><td class="text cell stack" align="right">€1.00</td></tr>\n'
const long = fixture.replace("{{#items}}", `${row.repeat(60)}{{#items}}`)

const names = Object.keys(candidates)
const run = (name: string, html: string) => (candidates[name] as (html: string) => string)(html)
const outputs = Object.fromEntries(names.map((name) => [name, run(name, fixture)]))

const only = process.argv[2]
if (only) {
  console.log(outputs[only])
  process.exit(0)
}

console.log(`Node ${process.version}, ${process.platform}-${process.arch}\n`)
console.log(`| Check | ${names.join(" | ")} |`)
console.log(`|---|${names.map(() => "---").join("|")}|`)
for (const [check, test] of Object.entries(checks)) {
  const cells = names.map((name) => (test(outputs[name] as string) ? "✓" : "**✗**"))
  console.log(`| ${check} | ${cells.join(" | ")} |`)
}
const timings = names.map((name) => {
  run(name, long)
  const times: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now()
    run(name, long)
    times.push(performance.now() - start)
  }
  return `${(times.sort((a, b) => a - b)[RUNS / 2] as number).toFixed(1)} ms`
})
console.log(
  `| Long email (${(long.length / 1024).toFixed(0)} KB), warm median | ${timings.join(" | ")} |`,
)
const sizes = names.map((name) =>
  installSize(name.startsWith("juice") ? JUICE_TREE : ["@css-inline+"]),
)
console.log(`| Install size | ${sizes.join(" | ")} |`)
