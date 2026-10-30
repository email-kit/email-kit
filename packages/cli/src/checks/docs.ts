// docs/checks.md, generated from the catalogue (P1-168, CHK-10): one entry per check id, with its
// default level, the rule and the fix. A test keeps the committed page in step.

import { TOKEN_CHECKS } from "../theme/validate.ts"
import { CATALOGUE } from "./catalogue/index.ts"

const LEVEL = { error: "error", warn: "warning", info: "note" } as const
const FAMILIES: readonly [string, string][] = [
  ["tokens", "Theme and tokens"],
  ["html", "Document"],
  ["css", "CSS"],
  ["img", "Images"],
  ["dark", "Dark mode"],
  ["a11y", "Accessibility"],
]

export function checksMarkdown(): string {
  const tokenFix =
    "Adjust the colour or the role in the theme; `email-kit tokens` lists every pair."
  const entries = [
    ...TOKEN_CHECKS.map((check) => ({ ...check, fix: tokenFix })),
    ...CATALOGUE.map(({ id, level, rule, fix, outlookClassic }) => ({
      id,
      level,
      rule: outlookClassic ? `${rule} Runs when classic Outlook is a target.` : rule,
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
