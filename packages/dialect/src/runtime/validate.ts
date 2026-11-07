// Checking data against a template's model.

import { isObject } from "../index.ts"
import { describe, HTTPS_URL, has } from "./shared.ts"
import type { DataIssue, Model } from "./types.ts"

// --- inlined into generated modules from here ---

function counted(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

export function validate(model: Model, value: unknown, path = ""): DataIssue[] {
  const issues: DataIssue[] = []
  const at = path || "data"
  const fail = (message: string) => issues.push({ path: at, message })
  if (value === null || value === undefined) {
    if (value === null && model.nullable) return issues
    fail(value === null ? "can't be null" : "is required")
    return issues
  }

  const constraints = model.constraints ?? {}
  const number = (name: string): number | undefined => {
    const limit = constraints[name]
    return typeof limit === "number" ? limit : undefined
  }
  const text = (name: string): string | undefined => {
    const limit = constraints[name]
    return typeof limit === "string" ? limit : undefined
  }
  switch (model.type) {
    case "string": {
      if (typeof value !== "string") {
        fail(`expected a string, got ${describe(value)}`)
        break
      }
      const length = Array.from(value).length
      if (model.enum && model.enum.indexOf(value) === -1) {
        fail(
          `expected one of ${model.enum.map((v) => JSON.stringify(v)).join(", ")}, got ${describe(value)}`,
        )
      }
      const min = number("minLength")
      const max = number("maxLength")
      const pattern = text("pattern")
      if (min !== undefined && length < min) fail(`must be at least ${counted(min, "character")}`)
      if (max !== undefined && length > max) fail(`must be at most ${counted(max, "character")}`)
      if (pattern !== undefined && !new RegExp(pattern, "u").test(value)) {
        fail(`must match ${pattern}`)
      }
      if (model.url && !HTTPS_URL.test(value)) {
        fail(`must be an https URL, got ${describe(value)}`)
      }
      break
    }
    case "number":
    case "integer": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        fail(`expected a number, got ${describe(value)}`)
        break
      }
      if (model.type === "integer" && Math.floor(value) !== value)
        fail(`expected an integer, got ${value}`)
      const bounds: readonly [string, (limit: number) => boolean, string][] = [
        ["minimum", (limit) => value >= limit, "at least"],
        ["maximum", (limit) => value <= limit, "at most"],
        ["exclusiveMinimum", (limit) => value > limit, "more than"],
        ["exclusiveMaximum", (limit) => value < limit, "less than"],
      ]
      for (const [name, ok, words] of bounds) {
        const limit = number(name)
        if (limit !== undefined && !ok(limit)) fail(`must be ${words} ${limit}, got ${value}`)
      }
      const step = number("multipleOf")
      if (step !== undefined && Math.abs(value / step - Math.round(value / step)) > 1e-9) {
        fail(`must be a multiple of ${step}`)
      }
      break
    }
    case "boolean":
      if (typeof value !== "boolean") fail(`expected true or false, got ${describe(value)}`)
      break
    case "array": {
      if (!Array.isArray(value)) {
        fail(`expected a list, got ${describe(value)}`)
        break
      }
      const minItems = number("minItems")
      const maxItems = number("maxItems")
      if (minItems !== undefined && value.length < minItems)
        fail(`must have at least ${counted(minItems, "item")}`)
      if (maxItems !== undefined && value.length > maxItems)
        fail(`must have at most ${counted(maxItems, "item")}`)
      value.forEach((item, index) => {
        issues.push(...validate(model.items as Model, item, `${path}[${index}]`))
      })
      break
    }
    case "object": {
      if (!isObject(value)) {
        fail(`expected an object, got ${describe(value)}`)
        break
      }
      const required = model.required ?? []
      const properties = model.properties ?? {}
      for (const key of Object.keys(properties)) {
        const child = path ? `${path}.${key}` : key
        if (has(value, key)) {
          issues.push(...validate(properties[key] as Model, value[key], child))
        } else if (required.indexOf(key) !== -1) {
          issues.push({ path: child, message: "is required" })
        }
      }
      break
    }
  }
  return issues
}
