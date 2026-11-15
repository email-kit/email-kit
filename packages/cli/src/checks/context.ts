import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { compile } from "@email-kit/dialect"
import { createTemplate, FORMAT } from "@email-kit/runtime"
import { resolveLocale } from "@email-kit/runtime/locale"
import { prepare } from "@email-kit/runtime/plural"

import { type BuiltProject, outputFiles } from "../compiler/build.ts"
import { modelOf } from "../compiler/emit/types.ts"
import { fixturesWithVariants } from "../compiler/fixtures.ts"
import { pluralRules } from "../i18n/plurals.ts"
import { relativePath } from "../paths.ts"
import { parseEmail } from "./parse.ts"
import { type SourceFile, sourceFile } from "./source.ts"
import type { CheckContext, CheckedEmail } from "./types.ts"

/** The four parts of an email, compiled or rendered. */
interface Parts {
  readonly subject: string
  readonly preheader: string
  readonly html: string
  readonly text: string
}

/**
 * Everything the checks see for a built project: the compiled emails, the pseudo-locales, the
 * renders of every fixture and generated variant, the messages, the output folder, and each
 * project file once, with the templates that bundle it. Renders are made the way the generated
 * module makes them, with stand-in values for the sender keys passed at send time.
 */
export async function contextOf(project: BuiltProject): Promise<CheckContext> {
  const { config } = project
  const sourceOf = new Map(project.templates.map((t) => [t.id, t.file]))
  const checked = (template: string, locale: string, parts: Parts): CheckedEmail => ({
    template,
    locale,
    file: relativePath(
      config.dir,
      config.contract
        ? `${config.out}/${template}/${locale}.html`
        : (sourceOf.get(template) as string),
    ),
    htmlFile: config.contract,
    subject: parts.subject,
    preheader: parts.preheader,
    html: parts.html,
    text: parts.text,
    parsed: parseEmail(parts.html),
  })

  const emails = project.templates.flatMap((t) =>
    t.emails.map((email) => checked(t.id, email.locale, email)),
  )
  const pseudo = project.templates.flatMap((t) =>
    t.pseudo.flatMap((build) => (build.email ? [checked(t.id, build.locale, build.email)] : [])),
  )
  const pseudoErrors = project.templates.flatMap((t) =>
    t.pseudo.flatMap((build) =>
      build.error === undefined
        ? []
        : [{ template: t.id, locale: build.locale, message: build.error }],
    ),
  )

  const values = Object.fromEntries(config.sender.runtime.map((key) => [key, standIn(key)]))
  const plurals = Object.fromEntries(
    config.locales.map((locale) => [locale, pluralRules(locale).category]),
  )
  const rendered: CheckedEmail[] = []
  for (const template of project.templates) {
    const parts = Object.fromEntries(
      template.emails.map((email) => [email.locale, compiledPartsOf(email)]),
    )
    // As the generated module renders it, without validation: generated variants break it.
    const runtime = createTemplate(
      {
        id: template.id,
        purpose: template.purpose,
        model: modelOf(template.model),
        locales: config.locales,
        parts,
      },
      {
        format: FORMAT,
        context: values,
        plural: { prepare, rules: plurals },
        resolve: (requested, available) => resolveLocale(requested, available),
      },
    )
    const fixtures = await fixturesWithVariants(template.schema, template.model, template.fixtures)
    for (const fixture of fixtures) {
      for (const locale of config.locales) {
        const email = runtime.render(fixture.data, { locale })
        rendered.push({ ...checked(template.id, locale, email), fixture: fixture.name })
      }
    }
  }

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
        file: relativePath(config.dir, m.file),
        messages: m.messages,
        used,
      }))
    }),
    output: {
      dir: relativePath(config.dir, config.out),
      absolute: config.out,
      expected: outputFiles(project),
      gitignored:
        spawnSync("git", ["check-ignore", "-q", config.out], { cwd: config.dir }).status === 0,
      runtime: runtimeDependency(config.dir),
    },
    templates: project.templates.map((t) => ({
      id: t.id,
      purpose: t.purpose,
      model: t.model,
      file: relativePath(config.dir, t.file),
      fixtures: Object.keys(t.fixtures),
    })),
    sources: sourceFiles(project),
    theme: project.theme,
    themeFindings: project.themeFindings,
    outlookClassic: true,
    themeFile: typeof source === "string" ? source : undefined,
  }
}

/** The four parts of an email, compiled for the runtime as the generated module carries them. */
function compiledPartsOf({ subject, preheader, html, text }: Parts) {
  return {
    subject: compile(subject),
    preheader: compile(preheader),
    html: compile(html),
    text: compile(text),
  }
}

/** Where the nearest package.json at or above `dir` lists `@email-kit/runtime`. */
function runtimeDependency(dir: string): CheckContext["output"]["runtime"] {
  for (let folder = dir; ; folder = dirname(folder)) {
    const file = join(folder, "package.json")
    if (existsSync(file)) {
      let pkg: Record<string, Record<string, unknown> | undefined>
      try {
        pkg = JSON.parse(readFileSync(file, "utf8"))
      } catch {
        return undefined
      }
      const section = (["dependencies", "devDependencies"] as const).find(
        (name) => pkg[name]?.["@email-kit/runtime"] !== undefined,
      )
      return { file: relativePath(dir, file) || "package.json", section: section ?? "missing" }
    }
    if (dirname(folder) === folder) return undefined
  }
}

/** A stand-in for a sender value the backend passes at send time. */
function standIn(key: string): string {
  if (key === "supportEmail") return "help@example.test"
  return /url|link|href/i.test(key) ? "https://example.test/" : `Example ${key}`
}

/** Each project file the templates bundle, once, with the templates that bundle it. */
function sourceFiles(project: BuiltProject): SourceFile[] {
  const users = new Map<string, string[]>()
  for (const template of project.templates) {
    for (const file of template.sources) users.set(file, [...(users.get(file) ?? []), template.id])
  }
  return [...users].map(([file, ids]) => sourceFile(file, project.config.dir, ids))
}
