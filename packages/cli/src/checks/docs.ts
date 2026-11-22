import { TOKEN_CHECKS, TOKEN_FIX } from "../theme/validate/index.ts"
import { CATALOGUE } from "./catalogue/index.ts"

/** How the page names each level. */
const LEVEL = { error: "error", warn: "warning", info: "note" } as const

/** The page's sections: each id family and its heading, in page order. */
const FAMILIES: readonly [string, string][] = [
  ["tokens", "Theme and tokens"],
  ["source", "Sources"],
  ["html", "Document"],
  ["layout", "Layout"],
  ["css", "CSS"],
  ["img", "Images"],
  ["dark", "Dark mode"],
  ["a11y", "Accessibility"],
  ["link", "Links"],
  ["legal", "Legal"],
  ["i18n", "Internationalisation"],
  ["text", "Text part"],
  ["preheader", "Preheader"],
  ["subject", "Subject"],
  ["copy", "Copy"],
  ["size", "Size"],
  ["output", "Output"],
  ["agents", "AI coding agents"],
]

/**
 * The checks reference page, generated from the catalogue: one entry for each check id, with its
 * default level, rule and fix. A test keeps the committed page in step.
 */
export function checksMarkdown(): string {
  const entries = [
    ...TOKEN_CHECKS.map((check) => ({ ...check, fix: TOKEN_FIX })),
    ...CATALOGUE.map(({ id, level, rule, fix, outlookClassic, on, compiler }) => ({
      id,
      level,
      rule: [
        rule,
        ...(outlookClassic ? ["Runs when classic Outlook is a target."] : []),
        ...(on === "render" ? ["Runs on the renders of every fixture and generated variant."] : []),
        ...(on === "both" ? ["Also runs on the renders, for values that come from data."] : []),
        ...(compiler
          ? [
              `Enforced when compiling: the compile fails with ${compiler.codes.map((c) => `\`${c}\``).join(" or ")}, which \`email-kit check\` reports as this check.`,
            ]
          : []),
      ].join(" "),
      fix,
    })),
  ]
  const lines = [
    "# Checks",
    "",
    "<!-- Generated from packages/cli/src/checks: run `pnpm --filter @email-kit/cli test -u` after changing a check. -->",
    "",
    "`email-kit check` runs these over the compiled emails and the theme. Change a level per project",
    "with a reason a reviewer will read:",
    "",
    "```ts",
    'checks: { "img.fluid-width": { level: "off", reason: "Hero images are fixed width by design" } }',
    "```",
  ]
  lines.push(
    "",
    "## Team checks",
    "",
    "Add your own rules with `defineCheck()` in `customChecks`. They run with the catalogue, take",
    "levels from `checks`, and show in every reporter. Use a family of your own for the id.",
    "",
    "```ts",
    'import { defineCheck, defineConfig } from "@email-kit/core"',
    "",
    "const helpLink = defineCheck({",
    '  id: "acme.help-link",',
    '  level: "warn",',
    '  rule: "Every email links to the help centre.",',
    '  fix: "Add the footer\'s help link.",',
    "  run({ emails }, report) {",
    "    for (const email of emails) {",
    '      const hrefs = email.elements("a").map((a) => a.attributes.href ?? "")',
    '      if (!hrefs.some((href) => href.startsWith("https://help.acme.com"))) {',
    '        report({ email, message: "No link to the help centre" })',
    "      }",
    "    }",
    "  },",
    "})",
    "",
    "export default defineConfig({ customChecks: [helpLink] })",
    "```",
    "",
    "Each email has `template`, `locale`, `subject`, `preheader`, `html`, `text` and",
    '`elements(name?)`. Set `on: "render"` to check the renders of every fixture and generated',
    "variant instead of the compiled templates (each render then has `fixture`), or `both`.",
  )
  for (const [family, title] of FAMILIES) {
    lines.push("", `## ${title}`)
    for (const entry of entries.filter((e) => e.id.startsWith(`${family}.`))) {
      lines.push(
        "",
        `### ${entry.id}`,
        `**Default:** ${LEVEL[entry.level]}`,
        "",
        `**Rule:** ${entry.rule}`,
        "",
        `**Fix:** ${entry.fix}`,
      )
    }
  }
  return `${lines.join("\n")}\n`
}
