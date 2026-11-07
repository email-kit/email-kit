// Small helpers used by more than one runtime file.

// --- inlined into generated modules from here ---

export function has(record: Record<string, unknown>, key: string): boolean {
  // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn needs lib ES2022 in the host
  return Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined
}

export const HTTPS_URL: RegExp = /^https:\/\/[^\s/?#]+[^\s]*$/i

export function describe(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "a list"
  if (typeof value === "string")
    return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value)
  return typeof value === "object" ? "an object" : `${typeof value} ${String(value)}`
}
