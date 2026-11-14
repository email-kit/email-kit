import { existsSync, statSync } from "node:fs"

/**
 * The messages the config readers collect. Each reader adds to it instead of throwing, so one run
 * shows every problem in the config.
 */
export type Problems = string[]

/** Whether a value is a plain object, not `null` or an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Reports each key of `record` that isn't in `known`, as `<prefix><key>: unknown option`. */
export function checkKeys(
  record: Record<string, unknown>,
  known: readonly string[],
  prefix: string,
  problems: Problems,
): void {
  for (const key of Object.keys(record)) {
    if (!known.includes(key)) {
      problems.push(`${prefix}${key}: unknown option (known: ${known.join(", ")})`)
    }
  }
}

/** A list of values for a message, such as `"a", "b" or "c"`. */
export function quoted(values: readonly string[], last = "or"): string {
  const items = values.map((value) => `"${value}"`)
  return items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`
}

/** Whether `path` exists and is a folder. */
export function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}
