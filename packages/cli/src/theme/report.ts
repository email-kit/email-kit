import { contrast } from "./colour.ts"
import { ROLES, type RoleColours, surfaceOf } from "./roles/index.ts"
import type { Theme } from "./theme.ts"
import type { Level, TokenFinding } from "./validate/index.ts"

/** Where a finding applies, such as ` (brand=b, dark)`, or nothing for the selected theme. */
function where(finding: TokenFinding): string {
  const parts = [finding.permutation, finding.mode].filter(Boolean)
  return parts.length > 0 ? ` (${parts.join(", ")})` : ""
}

/** The marks findings are listed with, by level. */
const MARKS = { error: "✗", warning: "!", info: "i" } as const

/**
 * What `email-kit tokens` prints: every role in each mode, with its contrast against the surface
 * it sits on, notes on how values were derived, and the `tokens.*` findings with a count of each
 * level.
 */
export function formatTokens(theme: Theme, findings: readonly TokenFinding[]): string {
  const { light, dark } = theme.roles
  const modes: RoleColours[] = dark ? [light, dark] : [light]
  const width = Math.max(...ROLES.map((role) => role.length))
  const lines = [`Theme: ${theme.source} (dark: ${theme.dark})`, ""]
  lines.push(`${"Role".padEnd(width)}  Light     ${dark ? "Dark      " : ""}Contrast`)
  for (const role of ROLES) {
    const surface = surfaceOf(role)
    const hexes = modes.map((colours) => colours[role]).join("  ")
    const ratios = surface
      ? `${modes.map((colours) => contrast(colours[role], colours[surface]).toFixed(2)).join(" / ")} on ${surface}`
      : ""
    lines.push(`${role.padEnd(width)}  ${hexes}  ${ratios}`.trimEnd())
  }

  const notes = theme.roles.notes.filter((note) => note.kind !== "default")
  if (notes.length > 0) {
    lines.push("", "Notes")
    for (const note of notes) lines.push(`  ${note.mode} ${note.kind}: ${note.message}`)
  }

  lines.push("", "Findings")
  if (findings.length === 0) lines.push("  none")
  for (const finding of findings) {
    lines.push(`  ${MARKS[finding.level]} ${finding.id}${where(finding)}: ${finding.message}`)
  }
  const count = (level: Level, word: string) => {
    const n = findings.filter((finding) => finding.level === level).length
    return `${n} ${word}${n === 1 ? "" : "s"}`
  }
  lines.push(
    "",
    `${count("error", "error")}, ${count("warning", "warning")}, ${count("info", "note")}`,
  )
  return lines.join("\n")
}
