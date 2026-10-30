// `email-kit tokens` (P1-114, CLI-09): every role per mode with its contrast against the surface
// it sits on, the notes on how values were derived, and the tokens.* findings.

import { contrast, type Hex } from "./colour.ts"
import { ROLES, type Role } from "./roles.ts"
import type { Theme } from "./theme.ts"
import type { TokenFinding } from "./validate.ts"

/** The surface each role is read against; grounds and borders against the canvas. */
function surfaceOf(role: Role): Role | undefined {
  if (role === "pageGround") return undefined
  if (role === "canvas") return "pageGround"
  if (role === "inverseInk") return "inverse"
  if (role === "onBrand") return "brand"
  const action = /^action\.(\w+)\.label$/.exec(role)
  if (action) return `action.${action[1]}.fill` as Role
  const status = /^status\.(\w+)\.(ink|onFill|border)$/.exec(role)
  if (status) {
    return (
      status[2] === "onFill" ? `status.${status[1]}.fill` : `status.${status[1]}.surface`
    ) as Role
  }
  return "canvas"
}

function where(finding: TokenFinding): string {
  const parts = [finding.permutation, finding.mode].filter(Boolean)
  return parts.length > 0 ? ` (${parts.join(", ")})` : ""
}

export function formatTokens(theme: Theme, findings: readonly TokenFinding[]): string {
  const { light, dark } = theme.roles
  const lines = [`Theme: ${theme.source} (dark: ${theme.dark})`, ""]
  const width = Math.max(...ROLES.map((role) => role.length))
  lines.push(`${"Role".padEnd(width)}  Light     ${dark ? "Dark      " : ""}Contrast`)
  for (const role of ROLES) {
    const surface = surfaceOf(role)
    const ratio = (colours: Readonly<Record<Role, Hex>> | undefined) =>
      colours && surface ? contrast(colours[role], colours[surface]).toFixed(2) : "-"
    const ratios = dark ? `${ratio(light)} / ${ratio(dark)}` : ratio(light)
    lines.push(
      `${role.padEnd(width)}  ${light[role]}  ${dark ? `${dark[role]}  ` : ""}${surface ? `${ratios} on ${surface}` : ""}`.trimEnd(),
    )
  }
  const notes = theme.roles.notes.filter((note) => note.kind !== "default")
  if (notes.length > 0) {
    lines.push("", "Notes")
    for (const note of notes) lines.push(`  ${note.mode} ${note.kind}: ${note.message}`)
  }
  lines.push("", "Findings")
  if (findings.length === 0) lines.push("  none")
  const mark = { error: "✗", warning: "!", info: "i" } as const
  for (const finding of findings) {
    lines.push(`  ${mark[finding.level]} ${finding.id}${where(finding)}: ${finding.message}`)
  }
  const count = (level: TokenFinding["level"]) => findings.filter((f) => f.level === level).length
  lines.push("", `${count("error")} errors, ${count("warning")} warnings, ${count("info")} notes`)
  return lines.join("\n")
}
