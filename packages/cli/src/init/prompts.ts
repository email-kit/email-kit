import { cancel, confirm, isCancel, text } from "@clack/prompts"
import { EmailKitError } from "@email-kit/core/internal"

import type { Prompter } from "./index.ts"

/** Stops `init` when the user cancels a question, with Ctrl-C or Escape. */
const stop = (): never => {
  cancel("Nothing more was changed.")
  throw new EmailKitError("init-cancelled", "init was cancelled")
}

/** Stops `init` when there's no terminal to ask in, pointing at `--yes` rather than guessing. */
function needTerminal(): void {
  if (process.stdin.isTTY) return
  throw new EmailKitError(
    "init-needs-answers",
    "init asks before it changes files, and there's no terminal to ask in. Run it with --yes to accept the defaults.",
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
}
