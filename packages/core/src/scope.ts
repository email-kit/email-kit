// The scope counter: numbers the contexts sections open, so the compiler can tell which `{{.}}`
// a placeholder means. On globalThis, so every copy of @email-kit/core shares one counter.

import { EmailKitError } from "./errors.ts"

const EVALUATION = Symbol.for("email-kit.evaluation")
const slot = globalThis as { [EVALUATION]?: { nextScope: number } | undefined }

export function withScopes<T>(run: () => T): T {
  const previous = slot[EVALUATION]
  slot[EVALUATION] = { nextScope: 1 }
  try {
    return run()
  } finally {
    slot[EVALUATION] = previous
  }
}

export function openScope(): number {
  const state = slot[EVALUATION]
  if (state === undefined) {
    throw new EmailKitError(
      "outside-evaluation",
      "<Each>, <If> and <Unless> only work while email-kit compiles a template",
    )
  }
  return state.nextScope++
}
