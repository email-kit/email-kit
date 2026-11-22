import { cancel, confirm, isCancel, multiselect, text } from "@clack/prompts"
import { EmailKitError } from "@email-kit/core/internal"

import type { Choice, Prompter } from "./index.ts"

/** Stops `init` when the user cancels a question, with Ctrl-C or Escape. */
const stop = (): never => {
  cancel("Nothing more was changed.")
  throw new EmailKitError("init-cancelled", "init was cancelled")
}

/**
 * Stops `init` or `agents` when there's no terminal to ask in, pointing at `--yes` rather than
 * guessing.
 */
function needTerminal(): void {
  if (process.stdin.isTTY) return
  throw new EmailKitError(
    "init-needs-answers",
    "email-kit asks before it changes files, and there's no terminal to ask in. Run it with --yes to accept the defaults.",
  )
}

/** Asks `init`'s questions in a terminal, with @clack/prompts. */
export const terminalPrompter: Prompter = {
  async confirm(message, initial) {
    needTerminal()
    const answer = await confirm({ message, initialValue: initial })
    return isCancel(answer) ? stop() : answer
  },
  async text(message, initial) {
    needTerminal()
    const answer = await text({ message, initialValue: initial })
    return isCancel(answer) ? stop() : answer
  },
  async multiselect<Value extends string>(
    message: string,
    options: readonly Choice<Value>[],
    initial: readonly Value[],
  ) {
    needTerminal()
    const answer = await multiselect({
      message,
      // The options' type is conditional on Value, which TypeScript can't resolve for a generic.
      options: options.map((option) => ({ ...option })) as Parameters<
        typeof multiselect<Value>
      >[0]["options"],
      initialValues: [...initial],
      required: false,
    })
    return isCancel(answer) ? stop() : answer
  },
}
