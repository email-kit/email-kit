/** A plain object: not `null` and not an array. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Whether an object has its own `key`, whatever its value. */
export function hasOwn(object: object, key: string): boolean {
  // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn needs lib ES2022 in the host
  return Object.prototype.hasOwnProperty.call(object, key)
}

/** Whether an object has its own `key`, set to something other than `undefined`. */
export function has(record: Record<string, unknown>, key: string): boolean {
  return hasOwn(record, key) && record[key] !== undefined
}

/** An https URL with a host. */
export const HTTPS_URL: RegExp = /^https:\/\/[^\s/?#]+[^\s]*$/i

/** A value for an error message: a short quoted string, `null`, `a list` or `an object`. */
export function describe(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "a list"
  if (typeof value === "string")
    return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value)
  return typeof value === "object" ? "an object" : `${typeof value} ${String(value)}`
}

/** The data key that holds the plural and select flags, and the sender values passed at send time. */
export const EK = "_ek"
