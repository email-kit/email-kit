import { SENDER_KEYS, type SenderKey, type SenderValues } from "@email-kit/core/internal"

import { isRecord, type Problems } from "./shared.ts"

/** Sender values that are URLs. `render()` also requires https for the ones passed at send time. */
const URL_KEYS: readonly string[] = ["helpUrl", "privacyUrl", "siteUrl"]

/**
 * Reads `sender`: each value is either a string fixed at compile time, or `{ runtime: true }` to
 * pass it to `render()` at send time.
 */
export function readSender(value: unknown, problems: Problems): SenderValues {
  const constants: Partial<Record<SenderKey, string>> = {}
  const runtime: SenderKey[] = []
  if (value === undefined) return { constants, runtime }
  if (!isRecord(value)) {
    problems.push(
      'sender: must be an object like { productName: "Acme", siteUrl: { runtime: true } }',
    )
    return { constants, runtime }
  }

  for (const [key, option] of Object.entries(value)) {
    if (!isSenderKey(key)) {
      problems.push(`sender.${key}: unknown sender value (known: ${SENDER_KEYS.join(", ")})`)
    } else if (typeof option === "string" && option.trim() !== "") {
      const problem = valueProblem(key, option)
      if (problem) problems.push(`sender.${key}: ${problem}`)
      constants[key] = option
    } else if (isRecord(option) && Object.keys(option).length === 1 && option.runtime === true) {
      runtime.push(key)
    } else {
      problems.push(
        `sender.${key}: must be a non-empty string, or { runtime: true } to pass it at send time`,
      )
    }
  }
  return { constants, runtime: runtime.sort() }
}

function isSenderKey(key: string): key is SenderKey {
  return (SENDER_KEYS as readonly string[]).includes(key)
}

/** What's wrong with a fixed sender value: URLs must be https, `supportEmail` an address. */
function valueProblem(key: SenderKey, value: string): string | undefined {
  if (URL_KEYS.includes(key) && !/^https:\/\/[^\s/?#]+[^\s]*$/i.test(value)) {
    return 'must be an https URL, like "https://example.com/…"'
  }
  if (key === "supportEmail" && !/^[^\s@<>"]+@[^\s@<>"]+$/.test(value)) {
    return 'must be an email address, like "help@example.com"'
  }
  return undefined
}
