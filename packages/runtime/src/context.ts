/**
 * `@email-kit/runtime/context`: checks the sender values passed to `createEmails()`. The generated
 * module imports it when the config has sender values set with `{ runtime: true }`.
 *
 * @packageDocumentation
 */

import { EmailRenderError } from "./errors.ts"
import { describe, HTTPS_URL, isObject } from "./shared.ts"

const URL_CONTEXT_KEYS: readonly string[] = ["helpUrl", "privacyUrl", "siteUrl"]
const EMAIL_ADDRESS = /^[^\s@<>"]+@[^\s@<>"]+$/

/**
 * Reads the sender values passed to `createEmails()`. Each must be a non-empty string; URLs must be
 * https, and `supportEmail` an email address.
 */
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
