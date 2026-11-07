// Checking the site-wide values passed to createEmails().

import { isObject } from "../index.ts"
import { describe, HTTPS_URL } from "./shared.ts"
import { EmailRenderError } from "./types.ts"

// --- inlined into generated modules from here ---

const URL_CONTEXT_KEYS: readonly string[] = ["helpUrl", "privacyUrl", "siteUrl"]
const EMAIL_ADDRESS = /^[^\s@<>"]+@[^\s@<>"]+$/

export function readContext(
  keys: readonly string[],
  context: unknown,
): Readonly<Record<string, string>> {
  const values: Record<string, string> = {}
  for (const key of keys) {
    const value = isObject(context) ? context[key] : undefined
    if (typeof value !== "string" || value === "") {
      throw new EmailRenderError(
        "missing-context",
        `createEmails() needs "${key}" as a non-empty string`,
      )
    }
    if (URL_CONTEXT_KEYS.includes(key) && !HTTPS_URL.test(value)) {
      throw new EmailRenderError(
        "invalid-context",
        `createEmails() needs "${key}" as an https URL, got ${describe(value)}`,
      )
    }
    if (key === "supportEmail" && !EMAIL_ADDRESS.test(value)) {
      throw new EmailRenderError(
        "invalid-context",
        `createEmails() needs "supportEmail" as an email address, got ${describe(value)}`,
      )
    }
    values[key] = value
  }
  return values
}
