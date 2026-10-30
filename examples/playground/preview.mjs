// Renders every template with each of its fixtures, in every locale, into preview/, with an
// index page to open in a browser. Run with `pnpm preview`, which compiles first.

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"

import { createEmails } from "./email-kit/compiled/index.mjs"

const LOCALES = ["en", "de"]
// The backend passes this once at startup; here, a stand-in.
const emails = createEmails({ siteUrl: "https://playground.example" })
const camel = (id) => id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
const escapeHtml = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])

rmSync("preview", { recursive: true, force: true })
mkdirSync("preview")
const rows = []
for (const file of readdirSync("email-kit/fixtures").sort()) {
  const id = file.replace(/\.json$/, "")
  const fixtures = JSON.parse(readFileSync(`email-kit/fixtures/${file}`, "utf8"))
  for (const [name, data] of Object.entries(fixtures)) {
    for (const locale of LOCALES) {
      const email = emails[camel(id)].render(data, { locale })
      const base = `${id}.${name}.${locale}`
      writeFileSync(`preview/${base}.html`, email.html)
      writeFileSync(
        `preview/${base}.txt`,
        `Subject: ${email.subject}\nPreheader: ${email.preheader}\n\n${email.text}`,
      )
      rows.push(
        `<tr><td>${id}</td><td>${name}</td><td>${locale}</td><td>${escapeHtml(email.subject)}</td>` +
          `<td><a href="${base}.html">HTML</a> · <a href="${base}.txt">text</a></td></tr>`,
      )
    }
  }
}
writeFileSync(
  "preview/index.html",
  `<!doctype html><meta charset="utf-8"><title>email-kit preview</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:2rem}table{border-collapse:collapse}td,th{padding:.3rem .8rem;border-bottom:1px solid #ddd;text-align:left}</style>
<h1>email-kit preview</h1>
<p>Each email as the generated module renders it. Try your system's dark mode: Apple-style dark CSS applies in browsers too.</p>
<table><tr><th>Template</th><th>Fixture</th><th>Locale</th><th>Subject</th><th></th></tr>
${rows.join("\n")}
</table>\n`,
)
console.log(`Wrote ${rows.length} emails to preview/. Open preview/index.html in a browser.`)
