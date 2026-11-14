import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { EmailKitError } from "@email-kit/core/internal"

import { isPseudo } from "../../i18n/pseudo.ts"
import type { ResolvedConfig } from "../config/index.ts"

/** One locale's messages for a template, and the file they come from. */
export interface Catalogue {
  readonly locale: string
  readonly file: string
  readonly messages: Readonly<Record<string, string>>
}

/**
 * Each real locale's messages for a template, from `<messages>/<locale>/<id>.json`, in config
 * order, so the default locale comes first. Pseudo-locales have no file: they're made from the
 * default locale's messages.
 */
export function readCatalogues(config: ResolvedConfig, id: string): Catalogue[] {
  return config.locales
    .filter((locale) => !isPseudo(locale))
    .map((locale) => {
      const file = join(config.messages, locale, `${id}.json`)
      return { locale, file, messages: readMessages(file) }
    })
}

/** Reads a flat `{ "key": "ICU message" }` file. A missing file means no messages. */
function readMessages(file: string): Record<string, string> {
  if (!existsSync(file)) return {}
  let messages: unknown
  try {
    messages = JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    throw new EmailKitError(
      "invalid-messages",
      `${file} isn't valid JSON: ${(error as Error).message}`,
    )
  }
  if (typeof messages !== "object" || messages === null || Array.isArray(messages)) {
    throw new EmailKitError(
      "invalid-messages",
      `${file} must be an object of "key": "message" pairs`,
    )
  }
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value !== "string") {
      throw new EmailKitError("invalid-messages", `${file}: "${key}" must be a string message`)
    }
  }
  return messages as Record<string, string>
}
