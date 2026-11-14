import { readFileSync } from "node:fs"

import { EmailKitError } from "@email-kit/core/internal"

/** Pixels in a rem. Email clients size text from a 16px root, so rem values convert at 16. */
const REM_PX = 16

/** Whether a value is a plain object, not `null` or an array. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** An amount of px or rem, in px. */
export function pxOf(amount: number, unit: "px" | "rem"): number {
  return unit === "rem" ? amount * REM_PX : amount
}

/**
 * A CSS length in px or rem, such as `10px` or `0.625rem`, in px. Anything else, such as `1em` or
 * `calc(…)`, gives `undefined`.
 */
export function lengthToPx(value: string | undefined): number | undefined {
  const match = value === undefined ? null : /^(-?\d*\.?\d+)(px|rem)$/.exec(value.trim())
  return match ? pxOf(Number(match[1]), match[2] as "px" | "rem") : undefined
}

/** Reads a theme file as text. `label` names it in the error, as the config wrote it. */
export function readText(file: string, label: string): string {
  try {
    return readFileSync(file, "utf8")
  } catch {
    throw new EmailKitError("invalid-theme", `The theme file ${label} can't be read`)
  }
}
