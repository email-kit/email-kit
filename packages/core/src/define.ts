import { EmailKitError } from "./errors.ts"
import type { Translate } from "./i18n.ts"
import type { Child } from "./jsx-runtime.ts"
import type { Data } from "./placeholder.ts"
import type { Platform } from "./platform.ts"
import type { StandardSchemaV1 } from "./standard-schema.ts"

/** The legal purpose of an email (AUTH-03); it decides the required footer parts. */
export type Purpose = "transactional" | "marketing" | "consent-request"

export interface EmailProps<T> {
  readonly data: Data<T>
  readonly t: Translate
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

export type EmailDefinitionInput<S extends StandardSchemaV1> = Omit<
  EmailDefinition<StandardSchemaV1.InferOutput<S>>,
  "schema"
> & { readonly schema: S }

const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const DEFINITION = Symbol.for("email-kit.definition")

/** Defines an email template. `data` and the fixtures are typed from `schema`. */
export function defineEmail<S extends StandardSchemaV1>(
  definition: EmailDefinitionInput<S>,
): EmailDefinition<StandardSchemaV1.InferOutput<S>> {
  if (!ID.test(definition.id)) {
    throw new EmailKitError(
      "invalid-id",
      `Template id "${definition.id}" must be lowercase words joined by hyphens, like "order-confirmation"`,
    )
  }
  return Object.defineProperty({ ...definition }, DEFINITION, { value: true })
}

export function isEmailDefinition(value: unknown): value is EmailDefinition {
  return typeof value === "object" && value !== null && DEFINITION in value
}
