// The scope counter: numbers the contexts sections open, so the compiler can tell which `{{.}}`

import { EmailKitError } from "../shared/errors.ts"
import { globalSlot } from "../shared/global-slot.ts"

const evaluation = globalSlot<{ nextScope: number }>("email-kit.evaluation")

export function withScopes<T>(run: () => T): T {
  return evaluation.run({ nextScope: 1 }, run)
}

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
