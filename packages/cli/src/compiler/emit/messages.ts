// messages.d.ts (P1-159, AUTH-09): each template's message keys and parameters, from the default
// locale, as an augmentation of @email-kit/core's MessageRegistry. Templates get a typed t()
// without importing anything; before the first compile, t() stays untyped.

import { messageArguments } from "@email-kit/core/internal"

import type { CompiledTemplate } from "../project.ts"

const TYPES = {
  text: "MessageParam",
  plural: "number | Placeholder<number>",
  select: "string | Placeholder<string>",
} as const

const comment = (text: string) => text.replace(/\*\//g, "*\\/").replace(/\s*\n\s*/g, " ")

export function generateMessageTypes(
  templates: readonly CompiledTemplate[],
  header: string,
): string {
  const entries = [...templates]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((template) => {
      const keys = Object.keys(template.messages)
        .sort()
        .map((key) => {
          const source = template.messages[key] as string
          const args = [...messageArguments(source, `Message "${key}" of ${template.id}`)]
          const params = args.map(([name, kind]) => `readonly ${name}: ${TYPES[kind]}`).join("; ")
          const type = params ? `{ ${params} }` : "{}"
          return `      /** ${comment(source)} */\n      readonly ${JSON.stringify(key)}: ${type}`
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
