// The check engine (P1-140, CHK-01): runs the catalogue over a built project, applies the
// per-id config (CHK-02, CFG-06) and the targets (CHK-05), and shapes every finding (CHK-04).
// The theme's tokens.* findings join as they are.

import { relative } from "node:path"

import type { CheckSetting } from "@email-kit/core"

import type { BuiltProject } from "../compiler/build.ts"
import { CATALOGUE } from "./catalogue/index.ts"
import { parseEmail } from "./parse.ts"
import { type SourceFile, sourceFile } from "./source.ts"
import type { Check, CheckContext, CheckedEmail, Finding, Level, Problem } from "./types.ts"

export const CHECKS_DOCS_URL = "https://github.com/email-kit/email-kit/blob/main/docs/checks.md"

/** GitHub's heading anchor for an id: dots go, hyphens stay (`img.alt` → `#imgalt`). */
export function docsUrl(id: string): string {
  return `${CHECKS_DOCS_URL}#${id.toLowerCase().replace(/[^a-z0-9 _-]/g, "")}`
}

export function contextOf(project: BuiltProject): CheckContext {
  const { config } = project
  const emails: CheckedEmail[] = project.templates.flatMap((template) =>
    template.emails.map((email) => ({
      template: template.id,
      locale: email.locale,
      file: relative(config.dir, `${config.out}/${template.id}/${email.locale}.html`),
      subject: email.subject,
      preheader: email.preheader,
      html: email.html,
      text: email.text,
      parsed: parseEmail(email.html),
    })),
  )
  // Each project file once, with the templates that bundle it.
  const users = new Map<string, string[]>()
  for (const template of project.templates) {
    for (const file of template.sources) users.set(file, [...(users.get(file) ?? []), template.id])
  }
  const sources: SourceFile[] = [...users].map(([file, ids]) => sourceFile(file, config.dir, ids))
  const source = config.theme?.source
  return {
    emails,
    templates: project.templates.map((t) => ({
      id: t.id,
      file: relative(config.dir, t.file),
      fixtures: t.fixtures,
    })),
    sources,
    theme: project.theme,
    themeFindings: project.themeFindings,
    // Classic Outlook stays a target until the targets config (CFG-05).
    outlookClassic: true,
    themeFile: typeof source === "string" ? source : undefined,
  }
}

export function runChecks(
  context: CheckContext,
  settings: Readonly<Record<string, CheckSetting>> = {},
  checks: readonly Check[] = CATALOGUE,
): Finding[] {
  const findings: Finding[] = []
  const levelOf = (id: string, level: Level): Level | "off" => settings[id]?.level ?? level
  for (const check of checks) {
    if (check.outlookClassic && !context.outlookClassic) continue
    if (levelOf(check.id, check.level) === "off") continue
    check.run(context, (problem) => {
      const level = settings[check.id]?.level ?? problem.level ?? check.level
      if (level === "off") return
      findings.push({
        id: check.id,
        level,
        subject: subjectOf(problem),
        message: problem.message,
        fix: problem.fix ?? check.fix,
        docs: docsUrl(check.id),
      })
    })
  }
  for (const finding of context.themeFindings) {
    const level = levelOf(finding.id, finding.level === "warning" ? "warn" : finding.level)
    if (level === "off") continue
    const where = [finding.permutation, finding.mode].filter(Boolean).join(", ")
    findings.push({
      id: finding.id,
      level,
      subject: context.themeFile ? { file: context.themeFile } : {},
      message: where ? `${finding.message} (${where})` : finding.message,
      fix: "Adjust the colour or the role in the theme; `email-kit tokens` lists every pair.",
      docs: docsUrl(finding.id),
    })
  }
  return findings
}

function subjectOf(problem: Problem): Finding["subject"] {
  if (problem.subject) return problem.subject
  if (problem.source) {
    const { file, templates } = problem.source
    const position = problem.at === undefined ? undefined : problem.source.position(problem.at)
    return {
      ...(templates.length === 1 && { template: templates[0] }),
      file,
      ...(position && { line: position.line, column: position.column }),
    }
  }
  const email = problem.email
  if (!email) return {}
  const position = problem.at === undefined ? undefined : email.parsed.position(problem.at)
  return {
    template: email.template,
    locale: email.locale,
    file: email.file,
    ...(position && { line: position.line, column: position.column }),
  }
}
