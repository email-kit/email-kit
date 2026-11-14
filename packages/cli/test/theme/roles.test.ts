// The colour roles mapped from shadcn's variables, the muted-ink adjustment and the colour checks,
// on shadcn's neutral theme and on deliberately bad themes.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { channels, contrast } from "../../src/theme/colour.ts"
import { type ColourTokens, ROLES, resolveRoles } from "../../src/theme/roles/index.ts"
import { readShadcnCss } from "../../src/theme/source/shadcn.ts"
import { validateRoles } from "../../src/theme/validate/index.ts"

const neutral = readShadcnCss(
  readFileSync(
    fileURLToPath(new URL("../fixtures/themes/shadcn-neutral.css", import.meta.url)),
    "utf8",
  ),
)

function report(theme: ColourTokens): string {
  const roles = resolveRoles(theme)
  const lines: string[] = []
  for (const mode of ["light", "dark"] as const) {
    const colours = roles[mode]
    if (!colours) continue
    lines.push(`## ${mode}`, "")
    for (const role of ROLES) lines.push(`${role.padEnd(28)}${colours[role]}`)
    lines.push("")
  }
  lines.push(
    "## notes",
    "",
    ...roles.notes
      .filter((n) => n.kind !== "default")
      .map((n) => `${n.mode} ${n.kind}: ${n.message}`),
    "",
  )
  lines.push(
    "## findings",
    "",
    ...validateRoles(roles).map((f) => `${f.mode} ${f.level} ${f.id}: ${f.message}`),
    "",
  )
  return lines.join("\n")
}

describe("shadcn neutral theme", () => {
  it("matches the reviewed report", async () => {
    await expect(report(neutral)).toMatchFileSnapshot("../__golden__/theme/shadcn-neutral.txt")
  })

  it("maps shadcn's variables to the roles", () => {
    const { light, dark } = resolveRoles(neutral)
    expect(light).toMatchObject({
      pageGround: "#f5f5f5",
      canvas: "#ffffff",
      ink: "#0a0a0a",
      link: "#171717",
      hairline: "#e5e5e5",
      "action.primary.fill": "#171717",
      "action.primary.label": "#fafafa",
      "action.destructive.fill": "#e7000b",
    })
    expect(dark).toMatchObject({
      pageGround: "#0a0a0a",
      canvas: "#171717",
      ink: "#fafafa",
      mutedInk: "#a1a1a1",
      "action.destructive.fill": "#ff6467",
    })
  })

  it("flattens the translucent dark border over the canvas", () => {
    // oklch(1 0 0 / 10%) over #171717: 23 + 232 × 0.1 = 46.2 → #2e2e2e
    expect(resolveRoles(neutral).dark?.hairline).toBe("#2e2e2e")
  })

  it("adjusts muted ink to the nearest lightness that passes, and stays neutral", () => {
    const { light, notes } = resolveRoles(neutral)
    expect(contrast("#737373", light.pageGround)).toBeLessThan(4.5)
    const ink = light.mutedInk
    expect(contrast(ink, light.pageGround)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(ink, light.canvas)).toBeGreaterThanOrEqual(4.5)
    const [r, g, b] = channels(ink)
    expect(r === g && g === b).toBe(true)
    expect(notes).toContainEqual(
      expect.objectContaining({ role: "mutedInk", mode: "light", kind: "adjusted" }),
    )
  })

  it("picks dark labels for light fills in dark mode", () => {
    const { dark } = resolveRoles(neutral)
    for (const role of ["action.destructive.label", "status.warning.onFill"] as const) {
      expect(dark?.[role]).toBe("#0a0a0a")
    }
  })

  it("passes every error-level check", () => {
    expect(validateRoles(resolveRoles(neutral)).filter((f) => f.level === "error")).toEqual([])
  })
})

describe("overrides and inputs", () => {
  it("applies role overrides, for both modes or one", () => {
    const { light, dark } = resolveRoles(neutral, {
      link: "oklch(0.5 0.2 260)",
      pageGround: { light: "#fafafa" },
    })
    expect(light.link).toBe(dark?.link)
    expect(light.pageGround).toBe("#fafafa")
    expect(dark?.pageGround).toBe("#0a0a0a")
  })

  it("never adjusts an explicitly chosen muted ink", () => {
    const { light, notes } = resolveRoles(neutral, { mutedInk: "#737373" })
    expect(light.mutedInk).toBe("#737373")
    expect(notes.some((n) => n.kind === "adjusted" && n.role === "mutedInk")).toBe(false)
    // subtleInk wasn't overridden, so it is still adjusted on its own.
    expect(notes.some((n) => n.kind === "adjusted" && n.role === "subtleInk")).toBe(true)
  })

  it("reads shadcn's older bare HSL channels", () => {
    const old = readShadcnCss(`:root {
      --background: 0 0% 100%; --foreground: 240 10% 3.9%; --card: 0 0% 100%; --muted: 240 4.8% 95.9%;
      --muted-foreground: 240 3.8% 46.1%; --primary: 240 5.9% 10%; --primary-foreground: 0 0% 98%;
      --secondary: 240 4.8% 95.9%; --secondary-foreground: 240 5.9% 10%; --destructive: 0 84.2% 60.2%;
      --border: 240 5.9% 90%;
    }`)
    expect(resolveRoles(old).light.canvas).toBe("#ffffff")
  })

  it("names the token to add when a role can't be resolved", () => {
    expect(() => resolveRoles({ light: { background: "#fff" } })).toThrow(/role canvas|role ink|--/)
  })
})

describe("colour checks", () => {
  const bad: ColourTokens = {
    light: {
      ...neutral.light,
      background: "#ffffff",
      card: "#ffffff",
      muted: "#ffffff",
      accent: "#ffffff",
      primary: "#facc15",
      "primary-foreground": "#ffffff",
      secondary: "#fffffd",
    },
    dark: { ...(neutral.dark ?? {}), background: "#000000", card: "#000000" },
  }
  const findings = validateRoles(resolveRoles(bad))
  const ids = (level: string) =>
    findings.filter((f) => f.level === level).map((f) => `${f.mode} ${f.id}`)

  it("reports each problem with its id, level and mode", () => {
    expect(ids("error")).toEqual(
      expect.arrayContaining([
        "light tokens.link-contrast",
        "light tokens.action-contrast",
        "light tokens.brand-ink",
      ]),
    )
    expect(ids("warning")).toEqual(
      expect.arrayContaining(["light tokens.offwhite-tint", "dark tokens.dark-ground"]),
    )
    expect(ids("info")).toEqual(
      expect.arrayContaining(["light tokens.light-ground", "light tokens.gmail-fill"]),
    )
  })

  it("explains the failing pair in the message", () => {
    expect(findings.find((f) => f.id === "tokens.link-contrast")?.message).toMatch(
      /^link #facc15 on canvas #ffffff is 1\.\d\d:1; links need 4\.5:1$/,
    )
  })
})
