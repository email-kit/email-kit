import { defineCheck, defineConfig } from "@email-kit/core"

// A team check (CHK-08): every email links to the help centre. sign-in-code has no help link,
// so `pnpm check` shows this warning for it: try adding one, or turning the check off below.
const helpLink = defineCheck({
  id: "playground.help-link",
  level: "warn",
  rule: "Every email links to the help centre.",
  fix: "Add a Link to https://help.playground.example.",
  run({ emails }, report) {
    for (const email of emails) {
      const hrefs = email.elements("a").map((a) => a.attributes.href ?? "")
      if (!hrefs.some((href) => href.startsWith("https://help.playground.example"))) {
        report({ email, message: "No link to the help centre" })
      }
    }
  },
})

export default defineConfig({
  locales: { default: "en", list: ["en", "de"] },
  // The preview script imports plain JavaScript; TypeScript projects can leave this out.
  module: "mjs",
  platform: {
    productName: "Playground Shop",
    // The footer: who sends the email, where from, and where to get help (research 05 §13)
    legalName: "Playground Shop GmbH",
    postalAddress: "Musterstraße 1, 10115 Berlin, Germany",
    helpUrl: "https://help.playground.example",
    privacyUrl: "https://playground.example/privacy",
    // Differs per environment, so the backend passes it: createEmails({ siteUrl })
    siteUrl: { runtime: true },
  },
  theme: {
    // shadcn CSS: what `npx shadcn init` writes. DTCG token files and resolvers work too.
    source: "theme/globals.css",
  },
  customChecks: [helpLink],
  checks: {
    // Generated output is gitignored here: every script compiles first.
    "output.gitignored": { level: "off", reason: "The playground compiles before every command" },
    // "playground.help-link": { level: "off", reason: "…" },
  },
})
