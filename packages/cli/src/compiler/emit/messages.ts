import { messageArguments } from "@email-kit/core/internal"

import type { CompiledTemplate } from "../project/index.ts"
import { docText } from "./types.ts"

/** The type a message argument accepts, by how the message uses it. */
const TYPES = {
  text: "MessageParam",
  plural: "number | Placeholder<number>",
  select: "string | Placeholder<string>",
} as const

/**
 * Writes `messages.d.ts`: each template's message keys and parameters, from the default locale, as
 * an augmentation of core's `MessageRegistry`. Templates then get a typed `t()` without importing
 * anything. Before the first compile, `t()` accepts any key. Each key's doc is its message.
 */
export function generateMessageTypes(
  templates: readonly CompiledTemplate[],
  header: string,
): string {
  const entries = [...templates]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((template) => {
      const keys = Object.keys(template.messages)
        .sort()
        .map((key) => {
          const source = template.messages[key] as string
          const args = [...messageArguments(source, `Message "${key}" of ${template.id}`)]
          const params = args.map(([name, kind]) => `readonly ${name}: ${TYPES[kind]}`).join("; ")
          const type = params ? `{ ${params} }` : "{}"
          return `      /** ${docText(source)} */\n      readonly ${JSON.stringify(key)}: ${type}`
        })
      return `    readonly ${JSON.stringify(template.id)}: {\n${keys.join("\n")}\n    }`
    })
  return `${header}

// The message keys and parameters of each template, from the default locale: what t() accepts.
// Keep this file in your TypeScript project (it is, if your tsconfig includes the output folder).

import type { MessageParam, Placeholder } from "@email-kit/core"

declare module "@email-kit/core" {
  interface MessageRegistry {
${entries.join("\n")}
  }
}
`
}
