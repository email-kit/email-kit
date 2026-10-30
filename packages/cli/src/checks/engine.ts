// The check engine (P1-140, CHK-01): runs the catalogue over a built project, applies the
// per-id config (CHK-02, CFG-06) and the targets (CHK-05), and shapes every finding (CHK-04).
// Checks see the compiled templates, the renders of the fixture sweep (CHK-06), or both. The
// theme's tokens.* findings join as they are.

import { spawnSync } from "node:child_process"
import { relative } from "node:path"

import type { CheckSetting } from "@email-kit/core"
import { isEmailKitError } from "@email-kit/core/internal"
import { createTemplate } from "@email-kit/dialect/module"

import { type BuiltProject, outputFiles } from "../compiler/build.ts"
import type { CompiledEmail } from "../compiler/compile.ts"
import { modelOf } from "../compiler/emit/types.ts"
import { fixturesWithVariants } from "../compiler/fixtures.ts"
import { CompileError } from "../compiler/problems.ts"
import { pluralRules } from "../i18n/plurals.ts"
import { isPseudo } from "../i18n/pseudo.ts"
import { CATALOGUE } from "./catalogue/index.ts"
import { parseEmail } from "./parse.ts"
import { type SourceFile, sourceFile } from "./source.ts"
import type { Check, CheckContext, CheckedEmail, Finding, Level, Problem } from "./types.ts"

export const CHECKS_DOCS_URL = "https://github.com/email-kit/email-kit/blob/main/docs/checks.md"

/** GitHub's heading anchor for an id: dots go, hyphens stay (`img.alt` → `#imgalt`). */
export function docsUrl(id: string): string {
  return `${CHECKS_DOCS_URL}#${id.toLowerCase().replace(/[^a-z0-9 _-]/g, "")}`
}

/** A stand-in for a platform value the backend passes at send time. */
function contextValue(key: string): string {
  return /url|link|href/i.test(key) ? "https://example.test/" : `Example ${key}`
}

