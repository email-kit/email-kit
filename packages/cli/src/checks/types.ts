// The check engine's shapes (CHK-01, CHK-02, CHK-04): a check has a stable id, a default level,
// the rule, and the usual fix; a finding says where (template, locale, file:line:col), what, how
// to fix it, and where the docs are.

import type { OutputFile } from "../compiler/output.ts"
import type { Field } from "../compiler/schema.ts"
import type { Theme } from "../theme/theme.ts"
import type { TokenFinding } from "../theme/validate.ts"
import type { ParsedEmail } from "./parse.ts"
import type { SourceFile } from "./source.ts"

export type Level = "error" | "warn" | "info"

export interface Subject {
  readonly template?: string
  readonly locale?: string
  /** Relative to the project folder */
  readonly file?: string
  readonly line?: number
  readonly column?: number
  /** For findings in a rendered email: the fixture or generated variant it was rendered with */
  readonly fixture?: string
}

export interface Finding {
  readonly id: string
  readonly level: Level
  readonly subject: Subject
  readonly message: string
  readonly fix: string
  readonly docs: string
}

/** One compiled template × locale, as checks see it. */
export interface CheckedEmail {
  readonly template: string
  readonly locale: string
  /** The compiled HTML file, relative to the project folder */
  readonly file: string
  readonly subject: string
  readonly preheader: string
  readonly html: string
  readonly text: string
  readonly parsed: ParsedEmail
  /** Set when this is a render: the fixture or generated variant */
  readonly fixture?: string
}

/** A template as the source checks see it. */
export interface CheckedTemplate {
  readonly id: string
  /** The schema's portable model */
  readonly model: Field
  /** Relative to the project folder */
  readonly file: string
  readonly fixtures: readonly string[]
}

export interface CheckContext {
  /** The compiled templates, with mustache tags where the data goes */
  readonly emails: readonly CheckedEmail[]
  /** Every template × locale rendered with each fixture and generated variant (CHK-06) */
  readonly rendered: readonly CheckedEmail[]
  /** The templates compiled in the pseudo-locales that don't ship (I18N-05) */
  readonly pseudo: readonly CheckedEmail[]
  /** Each template's messages per real locale, with the keys its templates used */
  readonly messages: readonly {
    readonly template: string
    readonly locale: string
    /** Relative to the project folder */
    readonly file: string
    readonly messages: Readonly<Record<string, string>>
    readonly used: ReadonlySet<string>
  }[]
  /** Templates that failed to compile in a pseudo-locale */
  readonly pseudoErrors: readonly {
    readonly template: string
    readonly locale: string
    readonly message: string
  }[]
  readonly templates: readonly CheckedTemplate[]
  /** The output folder: what a fresh compile writes there, and whether git ignores it */
  readonly output: {
    /** Relative to the project folder */
    readonly dir: string
    readonly absolute: string
    readonly expected: readonly OutputFile[]
    readonly gitignored: boolean
  }
  /** The project's own source files the templates bundle (templates and user components) */
  readonly sources: readonly SourceFile[]
  readonly theme: Theme
  readonly themeFindings: readonly TokenFinding[]
  /** Classic Outlook (Word) is a target: enables the MSO checks (CHK-05) */
  readonly outlookClassic: boolean
  /** The theme source file, relative to the project folder, for tokens.* findings */
  readonly themeFile: string | undefined
}

export interface Problem {
  readonly message: string
  /** Replaces the check's usual fix */
  readonly fix?: string
  /** The email it was found in; omitted for project-wide findings */
  readonly email?: CheckedEmail
  /** The source file it was found in */
  readonly source?: SourceFile
  /** An offset into the email's HTML, or into the source file's text */
  readonly at?: number
  /** For findings outside the compiled HTML, such as the theme */
  readonly subject?: Subject
  /** Replaces the check's default level, for checks with two (E/W) */
  readonly level?: Level
}

export interface Check {
  readonly id: `${string}.${string}`
  readonly level: Level
  /** The rule, one sentence, for docs and `--help` style listings */
  readonly rule: string
  readonly fix: string
  /** Runs only when classic Outlook is a target */
  readonly outlookClassic?: boolean
  /**
   * What `context.emails` holds when it runs: the compiled `template`s (the default), the
   * `render`s of the fixture sweep, or `both`, for values that may come from data.
   */
  readonly on?: "template" | "render" | "both"
  /** A docs page other than docs/checks.md, for team checks */
  readonly docs?: string
  /**
   * Enforced by the compiler: a compile that fails with one of these error codes is reported as
   * this check by `email-kit check`. `run` has nothing left to find.
   */
  readonly compiler?: { readonly codes: readonly string[]; readonly match?: RegExp }
  run(context: CheckContext, report: (problem: Problem) => void): void
}
