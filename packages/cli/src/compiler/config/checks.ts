import type { CheckSetting, CustomCheck } from "@email-kit/core"

import { CATALOGUE } from "../../checks/catalogue/index.ts"
import { TOKEN_CHECKS } from "../../theme/validate/index.ts"

import { checkKeys, isRecord, type Problems, quoted } from "./shared.ts"

/** The levels a check can be set to in `checks`. */
const LEVELS: readonly string[] = ["off", "info", "warn", "error"]

/** The levels a custom check can have. A check that's off isn't written. */
const CUSTOM_LEVELS: readonly string[] = ["error", "warn", "info"]

/** When a custom check runs: on the template source, on rendered output, or on both. */
const ON: readonly string[] = ["template", "render", "both"]

/** A custom check id: `family.name` in lowercase. */
const CUSTOM_ID = /^([a-z][a-z0-9-]*)\.([a-z0-9][a-z0-9-]*)$/

/** The ids of email-kit's own checks. */
const BUILT_IN_IDS: readonly string[] = [...CATALOGUE, ...TOKEN_CHECKS].map((check) => check.id)

/** The id families email-kit's checks use, such as `img`. Custom checks need their own. */
const BUILT_IN_FAMILIES: ReadonlySet<string> = new Set(
  BUILT_IN_IDS.map((id) => id.split(".")[0] as string),
)

/** Reads `checks`: each a known check id, with a level and a reason that isn't empty. */
export function readChecks(
  value: unknown,
  custom: readonly CustomCheck[],
  problems: Problems,
): Record<string, CheckSetting> {
  if (value === undefined) return {}
  if (!isRecord(value)) {
    problems.push(
      'checks: must be an object like { "img.fluid-width": { level: "off", reason: "…" } }',
    )
    return {}
  }
  const known = [...BUILT_IN_IDS, ...custom.map((check) => check.id)]
  const out: Record<string, CheckSetting> = {}
  for (const [id, setting] of Object.entries(value)) {
    if (!known.includes(id)) {
      const near = known.find((k) => distance(k, id) <= 2)
      problems.push(`checks.${id}: unknown check${near ? ` (did you mean ${near}?)` : ""}`)
      continue
    }
    const entry = isRecord(setting) ? setting : {}
    checkKeys(entry, ["level", "reason"], `checks.${id}.`, problems)
    const { level, reason } = entry
    if (typeof level !== "string" || !LEVELS.includes(level)) {
      problems.push(`checks.${id}.level: must be one of ${LEVELS.map((l) => `"${l}"`).join(", ")}`)
    } else if (typeof reason !== "string" || !reason.trim()) {
      problems.push(
        `checks.${id}.reason: say why this check is set to "${level}"; reviewers read it`,
      )
    } else {
      out[id] = { level: level as CheckSetting["level"], reason }
    }
  }
  return out
}

/**
 * Reads `customChecks`: each with a unique id in a family the built-in checks don't use, the
 * fields the reporters show, and a `run()`. Only checks without problems are kept.
 */
export function readCustomChecks(value: unknown, problems: Problems): CustomCheck[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    problems.push("customChecks: must be an array of defineCheck({ … })")
    return []
  }

  const seen = new Set<string>()
  const out: CustomCheck[] = []
  value.forEach((check: unknown, i) => {
    const where = `customChecks[${i}]`
    if (!isRecord(check)) {
      problems.push(`${where}: must be a defineCheck({ id, level, rule, fix, run })`)
      return
    }
    const before = problems.length
    const [, family, name] = (typeof check.id === "string" && CUSTOM_ID.exec(check.id)) || []
    if (!family) {
      problems.push(`${where}.id: must be "family.name" in lowercase, such as "acme.help-link"`)
    } else if (BUILT_IN_FAMILIES.has(family)) {
      problems.push(
        `${where}.id: "${family}." is email-kit's; use your own family, such as "acme.${name}"`,
      )
    } else if (seen.has(check.id as string)) {
      problems.push(`${where}.id: "${check.id}" is defined twice`)
    }
    if (!CUSTOM_LEVELS.includes(check.level as string)) {
      problems.push(`${where}.level: must be ${quoted(CUSTOM_LEVELS)}`)
    }
    for (const key of ["rule", "fix"]) {
      const text = check[key]
      if (typeof text !== "string" || !text.trim()) {
        problems.push(`${where}.${key}: must be a sentence`)
      }
    }
    if (check.on !== undefined && !ON.includes(check.on as string)) {
      problems.push(`${where}.on: must be ${quoted(ON)}`)
    }
    if (typeof check.run !== "function") {
      problems.push(`${where}.run: must be a function (context, report) => void`)
    }
    if (problems.length === before) {
      seen.add(check.id as string)
      out.push(check as unknown as CustomCheck)
    }
  })
  return out
}

/** The edit distance between two strings, for "did you mean" suggestions on mistyped check ids. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] as number
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const next = row[j] as number
      row[j] = Math.min(
        next + 1,
        (row[j - 1] as number) + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      previous = next
    }
  }
  return row[b.length] as number
}
