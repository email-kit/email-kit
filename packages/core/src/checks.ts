// Team checks (CHK-08, P1-166): a project's own rules, run by `email-kit check` beside the
// built-in catalogue, with the same levels, config and reporters. The context is plain data so
// that it stays stable across email-kit versions.

/** One element of an email, Word-only ones included. */
export interface CheckElement {
  /** Lowercase tag name, such as `a` or `v:roundrect` */
  readonly name: string
  readonly attributes: Readonly<Record<string, string>>
  /** The text inside it */
  readonly text: string
  /** Its offset in `html`, for report() */
  readonly offset: number
  /** Inside an `[if mso]` comment: only classic Outlook sees it */
  readonly mso: boolean
}

/** A compiled email, or a render of one with a fixture. */
export interface CheckEmail {
  readonly template: string
  readonly locale: string
  /** Set for renders: the fixture or generated variant ("generated empty") */
  readonly fixture?: string
  readonly subject: string
  readonly preheader: string
  readonly html: string
  readonly text: string
  /** Every element, or those with this tag name */
  elements(name?: string): readonly CheckElement[]
}

export interface CheckProblem {
  readonly message: string
  /** The email it is in; leave out for a project-wide problem */
  readonly email?: CheckEmail
  /** An offset into the email's HTML, such as an element's `offset` */
  readonly at?: number
  /** Replaces the check's usual fix */
  readonly fix?: string
}

export interface CustomCheck {
  /** `family.name`, with a family of your own, such as `acme.help-link` */
  readonly id: string
  readonly level: "error" | "warn" | "info"
  /** The rule, one sentence */
  readonly rule: string
  /** The usual fix */
  readonly fix: string
  /** Where your docs for it live */
  readonly docs?: string
  /**
   * What `emails` holds: the compiled templates, with `{{tags}}` where data goes (the default),
   * the renders with every fixture and generated variant, or both.
   */
  readonly on?: "template" | "render" | "both"
  run(
    context: { readonly emails: readonly CheckEmail[] },
    report: (problem: CheckProblem) => void,
  ): void
}

/** Declares a team check with types. Add it to `customChecks` in email-kit.config.ts. */
export function defineCheck(check: CustomCheck): CustomCheck {
  return check
}