export async function contextOf(project: BuiltProject): Promise<CheckContext> {
  const { config } = project
  const fileOf = (id: string, locale: string) =>
    relative(config.dir, `${config.out}/${id}/${locale}.html`)
  const checked = (id: string, email: CompiledEmail): CheckedEmail => ({
    template: id,
    locale: email.locale,
    file: fileOf(id, email.locale),
    subject: email.subject,
    preheader: email.preheader,
    html: email.html,
    text: email.text,
    parsed: parseEmail(email.html),
  })
  const emails = project.templates.flatMap((t) => t.emails.map((email) => checked(t.id, email)))
  const pseudo = project.templates.flatMap((t) =>
    t.pseudo.flatMap((build) => (build.email ? [checked(t.id, build.email)] : [])),
  )
  const pseudoErrors = project.templates.flatMap((t) =>
    t.pseudo.flatMap((build) =>
      build.error === undefined
        ? []
        : [{ template: t.id, locale: build.locale, message: build.error }],
    ),
  )

  // The fixture sweep (P1-164): each template × locale rendered the way the generated module
  // renders it, with every fixture and generated variant.
  const values = Object.fromEntries(config.platform.runtime.map((key) => [key, contextValue(key)]))
  const rendered: CheckedEmail[] = []
  for (const template of project.templates) {
    const parts = Object.fromEntries(
      template.emails.map((e) => [
        e.locale,
        { subject: e.subject, preheader: e.preheader, html: e.html, text: e.text },
      ]),
    )
    const runtime = createTemplate(
      template.id,
      template.purpose,
      modelOf(template.model),
      config.locales,
      parts,
      values,
      false,
      Object.fromEntries(config.locales.map((locale) => [locale, pluralRules(locale).category])),
    )
    const fixtures = await fixturesWithVariants(template.schema, template.model, template.fixtures)
    for (const fixture of fixtures) {
      for (const locale of config.locales) {
        const email = runtime.render(fixture.data, { locale })
        rendered.push({
          template: template.id,
          locale,
          file: fileOf(template.id, locale),
          subject: email.subject,
          preheader: email.preheader,
          html: email.html,
          text: email.text,
          parsed: parseEmail(email.html),
          fixture: fixture.name,
        })
      }
    }
  }

  // Each project file once, with the templates that bundle it.
  const users = new Map<string, string[]>()
  for (const template of project.templates) {
    for (const file of template.sources) users.set(file, [...(users.get(file) ?? []), template.id])
  }
  const sources: SourceFile[] = [...users].map(([file, ids]) => sourceFile(file, config.dir, ids))
  const source = config.theme?.source
  return {
    emails,
    rendered,
    pseudo,
    pseudoErrors,
    messages: project.templates.flatMap((t) => {
      const used = new Set(t.emails.flatMap((email) => email.messageKeys))
      return t.localeMessages.map((m) => ({
        template: t.id,
        locale: m.locale,
        file: relative(config.dir, m.file),
        messages: m.messages,
        used,
      }))
    }),
    output: {
      dir: relative(config.dir, config.out),
      absolute: config.out,
      expected: outputFiles(project),
      gitignored:
        spawnSync("git", ["check-ignore", "-q", config.out], { cwd: config.dir }).status === 0,
    },
    templates: project.templates.map((t) => ({
      id: t.id,
      model: t.model,
      file: relative(config.dir, t.file),
      fixtures: Object.keys(t.fixtures),
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
    const on = check.on ?? "template"
    const passes: CheckContext[] = [
      ...(on === "render" ? [] : [context]),
      ...(on === "template" ? [] : [{ ...context, emails: context.rendered }]),
      // i18n.expansion: the pseudo-locales pass the static checks too.
      ...(on === "render" || context.pseudo.length === 0
        ? []
        : [{ ...context, emails: context.pseudo }]),
    ]
    for (const pass of passes) {
      check.run(pass, (problem) => {
        const level = settings[check.id]?.level ?? problem.level ?? check.level
        if (level === "off") return
        findings.push({
          id: check.id,
          level,
          subject: subjectOf(problem),
          message: problem.message,
          fix: problem.fix ?? check.fix,
          docs: check.docs ?? docsUrl(check.id),
        })
      })
    }
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
  // A static problem shows in the template and in every render: keep the first, which has the
  // line number. Problems that come from data differ per fixture and stay.
  const seen = new Set<string>()
  const located = new Set(
    findings
      .filter((f) => f.subject.fixture === undefined)
      .map(
        (f) => `${f.id}|${f.subject.template}|${f.subject.locale}|${f.subject.file}|${f.message}`,
      ),
  )
  // A pseudo-locale finding the real locales already have adds nothing: keep only the new ones.
  const real = new Set(
    findings
      .filter((f) => !isPseudo(f.subject.locale ?? ""))
      .map((f) => `${f.id}|${f.subject.template}|${f.message}`),
  )
  return findings.filter((f) => {
    if (
      isPseudo(f.subject.locale ?? "") &&
      !context.emails.some((e) => e.locale === f.subject.locale)
    ) {
      if (real.has(`${f.id}|${f.subject.template}|${f.message}`)) return false
    }
    const base = `${f.id}|${f.subject.template}|${f.subject.locale}|${f.subject.file}|${f.message}`
    // A render repeats a static problem the template already shows, with its line: drop it.
    if (f.subject.fixture !== undefined && located.has(base)) return false
    const key = `${base}|${f.subject.line}|${f.subject.column}|${f.subject.fixture}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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
  const base = { template: email.template, locale: email.locale, file: email.file }
  // A render isn't a file on disk: its offsets don't point into the compiled HTML.
  if (email.fixture !== undefined) return { ...base, fixture: email.fixture }
  const position = problem.at === undefined ? undefined : email.parsed.position(problem.at)
  return { ...base, ...(position && { line: position.line, column: position.column }) }
}

/**
 * A failed compile as findings (Appendix A's compiler-enforced checks): each problem with a code
 * a check claims becomes that check's finding, with the compiler's location. Problems no check
 * claims are returned for printing as they are.
 */
export function compileFindings(
  error: unknown,
  checks: readonly Check[] = CATALOGUE,
): { findings: Finding[]; rest: unknown[] } {
  const problems: {
    code: string
    message: string
    file?: string
    line?: number
    column?: number
  }[] =
    error instanceof CompileError
      ? [...error.problems]
      : isEmailKitError(error)
        ? [{ code: error.code, message: error.message }]
        : []
  if (problems.length === 0) return { findings: [], rest: [error] }
  const findings: Finding[] = []
  const rest: unknown[] = []
  for (const problem of problems) {
    const check = checks.find(
      (c) =>
        c.compiler?.codes.includes(problem.code) &&
        (!c.compiler.match || c.compiler.match.test(problem.message)),
    )
    if (!check) {
      rest.push(error instanceof CompileError ? new CompileError([problem as never]) : error)
      continue
    }
    findings.push({
      id: check.id,
      level: check.level,
      subject: {
        ...(problem.file !== undefined && { file: problem.file }),
        ...(problem.line !== undefined && { line: problem.line }),
        ...(problem.column !== undefined && { column: problem.column }),
      },
      message: problem.message,
      fix: check.fix,
      docs: docsUrl(check.id),
    })
  }
  return { findings, rest }
}
