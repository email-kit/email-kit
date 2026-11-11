import { EmailKitError } from "../shared/errors.ts"
import { globalSlot } from "../shared/global-slot.ts"

const evaluation = globalSlot<{ nextScope: number }>("email-kit.evaluation")

/** Runs `run` with a new scope counter, so the sections of one email are numbered from 1. */
export function withScopes<T>(run: () => T): T {
  return evaluation.run({ nextScope: 1 }, run)
}

/**
 * A new number for the context a section's children read in: the list item or the tested value.
 * The compiler uses it to tell which list a `{{.}}` belongs to. Throws outside `withScopes()`.
 */
export function openScope(): number {
  const state = evaluation.get()
  if (state === undefined) {
    throw new EmailKitError(
      "outside-evaluation",
      "<Each>, <If> and <Unless> only work while email-kit compiles a template",
    )
  }
  return state.nextScope++
}
