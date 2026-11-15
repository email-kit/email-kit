import type { CheckSetting } from "@email-kit/core"
import { isEmailKitError } from "@email-kit/core/internal"

import { CompileError } from "../compiler/problems/index.ts"
import { isPseudo } from "../i18n/pseudo.ts"
import { TOKEN_FIX } from "../theme/validate/index.ts"
import { CATALOGUE } from "./catalogue/index.ts"
import type { Check, CheckContext, Finding, Problem, Subject } from "./types.ts"

/** The checks reference page. */
const CHECKS_DOCS_URL = "https://github.com/email-kit/email-kit/blob/main/docs/checks.md"

/** A check's entry on the reference page. GitHub's anchor drops dots: `img.alt` → `#imgalt`. */
export function docsUrl(id: string): string {
  return `${CHECKS_DOCS_URL}#${id.toLowerCase().replace(/[^a-z0-9 _-]/g, "")}`
}

/**
 * Runs the checks, each at the level the config sets, then adds the theme's `tokens.*` findings.
 * A check sees the compiled templates, the renders, or both, as its `on` says. The pseudo-locales
 * go through the template checks too, for `i18n.expansion`. Repeats are then dropped, as
 * `dedupe()` describes.
 */
export function runChecks(
  context: CheckContext,
  settings: Readonly<Record<string, CheckSetting>> = {},
  checks: readonly Check[] = CATALOGUE,
): Finding[] {
  const findings: Finding[] = []
  for (const check of checks) {
    if (check.outlookClassic && !context.outlookClassic) continue
    if ((settings[check.id]?.level ?? check.level) === "off") continue
    for (const pass of passesOf(check, context)) {
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
  findings.push(...tokenFindings(context, settings))
  return dedupe(findings, context)
}

/**
 * The contexts a check runs in, one per pass, each with its own `emails`: the compiled templates,
 * the renders, and the pseudo-locales, which only the template checks see.
 */
function passesOf(check: Check, context: CheckContext): CheckContext[] {
  const on = check.on ?? "template"
  const passes: CheckContext[] = []
  if (on !== "render") passes.push(context)
  if (on !== "template") passes.push({ ...context, emails: context.rendered })
  if (on !== "render" && context.pseudo.length > 0) {
    passes.push({ ...context, emails: context.pseudo })
  }
  return passes
}

/** The theme's `tokens.*` findings, at the levels the config sets, on the theme file. */
function tokenFindings(
  context: CheckContext,
  settings: Readonly<Record<string, CheckSetting>>,
): Finding[] {
  return context.themeFindings.flatMap((finding): Finding[] => {
    const level =
      settings[finding.id]?.level ?? (finding.level === "warning" ? "warn" : finding.level)
    if (level === "off") return []
    const where = [finding.permutation, finding.mode].filter(Boolean).join(", ")
    return [
      {
        id: finding.id,
        level,
        subject: context.themeFile ? { file: context.themeFile } : {},
        message: where ? `${finding.message} (${where})` : finding.message,
        fix: TOKEN_FIX,
        docs: docsUrl(finding.id),
      },
    ]
  })
}

/**
 * Drops repeated findings:
 * - a finding in a pseudo-locale that doesn't ship, when a real locale has it too;
 * - a render's finding that its compiled template has too: the template's, which has the line,
 *   is kept. Problems that come from data differ by fixture, so they stay;
 * - a finding seen before, at the same place.
 */
function dedupe(findings: readonly Finding[], context: CheckContext): Finding[] {
  const shipped = new Set(context.emails.map((email) => email.locale))
  const what = (f: Finding) => `${f.id}|${f.subject.template}|${f.message}`
  const where = (f: Finding) =>
    `${f.id}|${f.subject.template}|${f.subject.locale}|${f.subject.file}|${f.message}`
  const inRealLocale = new Set(findings.filter((f) => !isPseudo(f.subject.locale ?? "")).map(what))
  const inTemplate = new Set(findings.filter((f) => f.subject.fixture === undefined).map(where))
  const seen = new Set<string>()
  return findings.filter((f) => {
    const locale = f.subject.locale ?? ""
    if (isPseudo(locale) && !shipped.has(locale) && inRealLocale.has(what(f))) return false
    if (f.subject.fixture !== undefined && inTemplate.has(where(f))) return false
    const key = `${where(f)}|${f.subject.line}|${f.subject.column}|${f.subject.fixture}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Where a problem is: a line in a source file or in a compiled email's `.html` file. A render
 * isn't a file on disk, so its offsets don't point into the compiled HTML, and only its fixture is
 * given. Without `.html` files (no `contract`), an email's problem points at its template.
 */
function subjectOf(problem: Problem): Subject {
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
  if (email.fixture !== undefined) return { ...base, fixture: email.fixture }
  const position =
    problem.at === undefined || !email.htmlFile ? undefined : email.parsed.position(problem.at)
  return { ...base, ...(position && { line: position.line, column: position.column }) }
}

/** Where a compiler problem is, when it says. */
interface CompilerProblem {
  readonly code: string
  readonly message: string
  readonly file?: string
  readonly line?: number
  readonly column?: number
}

/**
 * A failed compile as findings, for the checks the compiler enforces: each problem with a code
 * a check claims becomes that check's finding, with the compiler's location. Problems no check
 * claims are returned for printing as they are.
 */
export function compileFindings(
  error: unknown,
  checks: readonly Check[] = CATALOGUE,
): { findings: Finding[]; rest: unknown[] } {
  const claimant = ({ code, message }: CompilerProblem) =>
    checks.find(
      (check) =>
        check.compiler?.codes.includes(code) &&
        (!check.compiler.match || check.compiler.match.test(message)),
    )
  const finding = (check: Check, problem: CompilerProblem): Finding => ({
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

  if (error instanceof CompileError) {
    if (error.problems.length === 0) return { findings: [], rest: [error] }
    const findings: Finding[] = []
    const rest: unknown[] = []
    for (const problem of error.problems) {
      const check = claimant(problem)
      if (check) findings.push(finding(check, problem))
      else rest.push(new CompileError([problem]))
    }
    return { findings, rest }
  }
  if (isEmailKitError(error)) {
    const problem = { code: error.code, message: error.message }
    const check = claimant(problem)
    if (check) return { findings: [finding(check, problem)], rest: [] }
  }
  return { findings: [], rest: [error] }
}
