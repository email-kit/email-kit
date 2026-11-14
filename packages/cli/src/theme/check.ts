import type { ThemeConfig } from "@email-kit/core"

import { inputLabel } from "./source/resolver.ts"
import { loadTheme, type Theme } from "./theme.ts"
import { type TokenFinding, validateTheme } from "./validate/index.ts"

/**
 * Runs the `tokens.*` checks on the selected theme and, for a resolver, on every other
 * permutation, so a brand that fails contrast fails even while another brand is selected.
 * Typography and layout are the same in every permutation, so only new findings are added, each
 * naming its permutation.
 */
export function checkPermutations(
  theme: Theme,
  config: ThemeConfig | undefined,
  dir: string,
): TokenFinding[] {
  const findings = validateTheme(theme)
  const seen = new Set(findings.map(key))
  for (const input of theme.permutations) {
    const permutation = inputLabel(input)
    for (const finding of validateTheme(loadTheme({ ...config, input }, dir))) {
      if (!seen.has(key(finding))) findings.push({ ...finding, permutation })
    }
  }
  return findings
}

/** What makes two findings the same, whichever permutation they came from. */
function key(finding: TokenFinding): string {
  return `${finding.id}|${finding.mode ?? ""}|${finding.message}`
}
