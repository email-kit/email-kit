import type { Purpose } from "@email-kit/core"

import type { OutputFile } from "../compiler/output/index.ts"
import type { Field } from "../compiler/schema/index.ts"
import type { Theme } from "../theme/theme.ts"
import type { TokenFinding } from "../theme/validate/index.ts"
import type { ParsedEmail } from "./parse.ts"
import type { SourceFile } from "./source.ts"

/** How serious a finding is: an error fails `email-kit check`, a warning and a note don't. */
export type Level = "error" | "warn" | "info"

/** Where a finding is. Every field is optional: a project-wide finding has none. */
export interface Subject {
  readonly template?: string
  readonly locale?: string
  /** Relative to the project folder. */
  readonly file?: string
  readonly line?: number
  readonly column?: number
  /** For a finding in a render: the fixture or generated variant it was rendered with. */
  readonly fixture?: string
}

/** One problem `email-kit check` reports. */
export interface Finding {
  readonly id: string
  readonly level: Level
  readonly subject: Subject
  readonly message: string
  /** What to do about it. */
  readonly fix: string
  /** The check's docs page, or `""` for a team check without one. */
  readonly docs: string
}

/** One compiled template in one locale, or one render of it, as checks see it. */
export interface CheckedEmail {
  readonly template: string
  readonly locale: string
  /**
   * Where its findings point, relative to the project folder: the compiled `.html` file when the
   * output has one (`contract: true`), otherwise the template's source file.
   */
  readonly file: string
  /** Whether `file` is the compiled HTML, so offsets into `html` are lines and columns in it. */
  readonly htmlFile: boolean
  readonly subject: string
  readonly preheader: string
  readonly html: string
  readonly text: string
  readonly parsed: ParsedEmail
  /** Set for a render: the fixture or generated variant it was rendered with. */
  readonly fixture?: string
}

/** A template as the source checks see it. */
export interface CheckedTemplate {
  readonly id: string
  /** The legal purpose, which decides the footer parts the `legal.*` checks require. */
  readonly purpose: Purpose
  /** The schema's portable model. */
  readonly model: Field
  /** Relative to the project folder. */
  readonly file: string
  /** The names of its fixtures. */
  readonly fixtures: readonly string[]
}

/** Everything the checks can look at for one project. */
export interface CheckContext {
  /**
   * The emails a check looks at: the compiled templates, with mustache tags where the data goes,
   * or, in the render pass, the renders. See `Check.on`.
   */
  readonly emails: readonly CheckedEmail[]
  /** Every template in every locale, rendered with each fixture and generated variant. */
  readonly rendered: readonly CheckedEmail[]
  /** The templates compiled in the pseudo-locales that don't ship. */
  readonly pseudo: readonly CheckedEmail[]
  /** Each template's messages per real locale, with the keys its templates used. */
  readonly messages: readonly {
    readonly template: string
    readonly locale: string
    /** Relative to the project folder. */
    readonly file: string
    readonly messages: Readonly<Record<string, string>>
    readonly used: ReadonlySet<string>
  }[]
  /** The templates that failed to compile in a pseudo-locale. */
  readonly pseudoErrors: readonly {
    readonly template: string
    readonly locale: string
    readonly message: string
  }[]
  readonly templates: readonly CheckedTemplate[]
  /** The output folder: what a fresh compile writes there, and whether git ignores it. */
  readonly output: {
    /** Relative to the project folder. */
    readonly dir: string
    readonly absolute: string
    readonly expected: readonly OutputFile[]
    readonly gitignored: boolean
    /**
     * Where the app's package.json (the nearest above the config) lists `@email-kit/runtime`,
     * which the generated module imports; `undefined` without a package.json.
     */
    readonly runtime?:
      | {
          /** The package.json, relative to the project folder. */
          readonly file: string
          readonly section: "dependencies" | "devDependencies" | "missing"
        }
      | undefined
  }
  /** The project's own source files the templates bundle: templates and user components. */
  readonly sources: readonly SourceFile[]
  readonly theme: Theme
  /** The `tokens.*` findings, which the theme checks found while loading it. */
  readonly themeFindings: readonly TokenFinding[]
  /** Whether classic Outlook is a target, which turns on the checks that only concern it. */
  readonly outlookClassic: boolean
  /** The theme source file, relative to the project folder, for `tokens.*` findings. */
  readonly themeFile: string | undefined
}

/** A problem a check reports: what's wrong, and where. */
export interface Problem {
  readonly message: string
  /** Replaces the check's usual fix. */
  readonly fix?: string
  /** The email it was found in; left out for project-wide findings. */
  readonly email?: CheckedEmail
  /** The source file it was found in. */
  readonly source?: SourceFile
  /** An offset into the email's HTML, or into the source file's text. */
  readonly at?: number
  /** Where it is, for findings outside the emails and source files, such as messages files. */
  readonly subject?: Subject
  /** Replaces the check's default level, for checks with two, such as an error and a warning. */
  readonly level?: Level
}

/** A check: its id, default level, rule and fix, and what it runs. */
export interface Check {
  readonly id: `${string}.${string}`
  readonly level: Level
  /** The rule, in one sentence, for the docs page. */
  readonly rule: string
  readonly fix: string
  /** Whether it runs only when classic Outlook is a target. */
  readonly outlookClassic?: boolean
  /**
   * What `context.emails` holds when it runs: the compiled `template`s (the default), the
   * `render`s of the fixture sweep, or `both`, for values that may come from data.
   */
  readonly on?: "template" | "render" | "both"
  /** A docs page other than docs/checks.md, for team checks. */
  readonly docs?: string
  /**
   * Enforced by the compiler: a compile that fails with one of these error codes is reported as
   * this check by `email-kit check`. `run` has nothing left to find.
   */
  readonly compiler?: { readonly codes: readonly string[]; readonly match?: RegExp }
  /** Looks for problems and reports each one. */
  run(context: CheckContext, report: (problem: Problem) => void): void
}
