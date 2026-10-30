// The tokens.* checks on the selected theme and, for a resolver, on every other permutation
// (THM-10, P1-110): a brand that fails contrast fails even when another brand is selected.

import type { ThemeConfig } from "@email-kit/core"

import { loadTheme, type Theme } from "./theme.ts"
import { type TokenFinding, validateTheme } from "./validate.ts"

export function checkPermutations(
  theme: Theme,
  config: ThemeConfig | undefined,
  dir: string,
): TokenFinding[] {
  const findings = validateTheme(theme)
  const seen = new Set(findings.map(key))
  for (const input of theme.permutations) {
    const permutation = Object.entries(input)
      .map(([name, context]) => `${name}=${context}`)
      .join(", ")
    // Typography and layout don't change between permutations; report only what differs.
    for (const finding of validateTheme(loadTheme({ ...config, input }, dir))) {
      if (!seen.has(key(finding))) findings.push({ ...finding, permutation })
    }
  }
  return findings
}

function key(finding: TokenFinding): string {
  return `${finding.id}|${finding.mode ?? ""}|${finding.message}`
}
