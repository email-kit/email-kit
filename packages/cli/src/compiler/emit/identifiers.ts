import { EmailKitError } from "@email-kit/core/internal"

/** A template's names in the generated module. */
export interface Identifiers {
  /** Its key in the `emails` object, such as `orderConfirmation`. */
  readonly property: string
  /** Its exported data interface, such as `OrderConfirmationData`. */
  readonly typeName: string
}

/**
 * The generated code's names for a template: `order-confirmation` becomes `orderConfirmation`, its
 * key in `emails`, and `OrderConfirmationData`, its data type. Ids match
 * `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, so both are always valid identifiers. A key can't clash with a
 * reserved word, since it's a property name, and the `Data` suffix keeps type names off
 * TypeScript's own.
 */
export function identifiersFor(id: string): Identifiers {
  const [first = "", ...rest] = id.split("-")
  const property = first + rest.map(capitalize).join("")
  return { property, typeName: `${capitalize(property)}Data` }
}

/**
 * Fails when two template ids map to the same identifier. A digit has no capital, so `order-v2`
 * and `order-v-2` both become `orderV2`.
 */
export function assertUniqueIdentifiers(ids: readonly string[]): void {
  const seen = new Map<string, string>()
  for (const id of ids) {
    const { property } = identifiersFor(id)
    const other = seen.get(property)
    if (other !== undefined) {
      throw new EmailKitError(
        "identifier-collision",
        `The template ids "${other}" and "${id}" both become \`emails.${property}\`; rename one`,
      )
    }
    seen.set(property, id)
  }
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}
