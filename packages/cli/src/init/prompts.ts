// Prompts in a terminal (CLI-08: @clack/prompts). Without a terminal init can't ask, so it stops
// and points at --yes rather than guessing.

import { cancel, confirm, isCancel, text } from "@clack/prompts"
import { EmailKitError } from "@email-kit/core/internal"

import type { Prompter } from "./index.ts"

const stop = (): never => {
  cancel("Nothing more was changed.")
  throw new EmailKitError("init-cancelled", "init was cancelled")
}

export const terminalPrompter: Prompter = {
  async confirm(message, initial) {
    if (!process.stdin.isTTY) {
      throw new EmailKitError(
        "init-needs-answers",
        "init asks before it changes files, and there's no terminal to ask in. Run it with --yes to accept the defaults.",
      )
    }
    const answer = await confirm({ message, initialValue: initial })
    return isCancel(answer) ? stop() : answer
  },
  async text(message, initial) {
    const answer = await text({ message, initialValue: initial })
    return isCancel(answer) ? stop() : answer
  },
}
