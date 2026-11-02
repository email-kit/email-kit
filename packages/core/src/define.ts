import { EmailKitError } from "./errors.ts"
import type { Translate, TypedTranslate } from "./i18n.ts"
import type { Child } from "./jsx-runtime.ts"
import type { Data } from "./placeholder.ts"
import type { Platform } from "./platform.ts"
import type { StandardSchemaV1 } from "./standard-schema.ts"

/** The legal purpose of an email (AUTH-03); it decides the required footer parts. */
export type Purpose = "transactional" | "marketing" | "consent-request"

export interface EmailProps<T, Id extends string = string> {
  readonly data: Data<T>
  /** The template's messages, in the locale being compiled; typed once `email-kit compile` ran */
  readonly t: TypedTranslate<Id>
  readonly locale: string
  /** Platform values from the config: product name, postal address, site URL… */
  readonly platform: Platform
}

export interface EmailDefinition<T = unknown> {
  readonly id: string
  readonly purpose: Purpose
  readonly schema: StandardSchemaV1<unknown, T>
  readonly subject: (data: Data<T>, t: Translate, platform: Platform) => Child
  readonly preheader?: (data: Data<T>, t: Translate, platform: Platform) => Child
  /** Named sample data, used for previews and checks. */
  readonly fixtures: Readonly<Record<string, T>>
  readonly component: (props: EmailProps<T>) => Child
}

export type EmailDefinitionInput<S extends StandardSchemaV1, Id extends string = string> = Omit<
  EmailDefinition<StandardSchemaV1.InferOutput<S>>,
  "id" | "schema" | "subject" | "preheader" | "component"
> & {
  readonly id: Id
  readonly schema: S
  readonly subject: (
    data: Data<StandardSchemaV1.InferOutput<S>>,
    t: TypedTranslate<Id>,
    platform: Platform,
  ) => Child
  readonly preheader?: (
    data: Data<StandardSchemaV1.InferOutput<S>>,
    t: TypedTranslate<Id>,
    platform: Platform,
  ) => Child
  readonly component: (props: EmailProps<StandardSchemaV1.InferOutput<S>, Id>) => Child
}

const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const DEFINITION = Symbol.for("email-kit.definition")
const PURPOSES: readonly Purpose[] = ["transactional", "marketing", "consent-request"]

/** Defines an email template. `data` and the fixtures are typed from `schema`. */
export function defineEmail<S extends StandardSchemaV1, const Id extends string = string>(
  definition: EmailDefinitionInput<S, Id>,
): EmailDefinition<StandardSchemaV1.InferOutput<S>> {
  if (!ID.test(definition.id)) {
    throw new EmailKitError(
      "invalid-id",
      `Template id "${definition.id}" must be lowercase words joined by hyphens, like "order-confirmation"`,
    )
  }
  // legal.purpose-declared: the purpose decides the footer parts the legal checks require.
  if (!PURPOSES.includes(definition.purpose as Purpose)) {
    throw new EmailKitError(
      "invalid-purpose",
      `Template "${definition.id}" needs a purpose: "transactional", "marketing" or "consent-request"` +
        (definition.purpose === undefined ? "" : `, not ${JSON.stringify(definition.purpose)}`),
    )
  }
  // The compiler calls t() untyped; the typed view is for the template author only.
  return Object.defineProperty({ ...definition }, DEFINITION, {
    value: true,
  }) as unknown as EmailDefinition<StandardSchemaV1.InferOutput<S>>
}

export function isEmailDefinition(value: unknown): value is EmailDefinition {
  return typeof value === "object" && value !== null && DEFINITION in value
}
