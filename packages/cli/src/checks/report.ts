// Reporters (P1-161, CHK-03): human (grouped by template), JSON with a versioned schema, and
// GitHub Actions annotations.

import type { Finding, Level } from "./types.ts"

/** Bump on any breaking change to the JSON shape. */
export const JSON_VERSION = 1

const MARK: Readonly<Record<Level, string>> = { error: "✗", warn: "!", info: "i" }

export function counts(findings: readonly Finding[]): Record<Level, number> {
  const out: Record<Level, number> = { error: 0, warn: 0, info: 0 }
  for (const finding of findings) out[finding.level]++
  return out
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

function where(finding: Finding): string {
  const { file, line, column } = finding.subject
  if (!file) return ""
  return line === undefined ? file : `${file}:${line}:${column ?? 1}`
}

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
      lines.push(`    Docs: ${finding.docs}`)
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

export function formatJson(findings: readonly Finding[]): string {
  return JSON.stringify({ version: JSON_VERSION, summary: counts(findings), findings }, null, 2)
}

// Workflow commands: data escapes %, CR and LF; properties also , and :.
const data = (s: string) => s.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")
const property = (s: string) => data(s).replaceAll(":", "%3A").replaceAll(",", "%2C")

export function formatGithub(findings: readonly Finding[]): string {
  const command: Readonly<Record<Level, string>> = {
    error: "error",
    warn: "warning",
    info: "notice",
  }
  return findings
    .map((finding) => {
      const { file, line, column } = finding.subject
      const props = [
        ...(file ? [`file=${property(file)}`] : []),
        ...(line !== undefined ? [`line=${line}`] : []),
        ...(column !== undefined ? [`col=${column}`] : []),
        `title=${property(finding.id)}`,
      ]
      return `::${command[finding.level]} ${props.join(",")}::${data(`${finding.message}\nFix: ${finding.fix}\nDocs: ${finding.docs}`)}`
    })
    .join("\n")
}
