import type { Sender } from "../config/sender.ts"
import type { Data } from "../data/placeholder.ts"
import type { Translate, TypedTranslate } from "../i18n/translate.ts"
import { EmailKitError } from "../shared/errors.ts"
import type { Child } from "../tree/nodes.ts"
import type { StandardSchemaV1 } from "./standard-schema.ts"

/**
 * Why the email is sent. `email-kit check` uses it to decide what the footer must contain.
 *
 * - `"transactional"`: something the recipient did or needs to know, such as a receipt or a
 *   password reset.
 * - `"marketing"`: promotional content of any kind. The footer must show your postal address.
 * - `"consent-request"`: asks the recipient to agree to receive email, such as a newsletter
 *   sign-up confirmation. The footer must show your postal address.
 */
export type Purpose = "transactional" | "marketing" | "consent-request"

/** What a template's `component` receives. */
export interface EmailProps<T, Id extends string = string> {
  /**
   * The email's data, shaped like `schema`. Its fields are placeholders that are filled in when
   * the email is rendered: put them in your JSX, and use `<Each>` and `<If>` to loop or branch
   * on them.
   */
  readonly data: Data<T>
  /**
   * Looks up a message for this template in the locale being compiled:
   * `t("greeting", { name: data.name })`. Keys and parameters are typed after the first
   * `email-kit compile`.
   */
  readonly t: TypedTranslate<Id>
  /** The locale being compiled, such as `"en"` or `"pt-BR"`. */
  readonly locale: string
  /**
   * Facts about who sends the email, from email-kit.config.ts: product name, postal address, site
   * URL…
   */
  readonly sender: Sender
}

/** An email template made with `defineEmail()`. */
export interface EmailDefinition<T = unknown> {
  readonly id: string
  /** Why the email is sent: `"transactional"`, `"marketing"` or `"consent-request"`. */
  readonly purpose: Purpose
  readonly schema: StandardSchemaV1<unknown, T>
  readonly subject: (data: Data<T>, t: Translate, sender: Sender) => Child
  readonly preheader?: (data: Data<T>, t: Translate, sender: Sender) => Child
  /** Named sample data, used for previews and checks. */
  readonly fixtures: Readonly<Record<string, T>>
  readonly component: (props: EmailProps<T>) => Child
}

/** What `defineEmail()` takes. */
export type EmailDefinitionInput<S extends StandardSchemaV1, Id extends string = string> = Omit<
  EmailDefinition<StandardSchemaV1.InferOutput<S>>,
  "id" | "schema" | "subject" | "preheader" | "component"
> & {
  /**
   * A unique name in lowercase words joined by hyphens, such as `"order-confirmation"`. Your app
   * sends it as `emails.orderConfirmation`.
   */
  readonly id: Id
  /** The shape of the email's data, from Zod, Valibot, ArkType or any Standard Schema library. */
  readonly schema: S
  /** Returns the subject line. */
  readonly subject: (
    data: Data<StandardSchemaV1.InferOutput<S>>,
    t: TypedTranslate<Id>,
    sender: Sender,
  ) => Child
  /** Returns the short preview text that inboxes show after the subject. */
  readonly preheader?: (
    data: Data<StandardSchemaV1.InferOutput<S>>,
    t: TypedTranslate<Id>,
    sender: Sender,
  ) => Child
  /** Returns the email's content as JSX. */
  readonly component: (props: EmailProps<StandardSchemaV1.InferOutput<S>, Id>) => Child
}

const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/** Whether a string is a template id: lowercase words joined by hyphens, like `order-shipped`. */
export function isTemplateId(id: string): boolean {
  return ID.test(id)
}
const DEFINITION = Symbol.for("email-kit.definition")
const PURPOSES: readonly Purpose[] = ["transactional", "marketing", "consent-request"]

/**
 * Defines an email template. Export it as the default export of a file in the templates folder.
 *
 * `schema` (Zod, Valibot, ArkType or any Standard Schema library) describes the data the email
 * needs. It types `data` in the template and the `fixtures`, and the generated `render()`
 * checks data against it.
 *
 * The template runs once, while `email-kit compile` runs, not once per email sent: `data` holds
 * placeholders, not real values.
 *
 * @param definition.id - A unique name in lowercase words joined by hyphens, such as
 *   `"order-confirmation"`. Your app sends it as `emails.orderConfirmation`.
 * @param definition.purpose - Why the email is sent: `"transactional"`, `"marketing"` or
 *   `"consent-request"`.
 * @param definition.schema - The shape of the email's data.
 * @param definition.subject - Returns the subject line.
 * @param definition.preheader - Returns the short preview text that inboxes show after the
 *   subject. Optional.
 * @param definition.fixtures - Named sample data, used for previews and checks.
 * @param definition.component - Returns the email's content as JSX.
 * @throws {EmailKitError} If `id` isn't lowercase words joined by hyphens, or `purpose` is
 *   missing or unknown.
 *
 * @example
 * ```tsx
 * export default defineEmail({
 *   id: "welcome",
 *   purpose: "transactional",
 *   schema: z.object({ name: z.string() }),
 *   subject: (data, t) => t("subject", { name: data.name }),
 *   fixtures: { default: { name: "Ada" } },
 *   component: ({ data, t }) => <p>{t("greeting", { name: data.name })}</p>,
 * })
 * ```
 */
export function defineEmail<S extends StandardSchemaV1, const Id extends string = string>(
  definition: EmailDefinitionInput<S, Id>,
): EmailDefinition<StandardSchemaV1.InferOutput<S>> {
  if (!isTemplateId(definition.id)) {
    throw new EmailKitError(
      "invalid-id",
      `Template id "${definition.id}" must be lowercase words joined by hyphens, like "order-confirmation"`,
    )
  }
  if (!PURPOSES.includes(definition.purpose as Purpose)) {
    throw new EmailKitError(
      "invalid-purpose",
      `Template "${definition.id}" needs a purpose: "transactional", "marketing" or "consent-request"` +
        (definition.purpose === undefined ? "" : `, not ${JSON.stringify(definition.purpose)}`),
    )
  }
  return Object.defineProperty({ ...definition }, DEFINITION, {
    value: true,
  }) as unknown as EmailDefinition<StandardSchemaV1.InferOutput<S>>
}

/** Whether a value was made with `defineEmail()`, even by another installed copy of email-kit. */
export function isEmailDefinition(value: unknown): value is EmailDefinition {
  return typeof value === "object" && value !== null && DEFINITION in value
}
