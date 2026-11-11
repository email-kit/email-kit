/** One element of an email, including those only classic Outlook sees. */
export interface CheckElement {
  /** The tag name in lowercase, such as `a` or `v:roundrect`. */
  readonly name: string
  readonly attributes: Readonly<Record<string, string>>
  /** The text inside it. */
  readonly text: string
  /** Where it starts in the email's `html`. Pass it as `at` to `report()`. */
  readonly offset: number
  /** Whether it's inside an `[if mso]` comment, which only classic Outlook reads. */
  readonly mso: boolean
}

/**
 * One email to check: a compiled template with `{{tags}}` where data goes, or a render of one
 * with a fixture.
 */
export interface CheckEmail {
  /** The template's id, such as `emails.orderConfirmation`. */
  readonly template: string
  /** The locale, including the test locales `en-XA` and `ar-XB`. */
  readonly locale: string
  /** For renders only: the fixture's name, or the generated variant, such as `generated empty`. */
  readonly fixture?: string
  readonly subject: string
  readonly preheader: string
  /** The HTML part. */
  readonly html: string
  /** The plain-text part. */
  readonly text: string
  /** Every element, or only those with this tag name, such as `elements("a")`. */
  elements(name?: string): readonly CheckElement[]
}

/** A problem a check found, passed to `report()`. */
export interface CheckProblem {
  /** What's wrong, in one sentence. */
  readonly message: string
  /** The email it's in. Leave it out for a problem with the whole project. */
  readonly email?: CheckEmail
  /** Where in the email's HTML, such as an element's `offset`. */
  readonly at?: number
  /** A fix for this problem, in place of the check's usual `fix`. */
  readonly fix?: string
}

/** A check of your own, made with `defineCheck()`. */
export interface CustomCheck {
  /**
   * A lowercase `family.name`, with a family of your own, such as `acme.help-link`. Families used
   * by the built-in checks, such as `link` or `img`, are taken.
   */
  readonly id: string
  /**
   * How serious its problems are. `error` fails `email-kit check`. Projects can change it under
   * `checks` in email-kit.config.ts.
   */
  readonly level: "error" | "warn" | "info"
  /** The rule, in one sentence. */
  readonly rule: string
  /** How to fix a problem, in one sentence. */
  readonly fix: string
  /** A link to your own docs for the check. */
  readonly docs?: string
  /**
   * What `emails` holds: the compiled templates, with `{{tags}}` where data goes (the default),
   * the renders with every fixture and generated variant, or both.
   */
  readonly on?: "template" | "render" | "both"
  /** Checks the emails and calls `report()` for each problem. It must run synchronously. */
  run(
    context: { readonly emails: readonly CheckEmail[] },
    report: (problem: CheckProblem) => void,
  ): void
}

/**
 * Defines a check of your own, which `email-kit check` runs beside the built-in ones. It
 * returns the check unchanged; it only adds types. Add the check to `customChecks` in
 * email-kit.config.ts.
 *
 * @example
 * ```ts
 * export const helpLink = defineCheck({
 *   id: "acme.help-link",
 *   level: "warn",
 *   rule: "Every email links to the help centre.",
 *   fix: "Add a link to https://help.acme.com.",
 *   run({ emails }, report) {
 *     for (const email of emails) {
 *       const hrefs = email.elements("a").map((a) => a.attributes.href ?? "")
 *       if (!hrefs.some((href) => href.includes("help.acme.com"))) {
 *         report({ message: "No help centre link", email })
 *       }
 *     }
 *   },
 * })
 * ```
 */
export function defineCheck(check: CustomCheck): CustomCheck {
  return check
}
