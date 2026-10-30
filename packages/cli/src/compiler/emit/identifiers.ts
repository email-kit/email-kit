// Deterministic identifiers for generated code (R6, OUT-11). A template id such as
// `order-confirmation` becomes `orderConfirmation` (the `emails` key) and `OrderConfirmationData`
// (its data type). Ids follow `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` (AUTH-02), so the results are always
// valid TS identifiers; keys can't clash with reserved words (they are property names), and the
// `Data` suffix keeps type names off TS's own.

import { EmailKitError } from "@email-kit/core/internal"

export interface Identifiers {
  /** The key in the `emails` object */
  readonly property: string
  /** The exported data interface */
  readonly typeName: string
}

export function identifiersFor(id: string): Identifiers {
  const [first = "", ...rest] = id.split("-")
  const property = first + rest.map(capitalize).join("")
  return { property, typeName: `${capitalize(property)}Data` }
}

/** Fails when two template ids map to the same identifier (such as `a-b` and `aB`, if allowed). */
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
