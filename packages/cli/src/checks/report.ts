import type { Finding, Level } from "./types.ts"

/** The version of the JSON output. Bump it on any breaking change to its shape. */
export const JSON_VERSION = 1

/** The marks findings are listed with, by level. */
const MARK: Readonly<Record<Level, string>> = { error: "✗", warn: "!", info: "i" }

/** How many findings there are of each level. */
export function counts(findings: readonly Finding[]): Record<Level, number> {
  const out: Record<Level, number> = { error: 0, warn: 0, info: 0 }
  for (const finding of findings) out[finding.level]++
  return out
}

/** A count with its word, plural unless it's 1: `2 errors`. */
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

/** Where a finding is, as `file:line:column`, with the fixture of a render. */
function where(finding: Finding): string {
  const { file, line, column, fixture } = finding.subject
  const at = file === undefined ? "" : line === undefined ? file : `${file}:${line}:${column ?? 1}`
  return fixture === undefined ? at : `${at} (rendered with ${fixture})`.trim()
}

/**
 * The findings for a terminal, grouped by template and locale, then the theme and the project,
 * then the counts.
 */
export function formatHuman(findings: readonly Finding[]): string {
  const groups = new Map<string, Finding[]>()
  for (const finding of findings) {
    const { template, locale } = finding.subject
    const group = template
      ? `${template}${locale ? ` (${locale})` : ""}`
      : finding.id.startsWith("tokens.")
        ? "Theme"
        : "Project"
    groups.set(group, [...(groups.get(group) ?? []), finding])
  }
  const lines: string[] = []
  for (const [group, list] of groups) {
    lines.push(group)
    for (const finding of list) {
      const location = where(finding)
      lines.push(`  ${MARK[finding.level]} ${finding.id}${location ? `  ${location}` : ""}`)
      lines.push(`    ${finding.message}`)
      lines.push(`    Fix: ${finding.fix}`)
      if (finding.docs) lines.push(`    Docs: ${finding.docs}`)
    }
    lines.push("")
  }
  const total = counts(findings)
  lines.push(
    findings.length === 0
      ? "No problems found."
      : `${plural(total.error, "error")}, ${plural(total.warn, "warning")}, ${plural(total.info, "note")}`,
  )
  return lines.join("\n")
}

/** The findings as JSON, with a versioned schema and the counts. */
export function formatJson(findings: readonly Finding[]): string {
  return JSON.stringify({ version: JSON_VERSION, summary: counts(findings), findings }, null, 2)
}

/** Escapes a GitHub workflow command's data: `%`, CR and LF. */
const data = (s: string) => s.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")
/** Escapes a workflow command's property, which also escapes `:` and `,`. */
const property = (s: string) => data(s).replaceAll(":", "%3A").replaceAll(",", "%2C")

/** The GitHub Actions workflow command for each level. */
const COMMAND: Readonly<Record<Level, string>> = { error: "error", warn: "warning", info: "notice" }

/** The findings as GitHub Actions annotations, which show on the pull request's diff. */
export function formatGithub(findings: readonly Finding[]): string {
  return findings
    .map((finding) => {
      const { file, line, column } = finding.subject
      const props = [
        ...(file ? [`file=${property(file)}`] : []),
        ...(line !== undefined ? [`line=${line}`] : []),
        ...(column !== undefined ? [`col=${column}`] : []),
        `title=${property(finding.id)}`,
      ]
      const fixture =
        finding.subject.fixture === undefined ? "" : ` (rendered with ${finding.subject.fixture})`
      const docs = finding.docs ? `\nDocs: ${finding.docs}` : ""
      const message = `${finding.message}${fixture}\nFix: ${finding.fix}${docs}`
      return `::${COMMAND[finding.level]} ${props.join(",")}::${data(message)}`
    })
    .join("\n")
}
